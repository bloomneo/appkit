/**
 * Lazy loaders for the MCP module's optional peers
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/peers.ts
 *
 * @llm-rule WHEN: Internal - mcp.router() calls these before building anything
 * @llm-rule AVOID: Importing express or the MCP SDK at module top level - both are OPTIONAL peers
 * @llm-rule NOTE: Every other appkit module stays importable without express; MCP must not break that
 */
declare let sdkModule: {
    McpServer: any;
    StreamableHTTPServerTransport: any;
} | null;
/**
 * Load express. It's an optional peer for the whole package, so a consumer
 * who never mounts an HTTP surface never has to install it.
 */
export declare function loadExpress(): Promise<any>;
/**
 * Load the MCP SDK. Optional peer: the protocol is still moving, so the SDK
 * owns the wire format and only apps that actually expose MCP pay for it.
 */
export declare function loadMcpSdk(): Promise<{
    McpServer: any;
    StreamableHTTPServerTransport: any;
}>;
/** Test seam — lets the suite inject fakes instead of requiring the real peers. */
export declare function __setPeers(peers: {
    express?: any;
    sdk?: typeof sdkModule;
}): void;
export declare function __resetPeers(): void;
export {};
//# sourceMappingURL=peers.d.ts.map