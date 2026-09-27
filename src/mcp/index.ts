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
import { tenantModeOn } from '../database/tenancy.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/mcp/README.md';

let globalConfig: McpConfig | null = null;
let registry: McpRegistryClass | null = null;

export interface McpRouterOptions extends Omit<McpOAuthConfig, 'secret' | 'mountPath'> {
  /**
   * JWT signing secret for the OAuth artefacts (min 32 chars).
   * Defaults to BLOOM_MCP_OAUTH_SECRET, then BLOOM_AUTH_SECRET.
   */
  secret?: string;
  /** Path you will mount the MCP router at. Default '/mcp'. */
  mountPath?: string;
  /**
   * REQUIRED: the caller's `role.level` from the OAuth subject, read on every
   * request so a role change applies on the next call. Every tool declares
   * roles; a caller resolved to null sees no tools.
   */
  resolveRoles: (sub: string) => Promise<string | null> | string | null;
  /**
   * The caller's tenant from the OAuth subject. Tools run inside it, so their
   * database calls are scoped like a route's. Required when BLOOM_DB_TENANT is
   * on; return null for a caller with no tenant (their tools must use
   * database.bypass(reason, fn)).
   */
  resolveTenant?: (sub: string) => Promise<string | null> | string | null;
}

export interface McpRouters {
  /**
   * Mount at the ROOT, **before** any SPA/catch-all route.
   *
   * RFC 8414/9728 clients — claude.ai among them — probe the metadata at the
   * root with the mount path inserted (`/.well-known/oauth-authorization-server/mcp`),
   * NOT under the mount. If those paths fall through to an SPA the client gets
   * HTML and reports "couldn't register", even though `/mcp/register` works
   * when called directly. Behind a reverse proxy, route `/.well-known/oauth-*`
   * to the app too.
   */
  wellKnown: any;
  /** Mount at `mountPath` (default '/mcp'). OAuth endpoints + guarded transport. */
  mcp: any;
}

export interface Mcp {
  register(tool: McpTool): void;
  registerAll(tools: McpTool[]): void;
  discover(featuresPath: string): Promise<DiscoveryResult>;
  list(): McpToolDescriptor[];
  getTools(): McpTool[];
  has(name: string): boolean;
  routers(options: McpRouterOptions): Promise<McpRouters>;
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
    routers: async (options: McpRouterOptions): Promise<McpRouters> => {
      const secret =
        options.secret ?? process.env.BLOOM_MCP_OAUTH_SECRET ?? process.env.BLOOM_AUTH_SECRET ?? '';
      const mountPath = options.mountPath ?? '/mcp';

      // The same rules a route contract enforces: an auth decision for every
      // tool, and a tenant for every call when the app is multi-tenant.
      if (typeof options.resolveRoles !== 'function') {
        throw new McpError(
          `mcp.routers() needs resolveRoles(sub) → 'role.level' — tool roles cannot be enforced without it. See: ${DOCS_URL}#authorization`,
          { code: 'MCP_NO_ROLE_RESOLVER' }
        );
      }
      if (tenantModeOn() && typeof options.resolveTenant !== 'function') {
        throw new McpError(
          `BLOOM_DB_TENANT is on, so mcp.routers() needs resolveTenant(sub) → tenant id (or null for staff): tools run inside the caller's tenant. See: ${DOCS_URL}#tenants`,
          { code: 'MCP_NO_TENANT_RESOLVER' }
        );
      }

      const [express, sdk] = await Promise.all([loadExpress(), loadMcpSdk()]);
      const Router = () => (express.Router ?? express.default?.Router)();

      const oauth = createMcpOAuth({ ...options, secret, mountPath }, Router);

      // Roles are resolved by middleware before the transport runs, because
      // the SDK needs the server built synchronously but resolveRoles is async.
      // Keyed by subject and overwritten on every request, so a role change
      // takes effect on the next call rather than being pinned for the
      // connection's lifetime.
      const roleCache = new Map<string, string | null>();
      const tenantCache = new Map<string, string | null>();

      const transport = createMcpTransport(
        {
          verifyAccessToken: oauth.verifyAccessToken,
          resourceMetadataUrl: (req: any) =>
            `${oauth.resourceUrl(req).replace(/\/$/, '')}/.well-known/oauth-protected-resource`,
          buildServer: (auth) => {
            const roleLevel = roleCache.get(auth.sub) ?? null;
            const tenantId = tenantCache.get(auth.sub) ?? null;
            return reg.buildServer(sdk.McpServer, {
              name: config.name,
              version: config.version,
              roleLevel,
              ctx: { sub: auth.sub, scope: auth.scope, roleLevel, tenantId } satisfies McpContext,
            });
          },
        },
        { Router, StreamableHTTPServerTransport: sdk.StreamableHTTPServerTransport }
      );

      const resolveMiddleware = async (req: any, _res: any, next: any) => {
        const header = req?.headers?.authorization;
        const token = typeof header === 'string' && /^Bearer\s+/i.test(header)
          ? header.replace(/^Bearer\s+/i, '').trim()
          : null;
        const auth = token ? oauth.verifyAccessToken(token) : null;
        if (!auth) return next();
        // A resolver that throws leaves the caller with no role (no tools)
        // and no tenant (queries fail closed) — never with the last value.
        try {
          roleCache.set(auth.sub, (await options.resolveRoles(auth.sub)) ?? null);
        } catch {
          roleCache.set(auth.sub, null);
        }
        try {
          const tenant = options.resolveTenant ? await options.resolveTenant(auth.sub) : null;
          tenantCache.set(auth.sub, tenant === null || tenant === undefined ? null : String(tenant));
        } catch {
          tenantCache.set(auth.sub, null);
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
function disconnectAll(): void {
  registry?.clear();
  registry = null;
  globalConfig = null;
}

/**
 * Rebuild configuration from the environment, dropping registered tools
 * @llm-rule WHEN: Testing MCP behaviour across different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 * @llm-rule NOTE: Same contract as cacheClass.reset() / queueClass.reset()
 */
function reset(): Mcp {
  disconnectAll();
  return get();
}

/** Number of registered tools, for health checks. */
function getToolCount(): number {
  return registry ? registry.count() : 0;
}

export const mcpClass = {
  get,
  reset,
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
