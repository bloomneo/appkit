/**
 * Ultra-simple Prisma database API with tenant scoping and smart connection management
 * @module @bloomneo/appkit/database
 * @file src/database/index.ts
 * 
 * @llm-rule WHEN: ALWAYS add tenant_id text field to ALL tables (nullable for future compatibility)
 * @llm-rule NOTE: tenant_id = null (single tenant) or "team-1" (multi-tenant)
 * @llm-rule VARIABLE: const db = await databaseClass.get() - user's data (single or tenant-filtered)
 * @llm-rule VARIABLE: const rows = await databaseClass.tenant(req, db => db.x.findMany()) - tenant-scoped
 */

import { PrismaAdapter } from './adapters/prisma.js';
import { DatabaseError } from './errors.js';
import {
  tenantStore,
  tenantModeOn,
  rlsModeOn,
  tenantColumn,
  withRlsContext,
  reportBypass,
  onBypass,
  currentTenant,
  rlsPolicySql,
  rlsPolicyStatements,
  BYPASS_TOKEN,
} from './tenancy.js';

export {
  onBypass,
  currentTenant,
  rlsPolicySql,
  rlsPolicyStatements,
  BYPASS_TOKEN,
  tenantStore,
} from './tenancy.js';
export type { TenantContext, BypassListener, RlsPolicyOptions } from './tenancy.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/database/README.md';

export { DatabaseError } from './errors.js';

// Type definitions for database clients
interface DatabaseClient {
  _appKit?: boolean;
  _tenantId?: string;
  _url?: string;
  [key: string]: any;
}

interface PrismaClient extends DatabaseClient {
  $queryRaw?: any;
  $disconnect: () => Promise<void>;
  $connect: () => Promise<void>;
  $use?: (middleware: any) => void;
}

type DatabaseClientUnion = PrismaClient;

interface DatabaseAdapter {
  createClient: (config: any) => Promise<DatabaseClientUnion>;
  applyTenantMiddleware?: (client: any, tenantId: string, options?: any) => Promise<any>;
  disconnect: () => Promise<void>;
}

// Global instances cache for performance
const connections = new Map<string, DatabaseClientUnion>();

// One-shot warn flag so the tenant-filter hint only fires once per process.
let _tenantHintWarned = false;

/**
 * Resolve the tenant for a request.
 *
 * 6.0: only the verified login token counts — `req.user.tenantId`, or the
 * pre-4.2 `tenant_id` shape. Headers, route params, query strings and
 * subdomains are caller-controlled, so reading them let any client pick its
 * own tenant.
 */
function detectTenant(req?: any): string | null {
  if (!req) return null;
  if (!tenantModeOn()) return null;

  return req.user?.tenantId || req.user?.tenant_id || null;
}

/**
 * Create database client with caching
 */
async function createClient(url: string, tenantId: string | null = null): Promise<DatabaseClientUnion> {
  const cacheKey = `${url}_${tenantId || 'null'}_`;
  
  if (connections.has(cacheKey)) {
    return connections.get(cacheKey)!;
  }
  
  try {
    const adapter: DatabaseAdapter = new PrismaAdapter({ url });
    
    // Create client
    let client: any = await adapter.createClient({ url });
    
    // Apply tenant middleware if needed
    if (tenantId && adapter.applyTenantMiddleware) {
      client = await adapter.applyTenantMiddleware(client, tenantId, {
        fieldName: 'tenant_id',
      });
    }
    
    // Add metadata
    client._appKit = true;
    client._tenantId = tenantId || undefined;
    client._url = url;
    
    // Cache connection
    connections.set(cacheKey, client);
    
    return client;
  } catch (error: any) {
    throw new DatabaseError(
      `[@bloomneo/appkit/database] Failed to create database connection: ${error.message}. See: ${DOCS_URL}#troubleshooting`,
      { code: 'DATABASE_CONNECT_FAILED', cause: error },
    );
  }
}

// One client per database URL serves every tenant: the tenant for each
// operation comes from the request context (tenantStore), not the client.
const contextClients = new Map<string, Promise<DatabaseClientUnion>>();

function contextClient(url: string): Promise<DatabaseClientUnion> {
  let pending = contextClients.get(url);
  if (!pending) {
    pending = (async () => {
      const adapter = new PrismaAdapter({ url });
      const base: any = await adapter.createClient({ url });
      let client: any = await adapter.applyTenantMiddleware(
        base,
        () => {
          const ctx = tenantStore.getStore();
          if (!ctx) return {};
          if (ctx.bypassReason) return { bypass: true };
          return { tenantId: ctx.tenantId };
        },
        { fieldName: tenantColumn() },
      );
      if (rlsModeOn()) client = withRlsContext(client);
      client._appKit = true;
      client._url = url;
      return client;
    })();
    // A failed connection must not be cached forever.
    pending.catch(() => contextClients.delete(url));
    contextClients.set(url, pending);
  }
  return pending;
}

function requireUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new DatabaseError(
      `[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`,
      { code: 'DATABASE_MISSING_URL' },
    );
  }
  return url;
}

/**
 * Main database API - ultra-simple like auth module
 */
export const databaseClass = {
  /**
   * Get database client - main function that handles all contexts
   * @param {Object} [req] - Request object for context detection
   * @returns {Promise<DatabaseClientUnion>} Database client
   */
  async get(req: any = null): Promise<DatabaseClientUnion> {
    // Setup env watching on first use

    // Tenant-filter safety net: if BLOOM_DB_TENANT isn't set, warn once
    // per process. If a consumer's schema has tenant_id columns and they
    // forgot the env var, every query silently returns unfiltered data —
    // the #1 prod risk pre-4.0.0. One-line nudge at boot time.
    if (!_tenantHintWarned && process.env.BLOOM_DB_TENANT === undefined) {
      _tenantHintWarned = true;
      console.warn(
        `[@bloomneo/appkit/database] BLOOM_DB_TENANT is not set. If your schema ` +
          `has tenant_id columns, set BLOOM_DB_TENANT=auto to enable automatic ` +
          `row-level filtering. Set BLOOM_DB_TENANT=false to silence this. ` +
          `See: ${DOCS_URL}#multi-tenant-mode`,
      );
    }

    // Inside database.tenant(), database.bypass() or behind database.context(),
    // the shared context client is already scoped to this request.
    if (tenantModeOn() && currentTenant()) {
      return await contextClient(requireUrl());
    }

    const tenantId = detectTenant(req);

    // 5.0: in tenant mode, get() may no longer hand back an unscoped client.
    //
    // Pre-5.0 this returned every row whenever a tenant failed to resolve —
    // a call site that forgot to pass `req`, or a token missing the claim,
    // leaked the whole table and looked like it worked. A production audit
    // found 4 of 44 route files in exactly that state. Failing closed turns a
    // silent leak into a loud error at the one call site responsible.
    //
    // Deliberate cross-tenant work goes through bypass(), which is greppable.
    const tenantMode = tenantModeOn();
    if (tenantMode && !tenantId) {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] BLOOM_DB_TENANT is enabled but no tenant resolved for this call. ` +
          `Use database.tenant(req, db => ...) for request-scoped queries, or ` +
          `database.bypass('reason', db => ...) for deliberate cross-tenant access. ` +
          `Passing no request at all is the usual cause. See: ${DOCS_URL}#multi-tenant-mode`,
        { code: 'DATABASE_UNSCOPED_IN_TENANT_MODE' },
      );
    }

    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`,
        { code: 'DATABASE_MISSING_URL' },
      );
    }

    return await createClient(url, tenantId);
  },
  
  /**
   * Run a callback against a tenant-scoped client.
   *
   * This is the safe path, and in tenant mode it is the ONLY ergonomic one.
   * The tenant is resolved from the verified login token only —
   * `req.user.tenantId` (or the pre-4.2 `tenant_id`) — and a caller with no
   * tenant claim is refused rather than silently handed every row.
   *
   * ```ts
   * const clients = await database.tenant(req, (db) => db.client.findMany());
   * ```
   *
   * @llm-rule WHEN: Any request-scoped query in a multi-tenant app
   * @llm-rule AVOID: databaseClass.get() for tenant data - it cannot prove a tenant was applied
   * @llm-rule NOTE: Throws when no tenant resolves; use bypass() for deliberate cross-tenant work
   */
  async tenant<T>(req: any, fn: (db: DatabaseClientUnion) => Promise<T> | T): Promise<T> {
    if (typeof fn !== 'function') {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] database.tenant(req, fn) needs a callback. See: ${DOCS_URL}#multi-tenant-mode`,
        { code: 'DATABASE_TENANT_NO_CALLBACK' },
      );
    }

    const tenantMode = tenantModeOn();

    // Two different mistakes, two different messages. Telling a single-tenant
    // app "no tenant resolved" sends them hunting for a missing claim when the
    // real answer is that they never needed this method.
    if (!tenantMode) {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] database.tenant() requires multi-tenant mode, but BLOOM_DB_TENANT ` +
          `is not enabled. Single-tenant apps should use databaseClass.get() — it is unrestricted ` +
          `when tenant mode is off. To enable multi-tenancy set BLOOM_DB_TENANT=auto. ` +
          `See: ${DOCS_URL}#multi-tenant-mode`,
        { code: 'DATABASE_TENANT_MODE_OFF' },
      );
    }

    const tenantId = detectTenant(req);
    if (!tenantId) {
      // Failing closed is the entire point. A request with no tenant that
      // silently reads every row is the leak this API exists to prevent.
      throw new DatabaseError(
        `[@bloomneo/appkit/database] No tenant resolved for this request. ` +
          `Expected req.user.tenantId — put tenantId in the login token and mount ` +
          `auth.requireLoginToken() before this route. Headers, route params and subdomains ` +
          `are not read (6.0). For deliberate cross-tenant access use ` +
          `database.bypass('reason', fn). See: ${DOCS_URL}#multi-tenant-mode`,
        { code: 'DATABASE_NO_TENANT' },
      );
    }

    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`,
        { code: 'DATABASE_MISSING_URL' },
      );
    }

    const client = await contextClient(url);
    // Await INSIDE run(): Prisma queries are lazy thenables that start when
    // awaited, so `db => db.x.findMany()` returned out of the context would
    // run with no tenant at all.
    return await tenantStore.run({ tenantId }, async () => await fn(client));
  },

  /**
   * Express middleware: every database call for the rest of this request runs
   * in the caller's tenant, whether it goes through tenant(), get() or a
   * client captured earlier. Mount after auth.requireLoginToken().
   *
   * A request without a tenant claim gets no context, so tenant-scoped
   * queries in it fail closed.
   *
   * ```ts
   * router.use(auth.requireLoginToken(), database.context());
   * ```
   *
   * @llm-rule WHEN: Tenant-scoped route groups in a multi-tenant app
   * @llm-rule NOTE: With BLOOM_DB_TENANT=rls this also sets app.tenant_id for Postgres policies
   */
  context() {
    return (req: any, _res: any, next: (err?: unknown) => void) => {
      const tenantId = detectTenant(req);
      if (!tenantId) return next();
      tenantStore.run({ tenantId }, () => next());
    };
  },

  /**
   * Run a callback against an UNSCOPED client, on purpose.
   *
   * Every cross-tenant read in the codebase goes through here, so
   * `grep -rn "bypass(" src/` is the complete audit surface. The reason string
   * is required and logged for exactly that: a bypass with no stated reason is
   * indistinguishable from a forgotten scope.
   *
   * ```ts
   * const firms = await database.bypass('platform admin firm list', (db) => db.firm.findMany());
   * ```
   *
   * @llm-rule WHEN: Platform/admin routes that are cross-tenant by design, or pre-login lookups
   * @llm-rule AVOID: Using it because tenant() threw - that throw is usually a real missing claim
   * @llm-rule NOTE: The reason is mandatory and appears in logs; keep it specific
   */
  async bypass<T>(reason: string, fn: (db: DatabaseClientUnion) => Promise<T> | T): Promise<T> {
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] database.bypass(reason, fn) needs a specific reason string — ` +
          `it is what makes cross-tenant access auditable. See: ${DOCS_URL}#multi-tenant-mode`,
        { code: 'DATABASE_BYPASS_NO_REASON' },
      );
    }
    if (typeof fn !== 'function') {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] database.bypass(reason, fn) needs a callback. See: ${DOCS_URL}#multi-tenant-mode`,
        { code: 'DATABASE_BYPASS_NO_CALLBACK' },
      );
    }

    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new DatabaseError(
        `[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`,
        { code: 'DATABASE_MISSING_URL' },
      );
    }

    if (!tenantModeOn()) {
      const client = await createClient(url, null);
      return await fn(client);
    }

    // Deliberately not the logger module — database must not depend on it.
    console.warn(`[@bloomneo/appkit/database] tenant bypass: ${reason}`);
    reportBypass(reason);
    const client = await contextClient(url);
    return await tenantStore.run({ bypassReason: reason }, async () => await fn(client));
  },

  /**
   * Subscribe to bypasses — write an audit-log row for each one.
   * Returns an unsubscribe function.
   *
   * ```ts
   * database.onBypass(({ reason }) => audit.log('tenant.bypass', { reason }));
   * ```
   */
  onBypass,

  /** SQL that enables tenant isolation on a table (idempotent). See rlsPolicyStatements. */
  rlsPolicySql,

  /** The same SQL as one statement per string, for Prisma's $executeRawUnsafe. */
  rlsPolicyStatements,

  /**
   * Health check for database connections
   * @returns {Promise<Object>} Health status
   */
  async health(): Promise<any> {
    try {
      const db: any = await this.get();
      
      // Simple connectivity test
      if (db.$queryRaw) {
        await db.$queryRaw`SELECT 1`;
      }
      
      return {
        healthy: true,
        connections: connections.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
        connections: connections.size,
        timestamp: new Date().toISOString(),
      };
    }
  },
  
  /**
   * Close every cached tenant connection and reset internal state — the
   * canonical teardown call. Named to match cache/queue/email/storage/logger
   * per NAMING.md §Bulk-and-Lifecycle-Ops so agents see one teardown verb
   * across every appkit module.
   *
   * @llm-rule WHEN: App shutdown, SIGTERM handler, end-of-test-suite teardown
   * @llm-rule AVOID: Abrupt process exit — graceful drain prevents dropped
   *   in-flight queries and lets the ORM flush pending writes
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const [key, connection] of connections) {
      disconnectPromises.push(
        this._closeConnection(connection).catch((error: any) =>
          console.warn(`[@bloomneo/appkit/database] Disconnect warning for "${key}":`, error.message)
        )
      );
    }

    for (const [url, pending] of contextClients) {
      disconnectPromises.push(
        pending
          .then((client) => this._closeConnection(client))
          .catch((error: any) => console.warn(`[@bloomneo/appkit/database] Disconnect warning for "${url}":`, error.message)),
      );
    }

    await Promise.all(disconnectPromises);
    connections.clear();
    contextClients.clear();

  },
  
  // Private helper methods
  
  /**
   * Close database connection
   * @private
   */
  async _closeConnection(connection: any): Promise<void> {
    try {
      if (connection.$disconnect) {
        await connection.$disconnect();
      }
    } catch {
      // Ignore disconnect errors
    }
  },
};

// Default export for convenience
export default databaseClass;
