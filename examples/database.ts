/**
 * examples/database.ts
 *
 * Runnable tour of the @bloomneo/appkit/database module.
 *
 * Auto-detects the adapter from DATABASE_URL:
 *   • postgresql:// | postgres://  → Prisma
 *   • mongodb://                    → Mongoose
 *
 * Multi-tenancy (optional):
 *   Set BLOOM_DB_TENANT=auto, then every databaseClass.get(req) call
 *   auto-filters by tenant_id detected from the request:
 *     x-tenant-id header → req.user.tenant_id → req.params.tenantId →
 *     req.query.tenant → subdomain.
 *
 * Multi-org (optional):
 *   Per-org databases via ORG_<NAME> env vars, or a {org} placeholder in
 *   DATABASE_URL. Use databaseClass.org('<id>').get() to select one.
 *
 * Prereqs:  DATABASE_URL set, schema already migrated by YOUR ORM.
 * Run:      tsx examples/database.ts
 */

import { databaseClass } from '../src/database/index.js';

async function main() {
  // 1. Single-tenant (no req) — default URL, no tenant filter.
  const db = await databaseClass.get();
  console.log('client connected (url masked in logs)', Boolean(db));

  // 2. Multi-tenant: pass a request to activate row-level filtering.
  //    Only active when BLOOM_DB_TENANT is set.
  const req = { headers: { 'x-tenant-id': 'team-1', 'x-org-id': 'acme' } } as any;
  const tenantScoped = await databaseClass.get(req);
  console.log('tenant-scoped client:', (tenantScoped as any)._tenantId);

  // 3. Admin view — every tenant's data, no filtering.
  const adminDb = await databaseClass.getTenants(req);
  console.log('admin client tenantId (should be undefined):', (adminDb as any)._tenantId);

  // 4. Org-specific connection.
  const acme = databaseClass.org('acme');
  const acmeDb = await acme.get(req);              // tenant-filtered within acme
  const acmeAdmin = await acme.getTenants(req);    // unfiltered within acme
  console.log('acme client org:', (acmeDb as any)._orgId, (acmeAdmin as any)._orgId);

  // 5. Health check — pings the underlying driver.
  console.log('health:', await databaseClass.health());

  // 6. Tenant admin operations (row-level strategy).
  //    list() — distinct tenant_id values seen across models.
  //    exists(id) — does any row carry this tenant_id?
  //    create(id) — validates format (row-level creation is implicit).
  //    delete(id, { confirm: true }) — deleteMany across all models.
  const tenants = await databaseClass.list();
  console.log('tenants:', tenants);
  console.log("exists('team-1') =", await databaseClass.exists('team-1'));
  await databaseClass.create('team-new');
  // await databaseClass.delete('team-old', { confirm: true }); // destructive — opt-in

  // 7. Run real queries with the returned client (Prisma shown here).
  //    The client is the native ORM client — consult Prisma/Mongoose docs.
  // const users = await (db as any).user.findMany({ take: 5 });
  // console.log(users);

  // 8. Graceful shutdown — closes every cached connection.
  await databaseClass.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
