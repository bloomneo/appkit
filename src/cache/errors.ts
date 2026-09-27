/**
 * Typed error for @bloomneo/appkit/cache.
 * @module @bloomneo/appkit/cache
 * @file src/cache/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

const CACHE_PREFIX = '[@bloomneo/appkit/cache]';

/**
 * Thrown by all cache operations when the underlying strategy fails.
 * Catch this in your route/service and decide whether to fall back to the
 * database, re-throw, or log — the cache module never makes that call for you.
 *
 * @example
 * import { CacheError } from '@bloomneo/appkit/cache';
 *
 * try {
 *   const user = await cache.get<User>('user:123');
 * } catch (err) {
 *   if (err instanceof CacheError) {
 *     logger.warn('Cache unavailable, falling back to DB', { code: err.code });
 *     return await db.user.findUnique({ where: { id: 123 } });
 *   }
 *   throw err; // re-throw unrelated errors
 * }
 */
export class CacheError extends AppKitError {
  /** Machine-readable error code, e.g. 'CACHE_GET_FAILED', 'CACHE_CONNECT_FAILED' */
  readonly code: string;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    // Messages that already carry the module prefix are kept as-is, so a
    // fully formatted message is never double-prefixed.
    super(message.startsWith(CACHE_PREFIX) ? message : `${CACHE_PREFIX} ${message}`, {
      module: 'cache',
      code: options?.code ?? 'CACHE_ERROR',
      cause: options?.cause,
    });
    this.name = 'CacheError';
    this.code = options?.code ?? 'CACHE_ERROR';
  }
}
