/**
 * CANONICAL PATTERN — structured logging with component tagging.
 *
 * Copy this file when you need logging. The pattern: get a component-tagged
 * logger at module scope, then call .info() / .warn() / .error() with a
 * message + meta object. Logs are structured JSON in production, pretty
 * console output in development.
 *
 * Set BLOOM_LOGGER_FILE_PATH to also write to a file.
 * Set BLOOM_LOGGER_HTTP_URL to ship to a centralized log collector.
 * Same code works in all three modes.
 */

import { loggerClass } from '@bloomneo/appkit';

// Component-tagged logger — use one per file or per logical area.
const logger = loggerClass.get('users');

export function exampleLogging() {
  logger.debug('Lookup started', { userId: 42 });          // dev only
  logger.info('User created', { userId: 42, email: 'a@b' });
  logger.warn('Slow query', { ms: 3200, table: 'users' });
  logger.error('Database connection lost', { host: 'db1' });
  logger.fatal('OOM, exiting', { rss: process.memoryUsage().rss });
}

// ── Inside a route handler ──────────────────────────────────────────
import { errorClass } from '@bloomneo/appkit';
const error = errorClass.get();

export const createUserRoute = error.asyncRoute(async (req, res) => {
  logger.info('Creating user', { ip: req.ip, email: req.body.email });
  try {
    // ...create logic
    logger.info('User created successfully', { userId: 123 });
    res.json({ ok: true });
  } catch (e) {
    logger.error('User creation failed', { error: (e as Error).message });
    throw e;
  }
});
