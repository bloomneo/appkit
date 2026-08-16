/**
 * Environment-driven defaults for the MCP module
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/defaults.ts
 *
 * @llm-rule WHEN: App startup - resolving MCP server identity and auth posture
 * @llm-rule AVOID: Reading process.env for MCP settings elsewhere - it all funnels through here
 * @llm-rule NOTE: BLOOM_MCP_REQUIRE_AUTH defaults to true; an unauthenticated MCP endpoint is an open API
 */
export interface McpConfig {
    /** Server name reported during initialize. */
    name: string;
    /** Server version reported during initialize. */
    version: string;
    /**
     * Protocol version echoed to clients that don't request one. The dispatcher
     * echoes the client's requested version when it supplies one, per spec.
     */
    protocolVersion: string;
    /**
     * When true (default), any tool call without a verifiable login token is
     * rejected — even tools that declare no roles. Turn it off only for a
     * local, non-networked stdio server.
     */
    requireAuth: boolean;
    /** Directory scanned by mcp.discover() when no path is passed. */
    featuresDir: string;
}
export declare function getSmartDefaults(): McpConfig;
//# sourceMappingURL=defaults.d.ts.map