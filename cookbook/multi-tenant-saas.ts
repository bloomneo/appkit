/**
 * COOKBOOK — Multi-tenant SaaS request pipeline.
 *
 * Modules:    auth + database + cache + error + logger
 * Required:   BLOOM_AUTH_SECRET, DATABASE_URL, BLOOM_DB_TENANT=auto
 * Optional:   REDIS_URL
 *
 * How databaseClass resolves the tenant from the request:
 *   req.user.tenantId (the login-token claim) → req.user.tenant_id (pre-4.2).
 *   Nothing else: headers, route params and subdomains are caller-controlled
 *   and are not read (6.0).
 *
 * 5.0: with BLOOM_DB_TENANT enabled, databaseClass.get() THROWS when no tenant
 * resolves rather than returning an unscoped client. Use:
 *
 *   database.tenant(req, fn)      — scoped; the normal path
 *   database.bypass(reason, fn)   — deliberate cross-tenant, mandatory reason
 *
 * `grep -rn "bypass(" src/` is then the complete list of cross-tenant reads in
 * the app. That enumerability is the whole point — before 5.0 a call that
 * failed to resolve a tenant silently returned every row.
 *
 * Put the claim in the token at login so tenant() can resolve it:
 *   auth.generateLoginToken({ userId, role, level, tenantId: user.firmId })
 *
 * 6.0: database.context() binds the caller's tenant for the rest of the
 * request. Inside it every database call is scoped (even get()), cache keys
 * are stored per tenant (`t:<tenant>:` prefix), and a job queued from the
 * request runs in the same tenant. With BLOOM_DB_TENANT=rls, Postgres policies
 * enforce the same boundary in the database.
 */

import { Router } from 'express';
import {
  authClass,
  databaseClass,
  cacheClass,
  errorClass,
  loggerClass,
} from '@bloomneo/appkit';

const auth   = authClass.get();
const logger = loggerClass.get('multi-tenant');

const cache  = cacheClass.get('dashboard');

const router = Router();
// Login first, then bind the token's tenant for the rest of the request.
router.use(auth.requireLoginToken(), databaseClass.context());

// ── Tenant-scoped dashboard (cached per tenant) ─────────────────────
router.get(
  '/dashboard',
  errorClass.asyncRoute(async (req, res) => {
    // Inside the tenant context this key is per tenant automatically.
    const data = await cache.getOrSet('dashboard:summary', async () => {
      // Scoped: every query inside the callback is filtered to this tenant.
      return databaseClass.tenant(req, async (db: any) => {
        const [users, invoices] = await Promise.all([
          db.user.count(),
          db.invoice.aggregate({ _sum: { amountCents: true } }),
        ]);
        return { users, revenueCents: invoices._sum.amountCents ?? 0 };
      });
    }, 60);

    res.json(data);
  }),
);

// ── Tenant management lives in the app's own tenants table ─────────
// appkit has no tenant registry (6.0 removed getTenants/list/exists/create/
// delete). Tenants are rows in your own model — `organization` here, often a
// Customer or Firm — read and written through bypass(), because the tenants
// table is by definition not scoped to one tenant.

// ── Admin-only cross-tenant report ──────────────────────────────────
router.get(
  '/admin/tenants',
  auth.requireUserRoles(['admin.org']),
  errorClass.asyncRoute(async (req, res) => {
    const user = auth.getUser(req as any);
    if (!user?.org_id) throw errorClass.forbidden('Missing org context');

    // Cross-tenant BY DESIGN — so it says so, in a form you can grep for.
    const tenants = await databaseClass.bypass(
      `org admin listing tenants for ${user.org_id}`,
      (db: any) => db.organization.findMany({ select: { id: true, name: true, active: true } }),
    );
    logger.info('admin listing tenants', { org: user.org_id, count: tenants.length });

    res.json({ tenants });
  }),
);

// ── Provision a new tenant ──────────────────────────────────────────
router.post(
  '/admin/tenants',
  auth.requireUserRoles(['admin.org']),
  errorClass.asyncRoute(async (req, res) => {
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      throw errorClass.badRequest('name required');
    }

    const tenant = await databaseClass.bypass('provision new tenant', (db: any) =>
      db.organization.create({ data: { name: name.trim(), active: true } }),
    );
    logger.info('tenant provisioned', { tenantId: tenant.id });
    res.status(201).json({ tenantId: tenant.id });
  }),
);

// ── Deactivate a tenant ─────────────────────────────────────────────
// Deactivate, don't purge. Deleting a tenant's rows across every table is an
// explicit, reviewed app migration or job — never a request handler.
router.delete(
  '/admin/tenants/:tenantId',
  auth.requireUserRoles(['admin.org']),
  errorClass.asyncRoute(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const updated = await databaseClass.bypass('deactivate tenant', (db: any) =>
      db.organization.updateMany({ where: { id: tenantId }, data: { active: false } }),
    );
    if (updated.count === 0) throw errorClass.notFound('Tenant not found');

    logger.warn('tenant deactivated', { tenantId });
    res.json({ deactivated: true });
  }),
);

export default router;
