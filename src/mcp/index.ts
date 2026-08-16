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
import { discoverTools, type DiscoveryResult } from './discovery.js';
import { loadExpress, loadMcpSdk } from './peers.js';
import { getSmartDefaults, type McpConfig } from './defaults.js';
import { loggerClass } from '../logger/index.js';
import type { McpContext, McpInputSchema, McpTool, McpToolDescriptor } from './types.js';

let globalConfig: McpConfig | null = null;
let registry: McpRegistryClass | null = null;

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

function ensure(): { config: McpConfig; registry: McpRegistryClass } {
  if (!globalConfig) globalConfig = getSmartDefaults();
  if (!registry) registry = new McpRegistryClass();
  return { config: globalConfig, registry };
}

/**
 * Get the MCP server - the only function you need to learn
 * @llm-rule WHEN: Exposing your app's features to an agent - this is your main entry point
 * @llm-rule AVOID: Creating McpRegistryClass directly - always use this function
 * @llm-rule NOTE: One registry per process; repeated calls return the same one
 */
function get(): Mcp {
  const { config, registry: reg } = ensure();

  return {
    register: (tool) => reg.register(tool),
    registerAll: (tools) => reg.registerAll(tools),

    /**
     * Auto-register every tool declared under a features directory.
     * Load failures are logged and returned, never thrown — one broken
     * feature must not cost you the rest of the tool surface.
     */
    discover: async (featuresPath: string) => {
      const logger = loggerClass.get('mcp');
      const result = await discoverTools(featuresPath);

      for (const tool of result.tools) {
        try {
          reg.register(tool);
        } catch (error) {
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
        logger.error(
          `❌ Failed to load MCP tools for "${failure.feature}":\n   ${failure.error}\n   File: ${failure.file}`,
          failure
        );
      }

      return result;
    },

    list: () => reg.list(),
    getTools: () => reg.getTools(),
    has: (name) => reg.has(name),

    /**
     * The whole /mcp surface: OAuth authorization server + guarded transport.
     *
     * ```ts
     * app.use('/mcp', await mcp.router({
     *   serviceName: 'My App',
     *   authenticate: async (email, password) => { ... },
     * }));
     * ```
     *
     * Async because express and the MCP SDK are optional peers — a missing one
     * fails here, at boot, rather than on the first agent request.
     */
    router: async (options: McpRouterOptions) => {
      const secret =
        options.secret ?? process.env.BLOOM_MCP_OAUTH_SECRET ?? process.env.BLOOM_AUTH_SECRET ?? '';

      const [express, sdk] = await Promise.all([loadExpress(), loadMcpSdk()]);
      const Router = () => (express.Router ?? express.default?.Router)();

      const oauth = createMcpOAuth({ ...options, secret }, Router);

      // Roles are resolved by middleware before the transport runs, because
      // the SDK needs the server built synchronously but resolveRoles is async.
      // Keyed by subject and overwritten on every request, so a role change
      // takes effect on the next call rather than being pinned for the
      // connection's lifetime.
      const roleCache = new Map<string, string | null>();

      const transport = createMcpTransport(
        {
          verifyAccessToken: oauth.verifyAccessToken,
          resourceMetadataUrl: (req: any) =>
            `${oauth.resourceUrl(req).replace(/\/$/, '')}/.well-known/oauth-protected-resource`,
          buildServer: (auth) => {
            const roleLevel = roleCache.get(auth.sub) ?? null;
            return reg.buildServer(sdk.McpServer, {
              name: config.name,
              version: config.version,
              roleLevel: options.resolveRoles ? roleLevel : null,
              ctx: { sub: auth.sub, scope: auth.scope, roleLevel } satisfies McpContext,
            });
          },
        },
        { Router, StreamableHTTPServerTransport: sdk.StreamableHTTPServerTransport }
      );

      const resolveMiddleware = async (req: any, _res: any, next: any) => {
        if (!options.resolveRoles) return next();
        const header = req?.headers?.authorization;
        const token = typeof header === 'string' && /^Bearer\s+/i.test(header)
          ? header.replace(/^Bearer\s+/i, '').trim()
          : null;
        const auth = token ? oauth.verifyAccessToken(token) : null;
        if (!auth) return next();
        try {
          roleCache.set(auth.sub, (await options.resolveRoles(auth.sub)) ?? null);
        } catch {
          roleCache.set(auth.sub, null);
        }
        next();
      };

      const router = Router();
      router.use(oauth.router);
      router.use(resolveMiddleware);
      router.use(transport);
      return router;
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
function disconnectAll(): void {
  registry?.clear();
  registry = null;
  globalConfig = null;
}

/** Number of registered tools, for health checks. */
function getToolCount(): number {
  return registry ? registry.count() : 0;
}

export const mcpClass = {
  get,
  disconnectAll,
  getToolCount,
};

export { McpError, McpRegistryClass, createMcpOAuth, createMcpTransport };
export type {
  McpConfig,
  McpTool,
  McpToolDescriptor,
  McpContext,
  McpInputSchema,
  McpOAuthConfig,
  DiscoveryResult,
};
