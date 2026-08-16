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
import { createMcpOAuth } from './oauth.js';
import { createMcpTransport } from './transport.js';
import { discoverTools } from './discovery.js';
import { loadExpress, loadMcpSdk } from './peers.js';
import { getSmartDefaults } from './defaults.js';
import { loggerClass } from '../logger/index.js';
let globalConfig = null;
let registry = null;
function ensure() {
    if (!globalConfig)
        globalConfig = getSmartDefaults();
    if (!registry)
        registry = new McpRegistryClass();
    return { config: globalConfig, registry };
}
/**
 * Get the MCP server - the only function you need to learn
 * @llm-rule WHEN: Exposing your app's features to an agent - this is your main entry point
 * @llm-rule AVOID: Creating McpRegistryClass directly - always use this function
 * @llm-rule NOTE: One registry per process; repeated calls return the same one
 */
function get() {
    const { config, registry: reg } = ensure();
    return {
        register: (tool) => reg.register(tool),
        registerAll: (tools) => reg.registerAll(tools),
        /**
         * Auto-register every tool declared under a features directory.
         * Load failures are logged and returned, never thrown — one broken
         * feature must not cost you the rest of the tool surface.
         */
        discover: async (featuresPath) => {
            const logger = loggerClass.get('mcp');
            const result = await discoverTools(featuresPath);
            for (const tool of result.tools) {
                try {
                    reg.register(tool);
                }
                catch (error) {
                    result.failures.push({
                        feature: tool.name,
                        file: featuresPath,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            logger.info(`🔧 MCP tools discovered: ${reg.count()}`, {
                registered: reg.count(),
                failures: result.failures.length,
            });
            for (const failure of result.failures) {
                logger.error(`❌ Failed to load MCP tools for "${failure.feature}":\n   ${failure.error}\n   File: ${failure.file}`, failure);
            }
            return result;
        },
        list: () => reg.list(),
        getTools: () => reg.getTools(),
        has: (name) => reg.has(name),
        /**
         * Both routers the MCP surface needs, built from one config so they can
         * never drift apart.
         *
         * ```ts
         * const { wellKnown, mcp: mcpRouter } = await mcp.routers({
         *   serviceName: 'My App',
         *   authenticate: async (email, password) => { ... },
         * });
         *
         * app.use(wellKnown);          // ROOT, before the SPA catch-all
         * app.use('/mcp', mcpRouter);
         * ```
         *
         * Two mounts rather than one because RFC 8414/9728 clients probe the
         * metadata at the root, not under the mount — see McpRouters.wellKnown.
         *
         * Async because express and the MCP SDK are optional peers — a missing one
         * fails here, at boot, rather than on the first agent request.
         */
        routers: async (options) => {
            const secret = options.secret ?? process.env.BLOOM_MCP_OAUTH_SECRET ?? process.env.BLOOM_AUTH_SECRET ?? '';
            const mountPath = options.mountPath ?? '/mcp';
            const [express, sdk] = await Promise.all([loadExpress(), loadMcpSdk()]);
            const Router = () => (express.Router ?? express.default?.Router)();
            const oauth = createMcpOAuth({ ...options, secret, mountPath }, Router);
            // Roles are resolved by middleware before the transport runs, because
            // the SDK needs the server built synchronously but resolveRoles is async.
            // Keyed by subject and overwritten on every request, so a role change
            // takes effect on the next call rather than being pinned for the
            // connection's lifetime.
            const roleCache = new Map();
            const transport = createMcpTransport({
                verifyAccessToken: oauth.verifyAccessToken,
                resourceMetadataUrl: (req) => `${oauth.resourceUrl(req).replace(/\/$/, '')}/.well-known/oauth-protected-resource`,
                buildServer: (auth) => {
                    const roleLevel = roleCache.get(auth.sub) ?? null;
                    return reg.buildServer(sdk.McpServer, {
                        name: config.name,
                        version: config.version,
                        roleLevel: options.resolveRoles ? roleLevel : null,
                        ctx: { sub: auth.sub, scope: auth.scope, roleLevel },
                    });
                },
            }, { Router, StreamableHTTPServerTransport: sdk.StreamableHTTPServerTransport });
            const resolveMiddleware = async (req, _res, next) => {
                if (!options.resolveRoles)
                    return next();
                const header = req?.headers?.authorization;
                const token = typeof header === 'string' && /^Bearer\s+/i.test(header)
                    ? header.replace(/^Bearer\s+/i, '').trim()
                    : null;
                const auth = token ? oauth.verifyAccessToken(token) : null;
                if (!auth)
                    return next();
                try {
                    roleCache.set(auth.sub, (await options.resolveRoles(auth.sub)) ?? null);
                }
                catch {
                    roleCache.set(auth.sub, null);
                }
                next();
            };
            const mcpRouter = Router();
            mcpRouter.use(oauth.router);
            mcpRouter.use(resolveMiddleware);
            mcpRouter.use(transport);
            // Root discovery. Both the bare path and the mount-suffixed variant,
            // because clients differ on which they probe.
            const wellKnown = Router();
            const suffix = mountPath.startsWith('/') ? mountPath : `/${mountPath}`;
            for (const s of ['', suffix]) {
                wellKnown.get(`/.well-known/oauth-authorization-server${s}`, oauth.authServerMetadata);
                wellKnown.get(`/.well-known/oauth-protected-resource${s}`, oauth.protectedResourceMetadata);
            }
            return { wellKnown, mcp: mcpRouter };
        },
        getConfig: () => ({ ...config }),
        clear: () => reg.clear(),
    };
}
/**
 * Drop the registry and configuration - essential for testing
 * @llm-rule WHEN: Testing MCP behaviour across different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function disconnectAll() {
    registry?.clear();
    registry = null;
    globalConfig = null;
}
/** Number of registered tools, for health checks. */
function getToolCount() {
    return registry ? registry.count() : 0;
}
export const mcpClass = {
    get,
    disconnectAll,
    getToolCount,
};
export { McpError, McpRegistryClass, createMcpOAuth, createMcpTransport };
//# sourceMappingURL=index.js.map