/**
 * COOKBOOK RECIPE — Auth-protected CRUD endpoint with role-based access.
 *
 * Demonstrates the canonical bloomneo backend pattern: 4 modules
 * (auth, database, error, logger) composed into a complete CRUD resource.
 *
 * Modules used: auth, database, error, logger
 * Required env: BLOOM_AUTH_SECRET, DATABASE_URL
 *
 * Drop this file into src/api/features/products/products.route.ts and
 * mount with `app.use('/api/products', router)`.
 */

import { Router } from 'express';
import {
  authClass,
  databaseClass,
  errorClass,
  loggerClass,
} from '@bloomneo/appkit';

const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();
const logger = loggerClass.get('products');

const router = Router();

// ── LIST: any logged-in user can list ───────────────────────────────
router.get(
  '/',
  auth.requireLoginToken(),
  error.asyncRoute(async (req, res) => {
    const products = await database.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ products });
  }),
);

// ── READ: any logged-in user can read one ───────────────────────────
router.get(
  '/:id',
  auth.requireLoginToken(),
  error.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw error.badRequest('id must be a number');

    const product = await database.product.findUnique({ where: { id } });
    if (!product) throw error.notFound('Product not found');

    res.json({ product });
  }),
);

// ── CREATE: only admins can create ──────────────────────────────────
router.post(
  '/',
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const { name, price } = req.body;
    if (!name) throw error.badRequest('name required');
    if (typeof price !== 'number' || price < 0)
      throw error.badRequest('price must be a positive number');

    const product = await database.product.create({ data: { name, price } });
    logger.info('Product created', { productId: product.id, by: auth.user(req)?.userId });

    res.status(201).json({ product });
  }),
);

// ── UPDATE: only admins can update ──────────────────────────────────
router.patch(
  '/:id',
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const { name, price } = req.body;

    const existing = await database.product.findUnique({ where: { id } });
    if (!existing) throw error.notFound('Product not found');

    const product = await database.product.update({
      where: { id },
      data: { ...(name && { name }), ...(price !== undefined && { price }) },
    });
    logger.info('Product updated', { productId: id, by: auth.user(req)?.userId });

    res.json({ product });
  }),
);

// ── DELETE: only admins can delete ──────────────────────────────────
router.delete(
  '/:id',
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    const existing = await database.product.findUnique({ where: { id } });
    if (!existing) throw error.notFound('Product not found');

    await database.product.delete({ where: { id } });
    logger.warn('Product deleted', { productId: id, by: auth.user(req)?.userId });

    res.json({ deleted: true });
  }),
);

export default router;
