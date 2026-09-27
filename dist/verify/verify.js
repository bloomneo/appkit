/**
 * Tenant-isolation verifier — generates the cross-tenant attack matrix
 * @module @bloomneo/appkit/verify
 * @file src/verify/verify.ts
 *
 * @llm-rule WHEN: Proving an agent-written multi-tenant app does not leak across tenants
 * @llm-rule AVOID: Hand-writing per-endpoint leak tests - ids are discovered, so this scales
 * @llm-rule NOTE: Drives a RUNNING server over HTTP; it tests the app, not the framework
 *
 * The design point: resource ids are **discovered, not declared**. The verifier
 * logs in as each identity, harvests the ids that identity can legitimately
 * see, then replays every id against every other identity. That is what makes
 * it a generator rather than a template — it needs no per-app manifest of
 * routes or fixtures, and it grows automatically as the app grows.
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/verify/README.md';
/** Looks like a database id worth replaying (cuid, uuid, mongo ObjectId, numeric). */
const ID_RE = /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24}|\d+)$/i;
export class VerifierClass {
    /**
     * Run the matrix against a live server.
     *
     * @llm-rule WHEN: A CI step, or a test that boots the app and asserts report.ok
     * @llm-rule AVOID: Running against production - refuses non-local URLs unless allowRemote
     * @llm-rule NOTE: DELETE probes run only with allowDestructive: true (use a disposable database)
     */
    async run(options) {
        this.validate(options);
        const timeoutMs = options.timeoutMs ?? 5000;
        const loginPath = options.loginPath ?? '/api/auth/login';
        const tokenField = options.tokenField ?? 'token';
        const findings = [];
        const skipped = [];
        let checks = 0;
        const request = async (path, init = {}) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(options.baseUrl.replace(/\/$/, '') + path, {
                    method: init.method ?? 'GET',
                    headers: {
                        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
                        ...(init.body ? { 'content-type': 'application/json' } : {}),
                    },
                    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
                    signal: controller.signal,
                });
                const text = await res.text();
                let json = null;
                try {
                    json = JSON.parse(text);
                }
                catch { /* non-JSON is fine */ }
                return { status: res.status, json, text };
            }
            finally {
                clearTimeout(timer);
            }
        };
        // ── 1. Log in every identity ──────────────────────────────────────────
        const sessions = [];
        for (const identity of options.identities) {
            const res = await request(loginPath, {
                method: 'POST',
                body: { email: identity.email, password: identity.password },
            });
            const token = res.json?.[tokenField];
            if (!token) {
                // A failed login must never look like a clean run.
                skipped.push(`login failed for "${identity.label}" (${res.status}) — every check for it was skipped`);
                continue;
            }
            sessions.push({ identity, token, ids: new Map() });
        }
        const tenantSessions = sessions.filter((s) => !s.identity.crossTenant);
        if (tenantSessions.length < 2) {
            skipped.push('fewer than two tenant-scoped identities logged in — no cross-tenant replay was possible');
        }
        // ── 2. Discover endpoints ─────────────────────────────────────────────
        const paths = options.paths ?? (await this.discoverPaths(request, sessions[0]?.token, options.exclude));
        if (paths.length === 0) {
            skipped.push('no endpoints discovered — pass options.paths explicitly');
        }
        // ── 3. Unauthenticated probe ──────────────────────────────────────────
        for (const path of paths) {
            const res = await request(path);
            checks++;
            if (res.status === 200) {
                findings.push({
                    kind: 'unauthenticated-read',
                    actor: 'anonymous',
                    victim: 'any',
                    method: 'GET',
                    path,
                    status: res.status,
                    detail: 'Endpoint returned 200 with no credentials.',
                });
            }
        }
        // ── 4. Harvest ids each identity can legitimately see ─────────────────
        for (const session of sessions) {
            for (const path of paths) {
                const res = await request(path, { token: session.token });
                checks++;
                if (res.status !== 200)
                    continue;
                const ids = this.extractIds(res.json);
                if (ids.length)
                    session.ids.set(path, ids);
            }
        }
        // ── 5. Replay every id against every other tenant ─────────────────────
        // This is the matrix. It needs no per-app configuration because the ids
        // came from the app itself.
        for (const victim of tenantSessions) {
            for (const actor of tenantSessions) {
                if (actor.identity.label === victim.identity.label)
                    continue;
                for (const [path, ids] of victim.ids) {
                    const actorIds = new Set(actor.ids.get(path) ?? []);
                    // Only replay ids the actor should NOT already have.
                    const foreign = ids.filter((id) => !actorIds.has(id));
                    for (const id of foreign.slice(0, 3)) {
                        const target = `${path.replace(/\/$/, '')}/${id}`;
                        const read = await request(target, { token: actor.token });
                        checks++;
                        if (read.status === 200) {
                            findings.push({
                                kind: 'cross-tenant-read',
                                actor: actor.identity.label,
                                victim: victim.identity.label,
                                method: 'GET',
                                path: target,
                                status: read.status,
                                detail: `Returned 200 for a resource belonging to "${victim.identity.label}". Expected 404.`,
                            });
                        }
                        const write = await request(target, {
                            token: actor.token,
                            method: 'PATCH',
                            body: { __appkitVerify: true },
                        });
                        checks++;
                        // 400/422 means it got past scoping and died on validation — the
                        // row was reachable, which is the leak.
                        if (write.status === 200 || write.status === 400 || write.status === 422) {
                            findings.push({
                                kind: 'cross-tenant-write',
                                actor: actor.identity.label,
                                victim: victim.identity.label,
                                method: 'PATCH',
                                path: target,
                                status: write.status,
                                detail: write.status === 200
                                    ? `Modified a resource belonging to "${victim.identity.label}".`
                                    : `Reached validation on another tenant's row (${write.status}) instead of 404 — the row was found before it was rejected.`,
                            });
                        }
                    }
                }
            }
        }
        // Deletes run last: they mutate, so everything else observes clean state.
        // Opt-in only: when the app leaks, this really deletes the victim's row.
        for (const victim of options.allowDestructive ? tenantSessions : []) {
            for (const actor of tenantSessions) {
                if (actor.identity.label === victim.identity.label)
                    continue;
                for (const [path, ids] of victim.ids) {
                    const actorIds = new Set(actor.ids.get(path) ?? []);
                    const foreign = ids.filter((id) => !actorIds.has(id));
                    for (const id of foreign.slice(0, 1)) {
                        const target = `${path.replace(/\/$/, '')}/${id}`;
                        const res = await request(target, { token: actor.token, method: 'DELETE' });
                        checks++;
                        if (res.status === 200 || res.status === 204) {
                            findings.push({
                                kind: 'cross-tenant-delete',
                                actor: actor.identity.label,
                                victim: victim.identity.label,
                                method: 'DELETE',
                                path: target,
                                status: res.status,
                                detail: `DELETED a resource belonging to "${victim.identity.label}".`,
                            });
                        }
                    }
                }
            }
        }
        return {
            // A skip must never read as a pass. `ok` therefore requires that checks
            // actually ran and nothing was skipped — otherwise a CI gate asserting
            // report.ok would go green on an app the verifier never reached, which
            // is strictly worse than having no gate at all.
            ok: findings.length === 0 && checks > 0 && skipped.length === 0,
            checks,
            findings,
            probed: paths,
            harvested: Object.fromEntries(sessions.map((s) => [s.identity.label, [...s.ids.values()].reduce((n, ids) => n + ids.length, 0)])),
            skipped,
            destructive: options.allowDestructive === true,
        };
    }
    /**
     * Ask the FBCA api-router which features exist, then probe each list route.
     * Falls back to an empty list, which the caller sees as a `skipped` entry
     * rather than a silent pass.
     */
    async discoverPaths(request, token, exclude = []) {
        const res = await request('/api', { token });
        const endpoints = res.json?.endpoints?.features;
        if (!Array.isArray(endpoints))
            return [];
        const skip = ['health', 'auth', 'webhook', ...exclude];
        return endpoints
            .filter((p) => typeof p === 'string')
            .filter((p) => !skip.some((s) => p.includes(s)));
    }
    /**
     * Pull id-shaped strings out of a response, whatever its envelope.
     *
     * Handles `[...]`, `{ items: [...] }`, `{ clients: [...] }` and similar
     * without being told which key holds the collection — an app should not have
     * to describe its own response shape to be checked.
     */
    extractIds(json) {
        const ids = new Set();
        // Depth 6 covers the envelopes apps actually use — `{ page: { data:
        // { rows: [...] } } }` and friends — while still being bounded. Stopping
        // shallower silently loses coverage, and lost coverage that reports "no
        // leaks" is the exact failure this module exists to prevent.
        const visit = (node, depth) => {
            if (!node || depth > 6)
                return;
            if (Array.isArray(node)) {
                for (const item of node.slice(0, 50))
                    visit(item, depth + 1);
                return;
            }
            if (typeof node !== 'object')
                return;
            const id = node.id ?? node._id ?? node.uuid;
            if (typeof id === 'string' && ID_RE.test(id))
                ids.add(id);
            else if (typeof id === 'number')
                ids.add(String(id));
            for (const value of Object.values(node)) {
                if (Array.isArray(value) || (value && typeof value === 'object'))
                    visit(value, depth + 1);
            }
        };
        visit(json, 0);
        return [...ids];
    }
    validate(options) {
        if (!options?.baseUrl || typeof options.baseUrl !== 'string') {
            throw new Error(`[@bloomneo/appkit/verify] baseUrl is required. See: ${DOCS_URL}#usage`);
        }
        let host;
        try {
            host = new URL(options.baseUrl).hostname;
        }
        catch {
            throw new Error(`[@bloomneo/appkit/verify] baseUrl is not a valid URL: ${options.baseUrl}. See: ${DOCS_URL}#usage`);
        }
        const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) || host.endsWith('.localhost');
        if (!local && !options.allowRemote) {
            throw new Error(`[@bloomneo/appkit/verify] Refusing to probe ${host}: the verifier logs in as real users and replays ` +
                `writes against other tenants' rows. Point it at a local server, or pass allowRemote: true for a ` +
                `disposable staging deployment. See: ${DOCS_URL}#usage`);
        }
        if (!Array.isArray(options.identities) || options.identities.length < 2) {
            throw new Error(`[@bloomneo/appkit/verify] At least two identities are required — isolation is only ` +
                `observable by comparing tenants. See: ${DOCS_URL}#usage`);
        }
        for (const identity of options.identities) {
            if (!identity?.label || !identity.email || !identity.password) {
                throw new Error(`[@bloomneo/appkit/verify] Each identity needs label, email and password. See: ${DOCS_URL}#usage`);
            }
        }
    }
    /** Human-readable report, for CI logs. */
    format(report) {
        const lines = [];
        lines.push(`appkit verify — ${report.checks} checks across ${report.probed.length} endpoints`);
        for (const [label, count] of Object.entries(report.harvested)) {
            lines.push(`  harvested ${count} ids as ${label}`);
        }
        for (const skip of report.skipped)
            lines.push(`  ⚠️  skipped: ${skip}`);
        if (report.findings.length === 0) {
            if (report.skipped.length || report.checks === 0) {
                lines.push('  ❌ INCONCLUSIVE — no leaks found, but the run was incomplete (see skips above).');
                lines.push('     Treat this as a failure: nothing was proven.');
            }
            else {
                lines.push('  ✅ no tenant leaks found');
            }
            return lines.join('\n');
        }
        lines.push(`\n  ❌ ${report.findings.length} leak(s):`);
        for (const f of report.findings) {
            lines.push(`    [${f.kind}] ${f.method} ${f.path} → ${f.status}`);
            lines.push(`      ${f.actor} reached ${f.victim}'s data. ${f.detail}`);
        }
        return lines.join('\n');
    }
}
//# sourceMappingURL=verify.js.map