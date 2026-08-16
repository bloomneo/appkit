/**
 * Turn a Bloom app into an MCP server so agents can call its features directly
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/index.ts
 *
 * @llm-rule WHEN: An AI agent (claude.ai connector, Claude Desktop) needs to call your app
 * @llm-rule AVOID: Creating McpRegistryClass directly - always use mcpClass.get()
 * @llm-rule NOTE: Typical flow - mcpClass.get() → await mcp.discover(dir) → app.use('/mcp', await mcp.router({...}))
 * @llm-rule NOTE: Tools live in features/<name>/<name>.mcp.ts, mirroring <name>.route.ts
 */
import { McpRegistryClass, McpError } from './mcp.js';
import { createMcpOAuth, type McpOAuthConfig } from './oauth.js';
import { createMcpTransport } from './transport.js';
import { type DiscoveryResult } from './discovery.js';
import { type McpConfig } from './defaults.js';
import type { McpContext, McpInputSchema, McpTool, McpToolDescriptor } from './types.js';
export interface McpRouterOptions extends Omit<McpOAuthConfig, 'secret'> {
    /**
     * JWT signing secret for the OAuth artefacts (min 32 chars).
     * Defaults to BLOOM_MCP_OAUTH_SECRET, then BLOOM_AUTH_SECRET.
     */
    secret?: string;
    /**
     * Resolve the caller's `role.level` from the OAuth subject. Supply it to
     * enable per-tool `roles`; without it every registered tool is offered to
     * every authorised connection (gate entirely at authenticate()).
     */
    resolveRoles?: (sub: string) => Promise<string | null> | string | null;
}
export interface Mcp {
    register(tool: McpTool): void;
    registerAll(tools: McpTool[]): void;
    discover(featuresPath: string): Promise<DiscoveryResult>;
    list(): McpToolDescriptor[];
    getTools(): McpTool[];
    has(name: string): boolean;
    router(options: McpRouterOptions): Promise<any>;
    getConfig(): McpConfig;
    clear(): void;
}
/**
 * Get the MCP server - the only function you need to learn
 * @llm-rule WHEN: Exposing your app's features to an agent - this is your main entry point
 * @llm-rule AVOID: Creating McpRegistryClass directly - always use this function
 * @llm-rule NOTE: One registry per process; repeated calls return the same one
 */
declare function get(): Mcp;
/**
 * Drop the registry and configuration - essential for testing
 * @llm-rule WHEN: Testing MCP behaviour across different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function disconnectAll(): void;
/** Number of registered tools, for health checks. */
declare function getToolCount(): number;
export declare const mcpClass: {
    get: typeof get;
    disconnectAll: typeof disconnectAll;
    getToolCount: typeof getToolCount;
};
export { McpError, McpRegistryClass, createMcpOAuth, createMcpTransport };
export type { McpConfig, McpTool, McpToolDescriptor, McpContext, McpInputSchema, McpOAuthConfig, DiscoveryResult, };
//# sourceMappingURL=index.d.ts.map