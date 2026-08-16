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
export interface McpOAuthConfig {
    /** HMAC secret for signing every JWT this module issues. Minimum 32 chars. */
    secret: string;
    /**
     * Absolute base URL this OAuth server is mounted at, e.g.
     * https://example.com/mcp — used to build the metadata endpoints.
     * When omitted, derived per-request from forwarded headers.
     */
    issuer?: string;
    /** Absolute URL of the protected MCP endpoint (the resource). */
    resource?: string;
    /** Human label shown on the consent screen. */
    serviceName: string;
    /**
     * Verify credentials at consent time. Return a stable subject id (+ label)
     * on success, or null to reject. This is the ONLY app-specific hook.
     *
     * Gate on role here — a connection is exactly as privileged as whatever
     * this returns, so returning null for non-admins is how you keep an agent
     * from inheriting more reach than you intended.
     */
    authenticate: (email: string, password: string) => Promise<{
        sub: string;
        label?: string;
    } | null>;
    /** OAuth scope granted to a successful login. Default 'mcp'. */
    scope?: string;
}
export interface McpOAuth {
    router: any;
    verifyAccessToken: (token: string) => {
        sub: string;
        scope: string;
    } | null;
    resourceUrl: (req: any) => string;
}
/**
 * Build the OAuth router. `Router` is injected rather than imported so this
 * file stays loadable without express — see peers.ts.
 */
export declare function createMcpOAuth(config: McpOAuthConfig, Router: () => any): McpOAuth;
//# sourceMappingURL=oauth.d.ts.map