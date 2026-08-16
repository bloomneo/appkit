/**
 * Lazy loaders for the MCP module's optional peers
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/peers.ts
 *
 * @llm-rule WHEN: Internal - mcp.router() calls these before building anything
 * @llm-rule AVOID: Importing express or the MCP SDK at module top level - both are OPTIONAL peers
 * @llm-rule NOTE: Every other appkit module stays importable without express; MCP must not break that
 */
import { McpError } from './mcp.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/mcp/README.md';
let expressModule = null;
let sdkModule = null;
/**
 * Load express. It's an optional peer for the whole package, so a consumer
 * who never mounts an HTTP surface never has to install it.
 */
export async function loadExpress() {
    if (expressModule)
        return expressModule;
    try {
        // `as string` keeps TS from resolving types for an optional peer that
        // consumers may not have installed (and that ships no bundled types).
        expressModule = await import('express');
        return expressModule;
    }
    catch (cause) {
        throw new McpError(`express is required to mount an MCP router. Install it: npm install express. See: ${DOCS_URL}#installation`, { code: 'MCP_MISSING_PEER', cause });
    }
}
/**
 * Load the MCP SDK. Optional peer: the protocol is still moving, so the SDK
 * owns the wire format and only apps that actually expose MCP pay for it.
 */
export async function loadMcpSdk() {
    if (sdkModule)
        return sdkModule;
    try {
        const [serverMod, transportMod] = await Promise.all([
            import('@modelcontextprotocol/sdk/server/mcp.js'),
            import('@modelcontextprotocol/sdk/server/streamableHttp.js'),
        ]);
        sdkModule = {
            McpServer: serverMod.McpServer,
            StreamableHTTPServerTransport: transportMod.StreamableHTTPServerTransport,
        };
        return sdkModule;
    }
    catch (cause) {
        throw new McpError(`@modelcontextprotocol/sdk is required to serve MCP. Install it: npm install @modelcontextprotocol/sdk. See: ${DOCS_URL}#installation`, { code: 'MCP_MISSING_PEER', cause });
    }
}
/** Test seam — lets the suite inject fakes instead of requiring the real peers. */
export function __setPeers(peers) {
    if (peers.express !== undefined)
        expressModule = peers.express;
    if (peers.sdk !== undefined)
        sdkModule = peers.sdk;
}
export function __resetPeers() {
    expressModule = null;
    sdkModule = null;
}
//# sourceMappingURL=peers.js.map