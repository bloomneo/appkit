/**
 * FBCA tool discovery — the same convention api-router uses, for MCP tools
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/discovery.ts
 *
 * @llm-rule WHEN: You want every feature's tools registered without a manifest
 * @llm-rule AVOID: Importing feature .mcp.ts files by hand - that is the manifest you were avoiding
 * @llm-rule NOTE: Convention is features/<name>/<name>.mcp.ts, mirroring <name>.route.ts
 */
import type { McpTool } from './types.js';
export interface DiscoveryResult {
    tools: McpTool[];
    /** Features that had a .mcp.ts file which failed to load, with the reason. */
    failures: Array<{
        feature: string;
        file: string;
        error: string;
    }>;
    /** Features scanned that simply had no .mcp.ts — not an error. */
    skipped: string[];
}
/**
 * Scan a features directory and collect every declared tool.
 *
 * A feature whose tool file throws is recorded in `failures` rather than
 * aborting the scan — one broken feature shouldn't cost you every other
 * feature's tools, the same way api-router keeps mounting after a bad route.
 */
export declare function discoverTools(featuresPath: string): Promise<DiscoveryResult>;
//# sourceMappingURL=discovery.d.ts.map