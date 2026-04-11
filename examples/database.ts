/**
 * CANONICAL PATTERN — multi-tenant database access.
 *
 * Verified against src/database/README.md (Core API + LLM Guidelines sections)
 * and src/database/index.ts.
 *
 * Three core methods:
 *   • databaseClass.get()         → tenant-aware client (single user mode)
 *   • databaseClass.getTenants()  → unfiltered client (admin / cross-tenant)
 *   • databaseClass.org('name').get() / .getTenants() → per-org databases
 *
 * Required env: DATABASE_URL
 * Optional env: BLOOM_DB_TENANT=auto (enables multi-tenant filtering)
 */

import { databaseClass } from '@bloomneo/appkit/database';

// ── Normal user access (auto-filtered by tenant when BLOOM_DB_TENANT=auto) ──
async function listUsers() {
  const database = await databaseClass.get();
  // Returns only rows belonging to the current tenant.
  // The shape of `database.user` matches your Prisma / Mongoose model.
  // Placeholder query — replace with your actual model.
  const users = await (database as any).user?.findMany?.() ?? [];
  return users;
}

// ── Admin: cross-tenant query (unfiltered) ──────────────────────────
async function listAllUsersAcrossTenants() {
  const dbTenants = await databaseClass.getTenants();
  const allUsers = await (dbTenants as any).user?.findMany?.() ?? [];
  return allUsers;
}

// ── Admin: per-tenant analytics ─────────────────────────────────────
async function tenantAnalytics() {
  const dbTenants = await databaseClass.getTenants();
  const stats = await (dbTenants as any).user?.groupBy?.({
    by: ['tenant_id'],
    _count: { _all: true },
  }) ?? [];
  return stats;
}

// ── Multi-org: per-organization database ────────────────────────────
// Set ORG_ACME=postgresql://acme.aws.com/prod in .env, then:
async function listAcmeUsers() {
  const acmedatabase = await databaseClass.org('acme').get();
  const users = await (acmedatabase as any).user?.findMany?.() ?? [];
  return users;
}

// ── Multi-org admin: all tenants in a single org ────────────────────
async function acmeTenantStats() {
  const acmeDbTenants = await databaseClass.org('acme').getTenants();
  const stats = await (acmeDbTenants as any).user?.groupBy?.({
    by: ['tenant_id'],
    _count: { _all: true },
  }) ?? [];
  return stats;
}

export {
  listUsers,
  listAllUsersAcrossTenants,
  tenantAnalytics,
  listAcmeUsers,
  acmeTenantStats,
};
