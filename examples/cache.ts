/**
 * CANONICAL PATTERN — cache.getOrSet for "fetch once, cache the result".
 *
 * Copy this file when you need to cache anything. The getOrSet pattern is
 * the right answer 90% of the time — never write the cache-check-then-fetch
 * pattern manually.
 *
 * Set REDIS_URL in .env to upgrade from in-process memory to distributed
 * Redis cache. Same code works for both — no changes needed.
 */

import { cacheClass, databaseClass, errorClass } from '@bloomneo/appkit';

const error = errorClass.get();
const database = await databaseClass.get();

// Custom namespace isolates this cache from others (default is 'app').
const cache = cacheClass.get('users');

// ── Cached database query ─────────────────────────────────────────────
export const listProductsRoute = error.asyncRoute(async (req, res) => {
  const products = await cache.getOrSet(
    'products:list',
    () => database.product.findMany({ where: { published: true } }),
    300, // 5 minutes
  );
  res.json({ products });
});

// ── Manual operations (use sparingly — getOrSet is preferred) ────────
export async function manualCacheExample() {
  await cache.set('foo', 'bar', 60);                       // 1 minute TTL
  const v = await cache.get('foo');                        // → 'bar'
  const exists = v !== null;                               // presence check: get() returns null on miss
  await cache.delete('foo');                               // delete() — not del()
}
