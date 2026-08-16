/**
 * Streamable-HTTP transport for MCP, with a bearer-token guard
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/transport.ts
 *
 * @llm-rule WHEN: Internal - mcp.router() composes this behind the OAuth layer
 * @llm-rule AVOID: Sharing one McpServer across requests - a session would pin a worker
 * @llm-rule NOTE: Stateless by design, so any worker in a cluster can serve any request
 *
 * A fresh McpServer + transport are built per request and torn down when the
 * response closes (sessionIdGenerator: undefined). No session lives in memory,
 * which is the same reason the OAuth layer issues stateless JWTs.
 *
 * Extracted from a production deployment serving a live claude.ai connector.
 */
export interface McpTransportConfig {
    /** Builds a fresh, fully-configured server for one request. */
    buildServer: (auth: {
        sub: string;
        scope: string;
    }) => any;
    /** Validate a bearer token; return the subject/scope or null. */
    verifyAccessToken: (token: string) => {
        sub: string;
        scope: string;
    } | null;
    /**
     * Absolute URL of the protected-resource metadata, advertised in the 401
     * WWW-Authenticate header so the client can discover the auth server.
     */
    resourceMetadataUrl: (req: any) => string;
}
export interface McpTransportPeers {
    Router: () => any;
    StreamableHTTPServerTransport: new (opts: {
        sessionIdGenerator: undefined;
    }) => any;
}
export declare function createMcpTransport(config: McpTransportConfig, peers: McpTransportPeers): any;
//# sourceMappingURL=transport.d.ts.map