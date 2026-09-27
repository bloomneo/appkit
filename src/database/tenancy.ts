/**
 * Tenant context and Postgres row-level security.
 *
 * Two layers keep one tenant's rows away from another's:
 *
 *   1. The app filter (adapters/prisma.ts) adds `tenant_id = <tenant>` to every
 *      Prisma model operation and forces writes into the caller's tenant.
 *   2. With BLOOM_DB_TENANT=rls, every model operation also runs in its own
 *      short transaction that sets `app.tenant_id` first, so Postgres
 *      policies (see rlsPolicySql) enforce isolation in the database — for
 *      code that forgot the filter, for raw SQL run through `tx`, and for
 *      anything else that reaches the table.
 *
 * The tenant for a request lives in AsyncLocalStorage, so one client serves
 * every tenant: code anywhere inside the request uses the same client and
 * gets the caller's tenant, and concurrent requests never see each other's.
 *
 * Proven in production first: this is the design midhuna (fresherbot,
 * testmug, packetprep) has run since 2026-04 over ~40 tables, moved into the
 * framework with three changes — the setting is parameterised
 * (`set_config($1)`) instead of string-built, a bypass needs a reason and is
 * reported, and the tenant only ever comes from the verified token.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseError } from './errors.js';

/** What the database sees in `app.tenant_id` during a deliberate bypass. */
export const BYPASS_TOKEN = '__BYPASS__';

export interface TenantContext {
  /** The tenant every query in this context is scoped to. */
  tenantId?: string;
  /** Set during database.bypass(): the stated reason. */
  bypassReason?: string;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

/** The tenant for the code running now, if any. */
export function currentTenant(): TenantContext | undefined {
  return tenantStore.getStore();
}

/** Tenant mode: BLOOM_DB_TENANT is set and not 'false'. */
export function tenantModeOn(): boolean {
  const v = process.env.BLOOM_DB_TENANT;
  return !!v && v !== 'false';
}

/** Row-level security mode: BLOOM_DB_TENANT=rls. */
export function rlsModeOn(): boolean {
  return process.env.BLOOM_DB_TENANT === 'rls';
}

/** The column that holds the tenant id. Default `tenant_id`. */
export function tenantColumn(): string {
  return process.env.BLOOM_DB_TENANT_COLUMN || 'tenant_id';
}

export type BypassListener = (event: { reason: string; at: Date }) => void;
const bypassListeners = new Set<BypassListener>();

/** Subscribe to bypasses (e.g. to write an audit-log row). Returns an unsubscribe function. */
export function onBypass(listener: BypassListener): () => void {
  bypassListeners.add(listener);
  return () => bypassListeners.delete(listener);
}

export function reportBypass(reason: string): void {
  const event = { reason, at: new Date() };
  for (const listener of bypassListeners) {
    try {
      listener(event);
    } catch {
      // A failing audit hook must not turn a read into an error.
    }
  }
}

/**
 * Wrap a Prisma client so each model operation runs inside a transaction that
 * first sets `app.tenant_id` from the current context. Outside any context
 * the operation runs as is — and a table with a FORCEd policy then returns
 * nothing, which is the point: no context, no rows.
 *
 * One transaction per operation, not per request: parallel reads in a
 * request (a dashboard firing nine queries) would otherwise queue on a single
 * connection.
 */
export function withRlsContext<C>(client: C, options: { timeoutMs?: number; maxWaitMs?: number } = {}): C {
  const base = client as any;
  return base.$extends({
    name: 'appkit-rls',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const ctx = tenantStore.getStore();
          if (!ctx) return query(args);
          const value = ctx.bypassReason ? BYPASS_TOKEN : ctx.tenantId;
          if (!value) return query(args);
          return base.$transaction(
            async (tx: any) => {
              await tx.$executeRaw`SELECT set_config('app.tenant_id', ${value}, true)`;
              // $extends gives PascalCase model names; the tx accessor is camelCase.
              const accessor = String(model).charAt(0).toLowerCase() + String(model).slice(1);
              return tx[accessor][operation](args);
            },
            { timeout: options.timeoutMs ?? 30_000, maxWait: options.maxWaitMs ?? 8_000 },
          );
        },
      },
    },
  }) as C;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const quote = (name: string) => `"${name}"`;

/**
 * SQL that turns on tenant isolation for one table. Idempotent: safe to run
 * in every migration. Rows are visible, and writable, only when
 * `app.tenant_id` is the row's tenant or the bypass token.
 *
 * ```ts
 * await db.$executeRawUnsafe(rlsPolicySql({ table: 'invoices' }));
 * ```
 *
 * FORCE applies the policy to the table owner too, so the app's own role
 * can't read around it. A role that must (backups) needs BYPASSRLS.
 */
export function rlsPolicySql(options: RlsPolicyOptions): string {
  return rlsPolicyStatements(options).join('\n');
}

export interface RlsPolicyOptions {
  table: string;
  /** Tenant column. Default BLOOM_DB_TENANT_COLUMN or `tenant_id`. */
  column?: string;
  /** Policy name. Default `tenant_isolation`. */
  policy?: string;
  schema?: string;
  /**
   * Scope a child table through its parent instead of its own tenant column:
   * a row is visible, and writable, only when the parent row it points at
   * belongs to the caller's tenant. For tables like `deployments` whose
   * tenant is their `deploy_targets` row's. The parent must carry the tenant
   * column (`column`); a row whose foreign key is null is visible to no tenant.
   */
  via?: {
    /** Parent table (it has the tenant column). */
    parent: string;
    /** Column in this table pointing at the parent. */
    foreignKey: string;
    /** Parent's key the foreign key references. Default `id`. */
    parentKey?: string;
    /**
     * `false` when the parent has no tenant column itself but is scoped by
     * its own policy (a grandchild: comments → notes → projects). The check
     * is then "the parent row is visible", which Postgres answers with the
     * parent's forced policy — so chains of any depth work.
     */
    column?: false;
  };
}

/**
 * The same SQL as separate statements, for drivers that run one statement
 * per call (Prisma's $executeRawUnsafe):
 *
 * ```ts
 * for (const sql of rlsPolicyStatements({ table: 'invoices' })) await db.$executeRawUnsafe(sql);
 * ```
 */
export function rlsPolicyStatements(options: RlsPolicyOptions): string[] {
  const column = options.column ?? tenantColumn();
  const policy = options.policy ?? 'tenant_isolation';
  const via = options.via;
  for (const [label, value] of [
    ['table', options.table],
    ['column', column],
    ['policy', policy],
    ['schema', options.schema ?? 'public'],
    ...(via
      ? ([
          ['via.parent', via.parent],
          ['via.foreignKey', via.foreignKey],
          ['via.parentKey', via.parentKey ?? 'id'],
        ] as const)
      : []),
  ] as const) {
    if (!IDENT.test(value)) {
      throw new DatabaseError(`[@bloomneo/appkit/database] rlsPolicySql: ${label} "${value}" is not a plain SQL identifier`, {
        code: 'DATABASE_INVALID_IDENTIFIER',
      });
    }
  }
  const table = options.schema ? `${quote(options.schema)}.${quote(options.table)}` : quote(options.table);
  const qualify = (name: string) => (options.schema ? `${quote(options.schema)}.${quote(name)}` : quote(name));
  const parentRow = via
    ? `SELECT 1 FROM ${qualify(via.parent)} bloom_parent WHERE bloom_parent.${quote(via.parentKey ?? 'id')} = ${table}.${quote(via.foreignKey)}`
    : '';
  const tenantMatch = !via
    ? `${quote(column)}::text = current_setting('app.tenant_id', true)`
    : via.column === false
      ? `EXISTS (${parentRow})`
      : `EXISTS (${parentRow} AND bloom_parent.${quote(column)}::text = current_setting('app.tenant_id', true))`;
  const check = `${tenantMatch} OR current_setting('app.tenant_id', true) = '${BYPASS_TOKEN}'`;
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS ${quote(policy)} ON ${table};`,
    `CREATE POLICY ${quote(policy)} ON ${table} USING (${check}) WITH CHECK (${check});`,
  ];
}
