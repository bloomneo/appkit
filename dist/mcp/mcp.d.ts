/**
 * Tool registry — validates tools and mounts them onto an SDK McpServer
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/mcp.ts
 *
 * @llm-rule WHEN: Internal - mcp.router() builds one server per request through here
 * @llm-rule AVOID: Registering a tool the caller has no role for - it should not be visible at all
 * @llm-rule NOTE: The SDK owns the wire format; this file owns which tools exist and who may see them
 */
import { AppKitError } from '../util/errors.js';
import type { McpTool, McpToolDescriptor } from './types.js';
export declare class McpError extends AppKitError {
    readonly code: string;
    constructor(message: string, options?: {
        code?: string;
        cause?: unknown;
    });
}
export declare class McpRegistryClass {
    private readonly tools;
    /**
     * Register one tool. Later registrations of the same name replace earlier
     * ones — last writer wins, so a project can override a discovered tool.
     */
    register(tool: McpTool): void;
    registerAll(tools: McpTool[]): void;
    getTools(): McpTool[];
    has(name: string): boolean;
    count(): number;
    clear(): void;
    /** Plain descriptors, for health checks and debugging. */
    list(): McpToolDescriptor[];
    /**
     * Which tools a caller with this role.level may use.
     *
     * A null roleLevel means "no role resolution configured" — every tool is
     * allowed, which matches a deployment that gates entirely at OAuth consent.
     */
    visibleTo(roleLevel: string | null): McpTool[];
    /**
     * Build an SDK McpServer carrying exactly the tools this caller may use.
     *
     * Tools the caller has no role for are never registered, so they don't
     * appear in tools/list either — the agent never sees a tool it would only
     * be refused on. That's strictly better than erroring at call time.
     */
    buildServer(McpServer: new (info: {
        name: string;
        version: string;
    }) => any, options: {
        name: string;
        version: string;
        roleLevel: string | null;
        ctx: Record<string, any>;
    }): any;
}
//# sourceMappingURL=mcp.d.ts.map