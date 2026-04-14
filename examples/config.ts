/**
 * examples/config.ts
 *
 * Runnable tour of the @bloomneo/appkit/config module.
 *
 * Convention:
 *   UPPER_SNAKE_CASE env vars → dotted paths on the config object.
 *   Example:  DATABASE_POOL_SIZE=10  →  config.get('database.pool.size') === 10
 *
 * Framework-owned vars (BLOOM_*, FLUX_*) are intentionally NOT exposed
 * as app config — they're read by individual modules.
 *
 * Run: tsx examples/config.ts
 */

import { configClass } from '../src/config/index.js';

function main() {
  // 1. Get the instance. Environment is parsed exactly once.
  const config = configClass.get();

  // 2. Read values — dotted paths, with an optional default.
  const port        = config.get<number>('port', 3000);
  const dbUrl       = config.get<string>('database.url', 'postgres://localhost/dev');
  const featureBeta = config.get<boolean>('features.beta.enabled', false);
  console.log({ port, dbUrl, featureBeta });

  // 3. getRequired throws with a helpful message if the path is missing.
  try {
    config.getRequired<string>('definitely.not.set');
  } catch (err) {
    console.log('getRequired threw (as expected):', (err as Error).message);
  }

  // 4. Bulk lookup.
  const { host, user } = config.getMany({ host: 'database.host', user: 'database.user' });
  console.log('bulk →', { host, user });

  // 5. Existence check.
  console.log("has('app.name') =", config.has('app.name'));

  // 6. Environment helpers (consistent shape across modules).
  console.log({
    env:            configClass.getEnvironment(),
    isDevelopment:  configClass.isDevelopment(),
    isProduction:   configClass.isProduction(),
    isTest:         configClass.isTest(),
  });

  // 7. Startup validation — throws listing the missing env vars.
  //    Use in your app's bootstrap to fail fast.
  try {
    configClass.validateRequired(['database.url', 'app.name']);
  } catch (err) {
    console.log('validateRequired threw:', (err as Error).message);
  }

  // 8. Module-scoped config (helper for libraries).
  const dbConfig = configClass.getModuleConfig('database', { pool: { size: 5 } });
  console.log('database module config =', dbConfig);
}

main();
