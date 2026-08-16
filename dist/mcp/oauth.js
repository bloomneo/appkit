/**
 * Minimal, stateless OAuth 2.1 authorization server for MCP
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/oauth.ts
 *
 * @llm-rule WHEN: An MCP client (claude.ai connector, Claude Desktop) must authorise against your app
 * @llm-rule AVOID: Bearer-token-only MCP endpoints - connector clients cannot attach to them
 * @llm-rule NOTE: Every artefact is a signed JWT, so nothing is stored and any worker can validate
 *
 * claude.ai's connector flow needs exactly four things — RFC 8414 + RFC 9728
 * metadata, RFC 7591 dynamic client registration, and an authorization-code +
 * PKCE grant. That's small and worth owning rather than pulling a library.
 *
 * Statelessness is the load-bearing design choice: an app running N workers in
 * cluster mode would otherwise have to share every code, client and token
 * across them. Here each artefact is a JWT the issuing worker never has to
 * remember, so any worker can validate it. Nothing to store, nothing to
 * replicate.
 *
 * Token lifetimes: auth code 60s, access token 1h, refresh token 30d.
 * PKCE (S256) is required; there are no client secrets (public clients only).
 *
 * Extracted from a production deployment serving a live claude.ai connector.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { McpError } from './mcp.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/mcp/README.md';
const b64url = (b) => b.toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
/** Absolute origin of the current request, honouring the reverse proxy. */
function originOf(req) {
    const proto = String(req.headers?.['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim();
    const host = String(req.headers?.['x-forwarded-host'] ?? req.get?.('host') ?? '').split(',')[0].trim();
    return `${proto}://${host}`;
}
/**
 * Build the OAuth router. `Router` is injected rather than imported so this
 * file stays loadable without express — see peers.ts.
 */
export function createMcpOAuth(config, Router) {
    if (!config?.secret || typeof config.secret !== 'string' || config.secret.length < 32) {
        throw new McpError(`OAuth secret must be at least 32 characters. See: ${DOCS_URL}#environment-variables`, { code: 'MCP_WEAK_SECRET' });
    }
    if (typeof config.authenticate !== 'function') {
        throw new McpError(`OAuth config needs an authenticate(email, password) callback. See: ${DOCS_URL}#authorization`, {
            code: 'MCP_INVALID_CONFIG',
        });
    }
    if (!config.serviceName) {
        throw new McpError(`OAuth config needs a serviceName for the consent screen. See: ${DOCS_URL}#authorization`, {
            code: 'MCP_INVALID_CONFIG',
        });
    }
    const scope = config.scope ?? 'mcp';
    // Resolve the mount base ({origin}{baseUrl}) at request time so the metadata
    // is correct behind a reverse proxy and in local dev alike. issuer overrides.
    const baseUrl = (req) => config.issuer ?? `${originOf(req)}${req.baseUrl ?? ''}`;
    const resourceUrl = (req) => config.resource ?? `${baseUrl(req)}/`;
    const sign = (payload, expiresIn) => jwt.sign(payload, config.secret, { algorithm: 'HS256', expiresIn: expiresIn });
    const verify = (token) => {
        try {
            return jwt.verify(token, config.secret, { algorithms: ['HS256'] });
        }
        catch {
            return null;
        }
    };
    /** Validate a bearer access token — used by the transport's guard. */
    const verifyAccessToken = (token) => {
        const p = verify(token);
        if (!p || p.kind !== 'access')
            return null;
        return { sub: p.sub, scope: p.scope };
    };
    const router = Router();
    // ── RFC 9728: protected-resource metadata ────────────────────────────────
    router.get('/.well-known/oauth-protected-resource', (req, res) => {
        res.json({
            resource: resourceUrl(req),
            authorization_servers: [baseUrl(req)],
            scopes_supported: [scope],
            bearer_methods_supported: ['header'],
        });
    });
    // ── RFC 8414: authorization-server metadata ──────────────────────────────
    router.get('/.well-known/oauth-authorization-server', (req, res) => {
        const base = baseUrl(req);
        res.json({
            issuer: base,
            authorization_endpoint: `${base}/authorize`,
            token_endpoint: `${base}/token`,
            registration_endpoint: `${base}/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            scopes_supported: [scope],
        });
    });
    // ── RFC 7591: dynamic client registration ────────────────────────────────
    // Stateless: the returned client_id is a signed JWT carrying the client's
    // redirect_uris, so any worker can validate an /authorize or /token call
    // without a shared client store.
    router.post('/register', (req, res) => {
        const body = (req.body ?? {});
        const redirectUris = Array.isArray(body.redirect_uris)
            ? body.redirect_uris.filter((u) => typeof u === 'string')
            : [];
        if (redirectUris.length === 0) {
            res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' });
            return;
        }
        const clientName = typeof body.client_name === 'string' ? body.client_name : 'MCP Client';
        const clientId = sign({ kind: 'client', redirect_uris: redirectUris, name: clientName }, '3650d');
        res.status(201).json({
            client_id: clientId,
            client_name: clientName,
            redirect_uris: redirectUris,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        });
    });
    const decodeClient = (clientId) => {
        const p = verify(clientId);
        return p && p.kind === 'client' ? p : null;
    };
    // ── Authorization endpoint — GET renders the consent/login screen ─────────
    router.get('/authorize', (req, res) => {
        const q = (req.query ?? {});
        const client = q.client_id ? decodeClient(q.client_id) : null;
        if (!client) {
            res.status(400).send('Invalid client_id');
            return;
        }
        if (!q.redirect_uri || !client.redirect_uris.includes(q.redirect_uri)) {
            res.status(400).send('redirect_uri not registered for this client');
            return;
        }
        if (q.code_challenge_method !== 'S256' || !q.code_challenge) {
            // PKCE S256 mandatory — refuse anything weaker.
            res.status(400).send('PKCE with S256 is required');
            return;
        }
        res.type('html').send(consentPage({
            serviceName: config.serviceName,
            clientName: client.name,
            hidden: {
                client_id: q.client_id,
                redirect_uri: q.redirect_uri,
                state: q.state ?? '',
                code_challenge: q.code_challenge,
                code_challenge_method: q.code_challenge_method,
                scope: q.scope ?? scope,
                resource: q.resource ?? '',
            },
        }));
    });
    // ── Authorization endpoint — POST verifies creds, mints an auth code ──────
    router.post('/authorize', async (req, res) => {
        const b = (req.body ?? {});
        const client = b.client_id ? decodeClient(b.client_id) : null;
        if (!client || !b.redirect_uri || !client.redirect_uris.includes(b.redirect_uri)) {
            res.status(400).send('Invalid client or redirect_uri');
            return;
        }
        if (b.code_challenge_method !== 'S256' || !b.code_challenge) {
            res.status(400).send('PKCE with S256 is required');
            return;
        }
        const identity = await config
            .authenticate(String(b.email ?? ''), String(b.password ?? ''))
            .catch(() => null);
        if (!identity) {
            res
                .status(401)
                .type('html')
                .send(consentPage({
                serviceName: config.serviceName,
                clientName: client.name,
                hidden: {
                    client_id: b.client_id,
                    redirect_uri: b.redirect_uri,
                    state: b.state ?? '',
                    code_challenge: b.code_challenge,
                    code_challenge_method: b.code_challenge_method,
                    scope: b.scope ?? scope,
                    resource: b.resource ?? '',
                },
                error: 'Those credentials were not accepted.',
            }));
            return;
        }
        // The auth code binds the PKCE challenge + redirect_uri + subject. 60s TTL.
        const code = sign({
            kind: 'code',
            sub: identity.sub,
            client_id: b.client_id,
            redirect_uri: b.redirect_uri,
            code_challenge: b.code_challenge,
            scope: b.scope ?? scope,
        }, '60s');
        const url = new URL(b.redirect_uri);
        url.searchParams.set('code', code);
        if (b.state)
            url.searchParams.set('state', b.state);
        res.redirect(url.toString());
    });
    // ── Token endpoint ────────────────────────────────────────────────────────
    router.post('/token', (req, res) => {
        const b = (req.body ?? {});
        if (b.grant_type === 'authorization_code') {
            const code = verify(b.code ?? '');
            if (!code || code.kind !== 'code') {
                res.status(400).json({ error: 'invalid_grant' });
                return;
            }
            if (code.client_id !== b.client_id) {
                res.status(400).json({ error: 'invalid_grant', error_description: 'client mismatch' });
                return;
            }
            if (code.redirect_uri !== b.redirect_uri) {
                res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
                return;
            }
            // PKCE: verifier must hash to the stored challenge.
            const challenge = b64url(sha256(String(b.code_verifier ?? '')));
            if (challenge !== code.code_challenge) {
                res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
                return;
            }
            res.json(issueTokens(code.sub, code.scope));
            return;
        }
        if (b.grant_type === 'refresh_token') {
            const rt = verify(b.refresh_token ?? '');
            if (!rt || rt.kind !== 'refresh') {
                res.status(400).json({ error: 'invalid_grant' });
                return;
            }
            res.json(issueTokens(rt.sub, rt.scope));
            return;
        }
        res.status(400).json({ error: 'unsupported_grant_type' });
    });
    function issueTokens(sub, grantedScope) {
        const access = sign({ kind: 'access', sub, scope: grantedScope }, '1h');
        const refresh = sign({ kind: 'refresh', sub, scope: grantedScope }, '30d');
        return {
            access_token: access,
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: refresh,
            scope: grantedScope,
        };
    }
    return { router, verifyAccessToken, resourceUrl };
}
// ── Consent / login page ────────────────────────────────────────────────────
function consentPage(opts) {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const hiddenFields = Object.entries(opts.hidden)
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
        .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect ${esc(opts.serviceName)}</title>
<style>
  :root{color-scheme:light dark}
  body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;width:360px;max-width:92vw;box-shadow:0 20px 50px -20px rgba(0,0,0,.6)}
  h1{font-size:18px;margin:0 0 4px}
  p.sub{margin:0 0 20px;color:#94a3b8;font-size:13px}
  label{display:block;font-size:12px;color:#94a3b8;margin:14px 0 5px}
  input[type=email],input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:14px}
  button{width:100%;margin-top:20px;padding:11px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-weight:600;font-size:14px;cursor:pointer}
  .err{background:#7f1d1d;color:#fecaca;border-radius:8px;padding:9px 11px;font-size:13px;margin-bottom:14px}
  .who{font-size:12px;color:#64748b;margin-top:16px;text-align:center}
</style></head><body>
  <form class="card" method="post" action="authorize">
    <h1>Connect to ${esc(opts.serviceName)}</h1>
    <p class="sub">${esc(opts.clientName)} is requesting access. Sign in to authorise it.</p>
    ${opts.error ? `<div class="err">${esc(opts.error)}</div>` : ''}
    ${hiddenFields}
    <label>Email</label>
    <input type="email" name="email" autocomplete="username" required autofocus>
    <label>Password</label>
    <input type="password" name="password" autocomplete="current-password" required placeholder="••••••••">
    <button type="submit">Authorise access</button>
    <div class="who">This connection will have exactly the access your account has.</div>
  </form>
</body></html>`;
}
//# sourceMappingURL=oauth.js.map