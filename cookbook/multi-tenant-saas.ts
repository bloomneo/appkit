/**
 * COOKBOOK RECIPE — Multi-tenant SaaS with auto-filtering and per-tenant cache.
 *
 * Demonstrates the unique bloomneo multi-tenant pattern: every database
 * query is automatically filtered by the current user's tenant_id, and
 * the cache namespace is derived from the tenant id so cache entries
 * never leak between tenants.
 *
 * Modules used: auth, database, cache, security, error
 * Required env: BLOOM_AUTH_SECRET, DATABASE_URL, BLOOM_DB_TENANT=auto
 * Optional env: REDIS_URL (for distributed cache)
 */

import { Router } from 'express';
import {
  authClass,
  databaseClass,
  cacheClass,
  securityClass,
  errorClass,
} from '@bloomneo/appkit';

const auth = authClass.get();
const security = securityClass.get();
const error = errorClass.get();

// IMPORTANT: databaseClass.get() returns a tenant-aware client when
// BLOOM_DB_TENANT=auto. Every query below is auto-filtered.
const database = await databaseClass.get();

const router = Router();

// ── Per-tenant cached list ──────────────────────────────────────────
router.get(
  '/users',
  auth.requireLoginToken(),
  security.requests(100, 15 * 60 * 1000), // per-IP rate limit
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);
    if (!user) throw error.unauthorized();

    // Cache key includes tenantId so different tenants don't share cache.
    const tenantCache = cacheClass.get(`tenant:${user.tenantId}`);

    const users = await tenantCache.getOrSet(
      'users:list',
      () => database.user.findMany({ orderBy: { createdAt: 'desc' } }),
      300, // 5 minutes
    );

    res.json({ users, tenant: user.tenantId });
  }),
);

// ── Per-tenant cache invalidation on write ──────────────────────────
router.post(
  '/users',
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const u = auth.user(req);
    if (!u) throw error.unauthorized();

    const newUser = await database.user.create({ data: req.body });

    // Invalidate the cached list so the next read sees the new user.
    const tenantCache = cacheClass.get(`tenant:${u.tenantId}`);
    await tenantCache.delete('users:list');

    res.status(201).json({ user: newUser });
  }),
);

// ── Cross-tenant analytics (admin.system only — uses unfiltered client) ──
router.get(
  '/admin/analytics',
  auth.requireUserRoles(['admin.system']),
  error.asyncRoute(async (req, res) => {
    const dbAll = await databaseClass.getTenants();
    const stats = await dbAll.user.groupBy({
      by: ['tenant_id'],
      _count: { _all: true },
    });
    res.json({ tenants: stats });
  }),
);

export default router;
