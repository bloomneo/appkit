---
name: appkit-cache
description: >-
  Use when writing code that caches data via `@bloomneo/appkit/cache`. Covers
  the namespaced `cacheClass.get('<ns>')` pattern, automatic Memory → Redis
  switching on `REDIS_URL`, and the `clearAll` (data) vs `disconnectAll`
  (connections) teardown distinction.
---

# @bloomneo/appkit/cache

Namespaced cache: `cacheClass.get('users')` returns a cache scoped to a
namespace. Strategy (Memory vs Redis) is auto-selected from `REDIS_URL`. No
import-time config.

## Canonical flow

```ts
import { cacheClass } from '@bloomneo/appkit/cache';

const users = cacheClass.get('users');   // namespace = 'users'

await users.set('user:123', { name: 'Ada' }, 3600);   // ttl in seconds
const u = await users.get<User>('user:123');          // → User | null

// Cache-aside / memoize pattern — use getOrSet instead of get + set pairs
const fresh = await users.getOrSet('user:123', async () => fetchFromDB(123), 3600);

await users.delete('user:123');
await users.clear();   // clears THIS namespace only
```

## Strategy auto-detection

| Env | Strategy |
|---|---|
| `REDIS_URL` set | Redis |
| unset | In-process Memory (dev default) |

Override explicitly with `BLOOM_CACHE_STRATEGY=memory|redis`.

## Teardown — two distinct operations

Don't conflate these:

- **`cacheClass.clearAll()`** — clears DATA across every namespace, connections stay open.
  Use **between tests** or to bust cache after a deploy.
- **`cacheClass.disconnectAll()`** — closes connections and resets internal state.
  Use at **end of test suite** or in a `SIGTERM` handler.

```ts
// Test file pattern
afterEach(() => cacheClass.clearAll());
afterAll(() => cacheClass.disconnectAll());

// Production shutdown (opt-in — library does NOT auto-register)
process.on('SIGTERM', () => cacheClass.disconnectAll().finally(() => process.exit(0)));
```

## Public API

### Cache instance (from `cacheClass.get(ns)`)

```ts
cache.get<T>(key)                         // → Promise<T | null>
cache.set<T>(key, value, ttl?)            // → Promise<boolean>
cache.delete(key)                         // → Promise<boolean>
cache.clear()                             // → Promise<boolean> (this namespace)
cache.getOrSet<T>(key, factory, ttl?)     // → Promise<T>
cache.getStrategy()                       // → 'memory' | 'redis'
cache.getConfig()                         // → diagnostic object
```

### cacheClass (bulk ops + utilities)

```ts
cacheClass.get(namespace?)                // → Cache (default ns: 'app')
cacheClass.clearAll()                     // → Promise<boolean> (data, all namespaces)
cacheClass.disconnectAll()                // → Promise<void> (connections, teardown)
cacheClass.reset(newConfig?)              // → Promise<void> (tests only)
cacheClass.getStrategy()                  // → string
cacheClass.getActiveNamespaces()          // → string[]
cacheClass.getConfig()                    // → diagnostic object
cacheClass.hasRedis()                     // → boolean
```

## Env vars

- `REDIS_URL` — opt-in, triggers Redis strategy
- `REDIS_PASSWORD` — optional
- `BLOOM_CACHE_TTL` — default TTL in seconds (3600 prod, 300 dev)
- `BLOOM_CACHE_NAMESPACE` — default namespace (falls back to `BLOOM_SERVICE_NAME`)
- `BLOOM_CACHE_STRATEGY` — force `memory` or `redis`

## Methods that DO NOT exist (old / wrong names)

- `cacheClass.flushAll()` — renamed to `clearAll()`
- `cacheClass.shutdown()` — removed, use `disconnectAll()`
- `cacheClass.clear()` — was removed (collided with `cache.clear()`). Use
  `cacheClass.clearAll()` for cross-namespace clear.
- `cache.del(key)` — real name is `cache.delete(key)`
- `cache.has(key)` — not on the public Cache interface
