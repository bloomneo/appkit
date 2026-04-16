/**
 * examples/cache.ts
 *
 * Runnable tour of the @bloomneo/appkit/cache module.
 *
 * Strategy auto-selection:
 *   • REDIS_URL set   → Redis transport
 *   • unset           → in-process Memory
 *
 * Run: tsx examples/cache.ts
 */

import { cacheClass } from '../src/cache/index.js';

async function main() {
  // 1. Get a namespaced cache. Namespaces are isolated keyspaces, so
  //    users:user:42 and posts:user:42 never collide.
  const users = cacheClass.get('users');
  const posts = cacheClass.get('posts');

  // 2. Basic get / set (ttl in seconds; optional).
  await users.set('user:42', { id: 42, name: 'Ada' }, 60);
  const ada = await users.get<{ id: number; name: string }>('user:42');
  console.log('cache hit:', ada);

  // 3. getOrSet — the single most-used pattern (load-through cache).
  const expensive = await posts.getOrSet(
    'top-posts:home',
    async () => {
      // Simulated DB/API call. Only runs on cache miss.
      return [{ id: 1, title: 'hello' }];
    },
    300,
  );
  console.log('getOrSet →', expensive);

  // 4. delete + clear (clear wipes this namespace only, not every cache).
  await users.delete('user:42');
  await posts.clear();

  // 5. Debugging: which transport is active, and which namespaces exist?
  console.log('strategy         =', cacheClass.getStrategy());
  console.log('hasRedis         =', cacheClass.hasRedis());
  console.log('active namespaces=', cacheClass.getActiveNamespaces());
  console.log('config summary   =', cacheClass.getConfig());

  // 6. Test teardown:
  //    • clearAll()      — clear DATA in every namespace (between tests)
  //    • disconnectAll() — close transports + reset state (end of suite / SIGTERM)
  await cacheClass.clearAll();
  await cacheClass.disconnectAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
