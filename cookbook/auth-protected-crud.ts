/**
 * COOKBOOK — Auth-protected CRUD endpoint with role-based access.
 *
 * Modules:    auth + database + error + logger
 * Required:   BLOOM_AUTH_SECRET, DATABASE_URL
 *
 * Usage:
 *   import router from './cookbook/auth-protected-crud.js';
 *   app.use('/api/products', router);
 *
 *   // LAST middleware — required so thrown AppErrors serialize correctly:
 *   app.use(errorClass.handleErrors());
 *
 * Pattern:
 *   • auth.requireLoginToken() protects reads (any logged-in user).
 *   • auth.requireUserRoles([...]) protects writes (admin.tenant+).
 *   • errorClass.asyncRoute() lets us throw AppError from async handlers.
 *   • errorClass.badRequest / notFound give typed HTTP responses.
 *   • logger.child() attaches request-scoped metadata to every record.
 */

import { Router } from 'express';
import {
  authClass,
  databaseClass,
  errorClass,
  loggerClass,
} from '@bloomneo/appkit';

const auth = authClass.get();
const logger = loggerClass.get('products');

const router = Router();

// ── LIST ─────────────────────────────────────────────────────────────
router.get(
  '/',
  auth.requireLoginToken(),
  errorClass.asyncRoute(async (req, res) => {
    const db: any = await databaseClass.get(req);
    const products = await db.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ products });
  }),
);

// ── READ ─────────────────────────────────────────────────────────────
router.get(
  '/:id',
  auth.requireLoginToken(),
  errorClass.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw errorClass.badRequest('id must be a number');

    const db: any = await databaseClass.get(req);
    const product = await db.product.findUnique({ where: { id } });
    if (!product) throw errorClass.notFound('Product not found');

    res.json({ product });
  }),
);

// ── CREATE (admin.tenant+) ───────────────────────────────────────────
router.post(
  '/',
  auth.requireUserRoles(['admin.tenant']),
  errorClass.asyncRoute(async (req, res) => {
    const { name, price } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      throw errorClass.badRequest('name required');
    }
    if (typeof price !== 'number' || price < 0) {
      throw errorClass.badRequest('price must be a non-negative number');
    }

    const db: any = await databaseClass.get(req);
    const product = await db.product.create({ data: { name, price } });

    logger.child({ requestId: (req as any).id }).info('product created', {
      productId: product.id,
      by: auth.getUser(req as any)?.userId,
    });

    res.status(201).json({ product });
  }),
);

// ── UPDATE ──────────────────────────────────────────────────────────
router.patch(
  '/:id',
  auth.requireUserRoles(['admin.tenant']),
  errorClass.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw errorClass.badRequest('id must be a number');

    const { name, price } = req.body ?? {};
    const db: any = await databaseClass.get(req);

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) throw errorClass.notFound('Product not found');

    const product = await db.product.update({
      where: { id },
      data: {
        ...(typeof name === 'string' ? { name } : {}),
        ...(typeof price === 'number' ? { price } : {}),
      },
    });

    logger.info('product updated', {
      productId: id, by: auth.getUser(req as any)?.userId,
    });
    res.json({ product });
  }),
);

// ── DELETE ──────────────────────────────────────────────────────────
router.delete(
  '/:id',
  auth.requireUserRoles(['admin.tenant']),
  errorClass.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw errorClass.badRequest('id must be a number');

    const db: any = await databaseClass.get(req);
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) throw errorClass.notFound('Product not found');

    await db.product.delete({ where: { id } });

    logger.warn('product deleted', {
      productId: id, by: auth.getUser(req as any)?.userId,
    });
    res.json({ deleted: true });
  }),
);

export default router;
