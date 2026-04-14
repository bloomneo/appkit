/**
 * CANONICAL PATTERN — type-safe environment variable access.
 *
 * Copy this file when you need to read configuration. Always go through
 * configClass.get() instead of touching process.env directly — config
 * validates types, provides defaults, and supports the BLOOM_* prefix
 * convention.
 *
 * Read AGENTS.md for the full env var reference.
 */

import { configClass } from '@bloomneo/appkit';

const config = configClass.get();

// ── Read string config (with default) ───────────────────────────────
const apiHost = config.get('api.host', 'localhost');
const dbUrl = config.getRequired('database.url');          // throws if not set

// ── Read typed config ───────────────────────────────────────────────
// config.get() returns the value as-is. Cast to number/boolean yourself.
const port = Number(config.get('api.port') ?? 3000);
const debugMode = config.get('app.debug') === 'true';

// ── Environment detection ───────────────────────────────────────────
// isDevelopment() / isProduction() / isTest() live on configClass, NOT on the
// instance returned by configClass.get(). Always call them via configClass.*.
if (configClass.isDevelopment()) {
  console.log('Running in dev mode');
}
if (configClass.isProduction()) {
  // tighter security defaults, etc.
}

// ── Validate required env vars at startup ───────────────────────────
// Call this once in your server bootstrap. Throws with a clear error message
// listing every missing variable.
// NOTE: Only app-level config paths work here (BLOOM_* framework vars are
// not parsed into the config object — check them via process.env if needed).
configClass.validateRequired([
  'database.url',
  'api.key',
]);

export { config, apiHost, dbUrl, port, debugMode };
