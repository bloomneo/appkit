/**
 * Vitest global setup — runs once before any test file is loaded.
 *
 * Sets the minimum required env vars so that modules which validate at
 * import time (e.g. authClass.get() calls validateEnvironment) don't crash
 * inside the test suite.
 *
 * These are dummy test values — never use them in production.
 *
 * @file vitest.setup.ts
 */

process.env.BLOOM_AUTH_SECRET = 'test-secret-must-be-at-least-32-characters-long';
process.env.BLOOM_SECURITY_CSRF_SECRET = 'test-csrf-secret-must-be-32-chars-long-x';
process.env.BLOOM_SECURITY_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test';
