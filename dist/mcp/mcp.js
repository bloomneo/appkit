/**
 * Tool registry — validates tools and mounts them onto an SDK McpServer
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/mcp.ts
 *
 * @llm-rule WHEN: Internal - mcp.router() builds one server per request through here
 * @llm-rule AVOID: Registering a tool the caller has no role for - it should not be visible at all
 * @llm-rule NOTE: The SDK owns the wire format; this file owns which tools exist and who may see them
 */
import { authClass } from '../auth/index.js';
import { AppKitError } from '../util/errors.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/mcp/README.md';
export class McpError extends AppKitError {
    code;
    constructor(message, options) {
        super(message, {
            module: 'mcp',
            code: options?.code ?? 'MCP_ERROR',
            cause: options?.cause,
        });
        this.name = 'McpError';
        this.code = options?.code ?? 'MCP_ERROR';
    }
}
export class McpRegistryClass {
    tools = new Map();
    /**
     * Register one tool. Later registrations of the same name replace earlier
     * ones — last writer wins, so a project can override a discovered tool.
     */
    register(tool) {
        if (!tool || typeof tool !== 'object') {
            throw new McpError(`Tool must be an object. See: ${DOCS_URL}#declaring-tools`, { code: 'MCP_INVALID_TOOL' });
        }
        if (!tool.name || typeof tool.name !== 'string') {
            throw new McpError(`Tool.name is required and must be a string. See: ${DOCS_URL}#declaring-tools`, {
                code: 'MCP_INVALID_TOOL',
            });
        }
        // Clients map tool names onto function identifiers; anything outside this
        // set breaks them.
        if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
            throw new McpError(`Tool name "${tool.name}" may only contain letters, numbers, underscore and hyphen. See: ${DOCS_URL}#declaring-tools`, { code: 'MCP_INVALID_TOOL' });
        }
        if (!tool.description || typeof tool.description !== 'string') {
            throw new McpError(`Tool "${tool.name}" needs a description — it is the only thing the agent sees when choosing. See: ${DOCS_URL}#declaring-tools`, { code: 'MCP_INVALID_TOOL' });
        }
        if (typeof tool.handler !== 'function') {
            throw new McpError(`Tool "${tool.name}" needs a handler function. See: ${DOCS_URL}#declaring-tools`, {
                code: 'MCP_INVALID_TOOL',
            });
        }
        this.tools.set(tool.name, tool);
    }
    registerAll(tools) {
        if (!Array.isArray(tools)) {
            throw new McpError(`registerAll expects an array of tools. See: ${DOCS_URL}#declaring-tools`, {
                code: 'MCP_INVALID_TOOL',
            });
        }
        for (const tool of tools)
            this.register(tool);
    }
    getTools() {
        return [...this.tools.values()];
    }
    has(name) {
        return this.tools.has(name);
    }
    count() {
        return this.tools.size;
    }
    clear() {
        this.tools.clear();
    }
    /** Plain descriptors, for health checks and debugging. */
    list() {
        return this.getTools().map(({ name, description }) => ({ name, description }));
    }
    /**
     * Which tools a caller with this role.level may use.
     *
     * A null roleLevel means "no role resolution configured" — every tool is
     * allowed, which matches a deployment that gates entirely at OAuth consent.
     */
    visibleTo(roleLevel) {
        if (roleLevel === null)
            return this.getTools();
        const auth = authClass.get();
        return this.getTools().filter((tool) => !tool.roles?.length || tool.roles.some((required) => auth.hasRole(roleLevel, required)));
    }
    /**
     * Build an SDK McpServer carrying exactly the tools this caller may use.
     *
     * Tools the caller has no role for are never registered, so they don't
     * appear in tools/list either — the agent never sees a tool it would only
     * be refused on. That's strictly better than erroring at call time.
     */
    buildServer(McpServer, options) {
        const server = new McpServer({ name: options.name, version: options.version });
        for (const tool of this.visibleTo(options.roleLevel)) {
            server.registerTool(tool.name, {
                title: tool.title ?? tool.name,
                description: tool.description,
                ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
            }, async (args) => {
                try {
                    const result = await tool.handler(args ?? {}, options.ctx);
                    // A tool may return an SDK-shaped result itself; pass it straight
                    // through rather than double-wrapping it.
                    if (result && typeof result === 'object' && Array.isArray(result.content)) {
                        return result;
                    }
                    return {
                        content: [
                            { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result ?? null) },
                        ],
                    };
                }
                catch (err) {
                    // Surface the failure to the agent instead of breaking the
                    // connection — it can retry or pick a different tool.
                    return {
                        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
                        isError: true,
                    };
                }
            });
        }
        return server;
    }
}
//# sourceMappingURL=mcp.js.map