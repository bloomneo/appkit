/**
 * examples/database.ts
 *
 * Runnable tour of the @bloomneo/appkit/database module.
 *
 * Prisma is the only adapter. DATABASE_URL picks the provider:
 *   • postgresql:// | postgres://  → PostgreSQL
 *   • mysql://                      → MySQL
 *   • file:./dev.db                 → SQLite
 *
 * Multi-tenancy (optional):
 *   Set BLOOM_DB_TENANT=auto. The tenant comes only from the verified login
 *   token: req.user.tenantId (or the pre-4.2 tenant_id). Headers, route params,
 *   query strings and subdomains are not read.
 *
 *   In that mode databaseClass.get() THROWS rather than returning an unscoped
 *   client (5.0). Use instead:
 *     await databaseClass.tenant(req, (db) => db.order.findMany())
 *     await databaseClass.bypass('platform report', (db) => db.firm.findMany())
 *
 *   Single-tenant apps leave BLOOM_DB_TENANT unset and keep using get().
 *
 *   6.0: databaseClass.context() (Express middleware, after
 *   auth.requireLoginToken()) binds the tenant for a whole request, and
 *   BLOOM_DB_TENANT=rls adds Postgres row-level security on top.
 *
 * Prereqs:  DATABASE_URL set, schema already migrated by YOUR ORM.
 * Run:      tsx examples/database.ts
 */

import { databaseClass, currentTenant } from '../src/database/index.js';

async function main() {
  const tenantMode = !!process.env.BLOOM_DB_TENANT && process.env.BLOOM_DB_TENANT !== 'false';

  // 1. Single-tenant (no req) — default URL, no tenant filter.
  //    In tenant mode get() throws outside a tenant context, so skip it there.
  if (!tenantMode) {
    const db = await databaseClass.get();
    console.log('client connected (url masked in logs)', Boolean(db));
  }

  // 2. Multi-tenant: the request carries the tenant in req.user, which
  //    auth.requireLoginToken() sets from the login token.
  //    Only active when BLOOM_DB_TENANT is set.
  if (tenantMode) {
    const req = { user: { userId: 'u1', tenantId: 'team-1' } } as any;
    const tenantId = await databaseClass.tenant(req, () => currentTenant()?.tenantId);
    console.log('tenant-scoped context:', tenantId);

    // With BLOOM_DB_TENANT=rls, apply the policy once per tenant table
    // (in a migration), connected as an ordinary role:
    //   for (const sql of databaseClass.rlsPolicyStatements({ table: 'orders' })) {
    //     await db.$executeRawUnsafe(sql);
    //   }
  }

  // 3. Admin view — every tenant's data, no filtering.
  const adminDb = await databaseClass.getTenants();
  console.log('admin client tenantId (should be undefined):', (adminDb as any)._tenantId);

  // 4. Health check — pings the database.
  console.log('health:', await databaseClass.health());

  // 5. Tenant admin operations (row-level strategy).
  //    list() — distinct tenant_id values seen across models.
  //    exists(id) — does any row carry this tenant_id?
  //    create(id) — validates format (row-level creation is implicit).
  //    delete(id, { confirm: true }) — deleteMany across all models.
  const tenants = await databaseClass.list();
  console.log('tenants:', tenants);
  console.log("exists('team-1') =", await databaseClass.exists('team-1'));
  await databaseClass.create('team-new');
  // await databaseClass.delete('team-old', { confirm: true }); // destructive — opt-in

  // 6. Run real queries with the returned client — it is the Prisma client.
  // const users = await (db as any).user.findMany({ take: 5 });
  // console.log(users);

  // 7. Graceful shutdown — closes every cached connection.
  await databaseClass.disconnectAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
