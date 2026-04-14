/**
 * COOKBOOK — Multi-tenant SaaS request pipeline.
 *
 * Modules:    auth + database + cache + error + logger
 * Required:   BLOOM_AUTH_SECRET, DATABASE_URL, BLOOM_DB_TENANT=auto
 * Optional:   REDIS_URL, ORG_<NAME>=... per-org URLs
 *
 * How databaseClass detects tenant/org from the request:
 *   org:    x-org-id header → req.user.org_id → req.params.orgId → ?org=
 *   tenant: x-tenant-id header → req.user.tenant_id → req.params.tenantId → ?tenant=
 *
 * databaseClass.get(req) applies row-level filtering automatically when
 * BLOOM_DB_TENANT is set. databaseClass.getTenants(req) skips the filter
 * (admin view).
 *
 * Caches are namespaced per (orgId|tenantId) so keys never cross tenants.
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

const router = Router();
router.use(auth.requireLoginToken());

// Derive a cache namespace from the authenticated user context.
function cacheFor(req: any) {
  const user = auth.getUser(req);
  const org    = user?.org_id    ?? 'default';
  const tenant = user?.tenant_id ?? 'shared';
  // Namespaces allow only [a-zA-Z0-9_-]
  return cacheClass.get(`app-${org}-${tenant}`);
}

// ── Tenant-scoped dashboard (cached per tenant) ─────────────────────
router.get(
  '/dashboard',
  errorClass.asyncRoute(async (req, res) => {
    const cache = cacheFor(req);

    const data = await cache.getOrSet('dashboard:summary', async () => {
      const db: any = await databaseClass.get(req);                 // tenant-filtered
      const [users, invoices] = await Promise.all([
        db.user.count(),
        db.invoice.aggregate({ _sum: { amountCents: true } }),
      ]);
      return { users, revenueCents: invoices._sum.amountCents ?? 0 };
    }, 60);

    res.json(data);
  }),
);

// ── Admin-only cross-tenant report ──────────────────────────────────
router.get(
  '/admin/tenants',
  auth.requireUserRoles(['admin.org']),
  errorClass.asyncRoute(async (req, res) => {
    const user = auth.getUser(req as any);
    if (!user?.org_id) throw errorClass.forbidden('Missing org context');

    // Org-scoped, no tenant filter — admin sees every tenant's data.
    const adminDb = await databaseClass.org(user.org_id).getTenants(req);
    const tenants = await databaseClass.list(req);
    logger.info('admin listing tenants', { org: user.org_id, count: tenants.length });

    res.json({ tenants, adminConnected: Boolean(adminDb) });
  }),
);

// ── Provision a new tenant under the caller's org ───────────────────
router.post(
  '/admin/tenants',
  auth.requireUserRoles(['admin.org']),
  errorClass.asyncRoute(async (req, res) => {
    const { tenantId } = req.body ?? {};
    if (typeof tenantId !== 'string' || !tenantId) {
      throw errorClass.badRequest('tenantId required');
    }

    // Row-level strategy: create() validates the id shape. No tables created.
    await databaseClass.create(tenantId, req);
    logger.info('tenant registered', { tenantId });
    res.status(201).json({ tenantId });
  }),
);

// ── Purge a tenant (destructive, requires explicit confirm) ─────────
router.delete(
  '/admin/tenants/:tenantId',
  auth.requireUserRoles(['admin.org']),
  errorClass.asyncRoute(async (req, res) => {
    const { tenantId } = req.params;
    const exists = await databaseClass.exists(tenantId, req);
    if (!exists) throw errorClass.notFound('Tenant not found');

    await databaseClass.delete(tenantId, { confirm: true }, req);
    logger.warn('tenant purged', { tenantId });
    res.json({ deleted: true });
  }),
);

export default router;
