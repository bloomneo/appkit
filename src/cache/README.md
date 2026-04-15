# @bloomneo/appkit - Cache Module ⚡

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple caching that just works - One function, automatic Redis/Memory
> strategy, zero configuration

**One function** returns a cache object with automatic strategy selection. Zero
configuration needed, production-ready performance by default.

> **See also:** [AGENTS.md](../../AGENTS.md) (agent rules) · [llms.txt](../../llms.txt) (full API reference) · [examples/cache.ts](../../examples/cache.ts) · cookbook: [auth-protected-crud.ts](../../cookbook/auth-protected-crud.ts)

## 🚀 Why Choose This?

- ⚡ One Function - Just cacheClass.get() (optional namespace), everything else
  is automatic
- **🎯 Auto-Strategy** - REDIS_URL = Redis, no URL = Memory
- **🔧 Zero Configuration** - Smart defaults for everything
- **🏠 Namespace Isolation** - `users`, `sessions` - completely separate
- **⏰ TTL Management** - Automatic expiration
- **🔒 Production Ready** - Redis clustering, memory limits, graceful
  degradation
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

const cache = cacheClass.get('users');

// Set data with 1 hour expiration
await cache.set('user:123', { name: 'John' }, 3600);

// Get data
const user = await cache.get('user:123');
console.log(user); // { name: 'John' }

// Delete data
await cache.delete('user:123');
```

## 🔑 Cache Key Rules

> Keys are validated on every operation. Break these rules and you get a `CacheError` with `code: 'CACHE_INVALID_KEY'`.

- ✅ **Colons are allowed** — the canonical Redis idiom `user:123`, `session:abc`, `products:list` works out of the box. Internal namespacing uses `${keyPrefix}:${namespace}:${key}`, so your key's colons are scoped to your namespace and cannot collide.
- ✅ **Any ASCII letters/digits, dots, dashes, underscores, slashes** — `users/42`, `v1.orders.open`, `cart-abc`.
- ❌ **No newlines** (`\n` or `\r`) — would break log lines and Redis protocol.
- ❌ **Max 250 characters** — Redis's own limit is 512 MB, but 250 keeps keys indexable.
- ❌ **Must be a non-empty string** — no `null`, `undefined`, numbers, or objects.

```typescript
await cache.set('user:123', data);       // ✅ ok
await cache.set('v1:orders:open', data); // ✅ ok — multiple colons fine
await cache.set('bad\nkey', data);       // ❌ throws CacheError
await cache.set('', data);               // ❌ throws CacheError
```

## 🌍 Environment Variables

```bash
# Development (automatic Memory cache)
# No environment variables needed!

# Production (automatic Redis cache)
REDIS_URL=redis://localhost:6379
```

## 🤖 LLM Quick Reference - Copy These Patterns

### **Basic Cache Operations (Copy Exactly)**

```typescript
// ✅ CORRECT - Complete cache setup
import { cacheClass } from '@bloomneo/appkit/cache';
const cache = cacheClass.get('namespace');

// Cache operations
await cache.set('key', data, 3600); // Set with TTL
const data = await cache.get('key'); // Get (null if not found)
await cache.delete('key'); // Delete key
await cache.clear(); // Clear namespace

// Cache-aside pattern
const data = await cache.getOrSet(
  'key',
  async () => {
    return await fetchFromDatabase();
  },
  3600
);
```

### **Namespace Usage (Copy These)**

```typescript
// ✅ CORRECT - Separate namespaces for different data
const userCache = cacheClass.get('users');
const sessionCache = cacheClass.get('sessions');
const apiCache = cacheClass.get('external-api');

// Each namespace is completely isolated
await userCache.set('123', userData);
await sessionCache.set('123', sessionData); // Different from user:123
```

### **Error Handling (Copy This Pattern)**

```typescript
import { cacheClass, CacheError } from '@bloomneo/appkit/cache';

// ✅ CORRECT - Distinguish cache failures from other errors
async function getUser(id: number) {
  try {
    const user = await userCache.get<User>(`user:${id}`);
    if (user) return user;

    // Cache miss — fetch from DB and populate cache
    const fresh = await database.getUser(id);
    await userCache.set(`user:${id}`, fresh, 3600);
    return fresh;
  } catch (err) {
    if (err instanceof CacheError) {
      // Cache infrastructure failed — fall back silently
      logger.warn('Cache unavailable', { code: err.code, message: err.message });
      return await database.getUser(id);
    }
    throw err; // DB error or other — caller's problem
  }
}
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Wrong Cache Usage**

```typescript
// ❌ WRONG - Don't access strategies directly
import { RedisStrategy } from '@bloomneo/appkit/cache';
const redis = new RedisStrategy(); // Wrong!

// ❌ WRONG - Missing TTL for temporary data
await cache.set('temp', data); // Always set TTL for temp data

// ❌ WRONG - Using same namespace for different data types
const cache = cacheClass.get('data'); // Be specific
await cache.set('user:123', userData);
await cache.set('session:456', sessionData); // Use separate namespaces

// ✅ CORRECT - Use cacheClass.get() with specific namespaces
const userCache = cacheClass.get('users');
const sessionCache = cacheClass.get('sessions');
```

### **Wrong Error Handling**

```typescript
// ❌ WRONG - Crashing on cache miss
const user = await cache.get('user:123');
console.log(user.name); // Will crash if user is null

// ❌ WRONG - Not handling cache failures
const user = await cache.get('user:123');
if (!user) {
  throw new Error('User not found'); // Should fallback to database
}

// ✅ CORRECT - Safe cache access with fallback
const user = await cache.get('user:123');
if (!user) {
  user = await database.getUser(123); // Fallback to database
  await cache.set('user:123', user, 3600); // Cache result
}
```

### **Wrong Testing**

```typescript
// ❌ WRONG - No cleanup between tests
test('should cache user', async () => {
  await cache.set('user:123', userData);
  // Missing: await cacheClass.flushAll();
});

// ✅ CORRECT - Proper test cleanup
afterEach(async () => {
  // flushAll() clears cached data between individual tests.
  // disconnectAll() is reserved for full end-of-suite teardown.
  await cacheClass.flushAll();
});
```

## 🚨 Error Handling Patterns

Cache operations throw `CacheError` when the underlying strategy fails (Redis
down, serialization error, connection timeout). Use `instanceof CacheError` to
distinguish cache infrastructure failures from your own errors.

```typescript
import { cacheClass, CacheError } from '@bloomneo/appkit/cache';
```

### **Cache-Aside with Fallback**

```typescript
async function getUserProfile(userId: number) {
  const cache = cacheClass.get('profiles');
  try {
    const profile = await cache.get<UserProfile>(`profile:${userId}`);
    if (profile) return profile;

    const fresh = await database.getUserProfile(userId);
    if (fresh) await cache.set(`profile:${userId}`, fresh, 1800);
    return fresh;
  } catch (err) {
    if (err instanceof CacheError) {
      logger.warn('Cache unavailable, falling back to DB', { code: err.code });
      return database.getUserProfile(userId);
    }
    throw err;
  }
}
```

### **Session Management**

```typescript
async function getSession(sessionId: string) {
  const cache = cacheClass.get('sessions');
  try {
    return await cache.get<Session>(`session:${sessionId}`);
    // Returns null if not found — handle that in the caller, not here
  } catch (err) {
    if (err instanceof CacheError) {
      logger.warn('Session cache unavailable', { code: err.code });
      return null; // safe to degrade — caller will redirect to login
    }
    throw err;
  }
}

async function createSession(userId: number): Promise<string> {
  const cache = cacheClass.get('sessions');
  const sessionId = crypto.randomUUID();
  try {
    await cache.set(`session:${sessionId}`, { userId, loginTime: Date.now() }, 7200);
  } catch (err) {
    if (err instanceof CacheError) {
      logger.warn('Session not cached — Redis unavailable', { code: err.code });
      // Session is still valid — just not cached. Return it.
    } else {
      throw err;
    }
  }
  return sessionId;
}
```

### **API Response Caching**

```typescript
async function getWeather(city: string) {
  const cache = cacheClass.get('weather');
  const key = `weather:${city.toLowerCase()}`;

  try {
    const cached = await cache.get<WeatherData>(key);
    if (cached) return cached;

    const data = await fetchWeatherFromApi(city);
    await cache.set(key, data, 1800); // 30 min
    return data;
  } catch (err) {
    if (err instanceof CacheError) {
      logger.warn('Cache unavailable for weather data', { code: err.code });
      return fetchWeatherFromApi(city); // bypass cache entirely
    }
    throw err; // API error — let it propagate
  }
}
```

## 🔒 Security & Production

### **Production Configuration**

```bash
# ✅ SECURE - Production Redis with auth
REDIS_URL=redis://username:password@redis-host:6379/0

# ✅ SECURE - Redis with TLS
REDIS_URL=rediss://username:password@redis-host:6380/0

# ✅ PERFORMANCE - Custom timeouts
BLOOM_CACHE_TTL=3600                    # 1 hour default TTL
BLOOM_CACHE_REDIS_CONNECT_TIMEOUT=10000 # 10 second connect timeout
BLOOM_CACHE_REDIS_COMMAND_TIMEOUT=5000  # 5 second command timeout
```

### **Production Checklist**

- ✅ **Redis Connection**: Set secure `REDIS_URL` with authentication
- ✅ **TTL Strategy**: Set appropriate `BLOOM_CACHE_TTL` for your use case
- ✅ **Error Handling**: Implement fallback logic for cache failures
- ✅ **Monitoring**: Log cache hit/miss rates and errors
- ✅ **Memory Limits**: Configure Redis memory limits and eviction policies
- ✅ **Clustering**: Use Redis Cluster for high availability

### **Security Best Practices**

```typescript
// ✅ Namespace isolation prevents key collisions
const userCache = cacheClass.get('users');
const adminCache = cacheClass.get('admin'); // Completely separate

// ✅ TTL prevents indefinite data retention
await cache.set('temp:token', token, 300); // 5 minutes only

// ✅ Safe error handling prevents information leakage
try {
  const data = await cache.get('sensitive:data');
  return data;
} catch (error) {
  console.error('Cache error:', error.message);
  return null; // Don't expose cache errors to users
}
```

### **Memory Strategy Security**

```bash
# ✅ SECURE - Memory limits for development
BLOOM_CACHE_MEMORY_MAX_ITEMS=10000      # Max items in memory
BLOOM_CACHE_MEMORY_MAX_SIZE=100000000   # 100MB memory limit
```

## 📖 Complete API

### Core Function

```typescript
const cache = cacheClass.get(namespace); // One function, everything you need
```

### Cache Operations

```typescript
await cache.get(key);                    // Get value (null if not found)
await cache.set(key, value, ttl?);       // Set value with TTL in seconds
await cache.delete(key);                 // Remove key
await cache.clear();                     // Clear entire namespace
await cache.getOrSet(key, factory, ttl?); // Get cached or compute and cache
```

### Utility Methods

```typescript
cache.getStrategy(); // 'redis' or 'memory'
cacheClass.hasRedis(); // true if REDIS_URL is set
cacheClass.getActiveNamespaces(); // List of active namespaces
cacheClass.getConfig(); // Configuration summary
```

## 💡 Usage Examples

### **Basic User Caching**

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

const userCache = cacheClass.get('users');

async function getUser(id) {
  // Try cache first
  let user = await userCache.get(`user:${id}`);

  if (!user) {
    // Get from database
    user = await db.users.findById(id);

    // Cache for 1 hour
    await userCache.set(`user:${id}`, user, 3600);
  }

  return user;
}
```

### **API Response Caching**

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

const apiCache = cacheClass.get('external-api');

async function getWeather(city) {
  return await apiCache.getOrSet(
    `weather:${city}`,
    async () => {
      // This only runs on cache miss
      const response = await fetch(
        `https://api.weather.com/v1/weather?q=${city}`
      );
      return await response.json();
    },
    1800 // Cache for 30 minutes
  );
}

// First call: hits API
const weather1 = await getWeather('london');

// Second call: returns cached result (fast!)
const weather2 = await getWeather('london');
```

### **Session Management**

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

const sessionCache = cacheClass.get('sessions');

// Store session
async function createSession(userId) {
  const sessionId = crypto.randomUUID();
  const sessionData = { userId, loginTime: Date.now() };

  // Store for 2 hours
  await sessionCache.set(`session:${sessionId}`, sessionData, 7200);

  return sessionId;
}

// Get session
async function getSession(sessionId) {
  return await sessionCache.get(`session:${sessionId}`);
}

// Remove session
async function logout(sessionId) {
  await sessionCache.delete(`session:${sessionId}`);
}
```

### **Shopping Cart**

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

const cartCache = cacheClass.get('shopping-carts');

// Add item to cart
async function addToCart(userId, item) {
  const cart = (await cartCache.get(`cart:${userId}`)) || [];
  cart.push(item);

  // Cart expires in 24 hours
  await cartCache.set(`cart:${userId}`, cart, 86400);
}

// Get cart
async function getCart(userId) {
  return (await cartCache.get(`cart:${userId}`)) || [];
}

// Clear cart
async function clearCart(userId) {
  await cartCache.delete(`cart:${userId}`);
}
```

### **Rate Limiting Cache**

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

const rateLimitCache = cacheClass.get('rate-limits');

async function checkRateLimit(userId, maxRequests = 100, windowSeconds = 3600) {
  const key = `rate:${userId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;

  const current = (await rateLimitCache.get(key)) || 0;

  if (current >= maxRequests) {
    throw new Error('Rate limit exceeded');
  }

  // Increment counter
  await rateLimitCache.set(key, current + 1, windowSeconds);

  return {
    remaining: maxRequests - current - 1,
    resetTime: Math.ceil(Date.now() / 1000 / windowSeconds) * windowSeconds,
  };
}
```

## 🔧 Platform Setup

### **Local Development**

```bash
# No setup needed - uses memory automatically
npm start
```

### **Production with Docker**

```yaml
version: '3.8'
services:
  app:
    image: my-app
    environment:
      REDIS_URL: redis://redis:6379
  redis:
    image: redis:alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### **Production with Redis Cloud**

```bash
# Redis Cloud / AWS ElastiCache / Azure Redis
REDIS_URL=redis://username:password@your-redis-host:6379

# Redis Cluster
REDIS_URL=redis://user:pass@cluster.cache.amazonaws.com:6379
```

### **Vercel/Railway/Heroku**

```bash
# Just add Redis URL in dashboard
REDIS_URL=redis://your-redis-provider.com:6379
```

## 🔄 Development vs Production

### **Development Mode**

```bash
# No environment variables needed
NODE_ENV=development
```

```typescript
const cache = cacheClass.get('users');
// Strategy: Memory (in-process)
// Features: LRU eviction, TTL cleanup, memory limits
```

### **Production Mode**

```bash
# Redis required for scaling
NODE_ENV=production
REDIS_URL=redis://your-redis-host:6379
```

```typescript
const cache = cacheClass.get('users');
// Strategy: Redis (distributed)
// Features: Clustering, persistence, atomic operations
```

### **Scaling Pattern**

```typescript
// Week 1: Local development
// No Redis needed - works immediately

// Month 1: Add Redis
// Set REDIS_URL - zero code changes

// Year 1: Redis clustering
// Update REDIS_URL to cluster - automatic scaling
```

## 🧪 Testing

```typescript
import { cacheClass } from '@bloomneo/appkit/cache';

describe('Cache Tests', () => {
  afterEach(async () => {
    // flushAll() clears cached data between individual tests.
    // Use disconnectAll() only for full end-of-suite teardown.
    await cacheClass.flushAll();
  });

  test('basic caching', async () => {
    const cache = cacheClass.get('test');

    await cache.set('key', 'value', 60);
    const result = await cache.get('key');

    expect(result).toBe('value');
  });

  test('cache miss returns null', async () => {
    const cache = cacheClass.get('test');
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  test('namespace isolation', async () => {
    const cache1 = cacheClass.get('namespace1');
    const cache2 = cacheClass.get('namespace2');

    await cache1.set('key', 'value1');
    await cache2.set('key', 'value2');

    expect(await cache1.get('key')).toBe('value1');
    expect(await cache2.get('key')).toBe('value2');
  });
});
```

### **Force Memory Strategy for Tests**

```typescript
describe('Cache with Memory Strategy', () => {
  beforeEach(async () => {
    // Force memory strategy — no Redis required in CI
    await cacheClass.reset({
      strategy: 'memory',
      memory: {
        maxItems: 1000,
        maxSizeBytes: 1048576, // 1MB
        checkInterval: 60000,
      },
    });
  });

  afterEach(async () => {
    await cacheClass.flushAll(); // clear data; disconnectAll() is for full teardown
  });
});
```

## 📈 Performance

- **Memory Strategy**: ~0.1ms per operation
- **Redis Strategy**: ~1-5ms per operation (network dependent)
- **Automatic Strategy**: Zero overhead detection
- **TTL Cleanup**: Background cleanup with minimal impact
- **Memory Usage**: Configurable limits with LRU eviction
- **Redis Clustering**: Horizontal scaling support

## 💰 Cost Comparison

| Strategy   | Speed            | Persistence | Scaling       | Best For                     |
| ---------- | ---------------- | ----------- | ------------- | ---------------------------- |
| **Memory** | Fastest (~0.1ms) | No          | Single server | Development, testing         |
| **Redis**  | Fast (~1-5ms)    | Yes         | Multi-server  | Production, distributed apps |

## 🔍 TypeScript Support

```typescript
import { cacheClass, CacheError } from '@bloomneo/appkit/cache';
import type { Cache } from '@bloomneo/appkit/cache';

// Generics — no casting needed
const cache: Cache = cacheClass.get('users');
const user = await cache.get<User>('user:123');           // User | null
const ok   = await cache.set<User>('user:123', userData); // boolean
const list = await cache.getOrSet<User[]>('all', fetchUsers, 60); // User[]

// Type-narrow infrastructure errors
try {
  await cache.set('key', value);
} catch (err) {
  if (err instanceof CacheError) {
    console.error(err.code);    // 'CACHE_SET_FAILED' | 'CACHE_INVALID_KEY' | ...
    console.error(err.message); // '[@bloomneo/appkit/cache] set failed for key ...'
  }
}
```

### **CacheError codes**

| Code | When |
|---|---|
| `CACHE_CONNECT_FAILED` | Strategy failed to connect (Redis unreachable) |
| `CACHE_GET_FAILED` | Strategy threw during `get` |
| `CACHE_SET_FAILED` | Strategy threw during `set` |
| `CACHE_DELETE_FAILED` | Strategy threw during `delete` |
| `CACHE_CLEAR_FAILED` | Strategy threw during `clear` |
| `CACHE_INVALID_KEY` | Key is empty, too long, or contains newline characters |
| `CACHE_INVALID_VALUE` | Value is `undefined` or not JSON-serializable |
| `CACHE_INVALID_NAMESPACE` | Namespace is empty or contains invalid characters |
| `CACHE_INVALID_STRATEGY` | Configured strategy is neither `redis` nor `memory` |
| `CACHE_ERROR` | Generic fallback (use when no specific code fits) |

## 🆚 Why Not Redis directly?

**Other approaches:**

```javascript
// Redis directly: Complex setup, manual serialization
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

await client.connect();
const user = JSON.parse(await client.get('user:123'));
await client.setEx('user:123', 3600, JSON.stringify(userData));
```

**This library:**

```typescript
// 3 lines, automatic Redis/Memory, built-in serialization
import { cacheClass } from '@bloomneo/appkit/cache';
const cache = cacheClass.get('users');
await cache.set('user:123', userData, 3600);
```

**Same features, 90% less code, automatic strategy selection.**

## Agent-Dev Friendliness Score

**Score: 89.1/100 — 🟢 Exemplary** *(no cap)*
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../docs/AGENT_DEV_SCORING_ALGORITHM.md) v1.1*
*Delta vs previous (75.3, 2026-04-11): **+13.8***

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **10** | Every method referenced in README, `examples/cache.ts`, cookbook, and `llms.txt` exists in source. Fresh audit, no hallucinations. |
| 2 | Doc consistency | **10** | README, llms.txt, AGENTS.md, examples, and 3 cookbook recipes all use `cacheClass.get(namespace)` with identical signatures. |
| 3 | Runtime verification | **10** | 382-line `cache.test.ts` exercises every public method; fresh `examples/cache.ts` runtime-verified today. |
| 4 | Type safety | **9** | `Cache` interface now uses generics: `get<T>() → Promise<T \| null>`, `set<T>()`, `getOrSet<T>()`. No `any` on the public surface (strategy-internal `any` is not exported). |
| 5 | Discoverability | **10** | `package.json` description is prompt-shaped, README hero is a copy-pasteable 3-line import, one canonical pattern. |
| 6 | Example completeness | **9** | `examples/cache.ts` covers get/set/delete/clear/getOrSet + every utility method (`getStrategy`, `hasRedis`, `getActiveNamespaces`, `getConfig`, `flushAll`, `disconnectAll`). |
| 7 | Composability | **9** | Used in 3 cookbook recipes (`real-time-chat`, `multi-tenant-saas`, `file-upload-pipeline`) composing cache with auth/db/event. |
| 8 | Educational errors | **7** | All throws use `[@bloomneo/appkit/cache] …` prefix + stable `code` (e.g. `CACHE_INVALID_KEY`). Missing DOCS_URL anchor. |
| 9 | Convention enforcement | **9** | Exactly one way to construct (`cacheClass.get`), one teardown pattern (`flushAll` per-test / `disconnectAll` per-suite), explicitly documented. |
| 10 | Drift prevention | **5** | Tests catch runtime drift; no scripted doc-vs-source checker. |
| 11 | Reading order | **9** | README → Quick Start → API → examples → cookbook forms a complete path; all internal links resolve. |
| **12** | **Simplicity** | **8** | 5 instance ops + 8 class utilities. 80% case uses 3 methods (`get`, `set`, `getOrSet`). |
| **13** | **Clarity** | **8** | Previous `cacheClass.clear()` collision is gone — teardown now uses distinct names (`flushAll` / `disconnectAll` / `shutdown`). `getOrSet`, `hasRedis`, `getActiveNamespaces` all self-documenting. |
| **14** | **Unambiguity** | **8** | `getOrSet` explicitly documents cached-null handling via `has()` membership check. `flushAll` vs `disconnectAll` semantics spelled out inline in both source and README. |
| **15** | **Learning curve** | **10** | Zero config, first working call in < 2 minutes from README hero alone. Strategy auto-detected from `REDIS_URL`. |

### Weighted (v1.1)

```
(10×.12)+(10×.08)+(10×.09)+(9×.06)+(10×.06)+(9×.08)+(9×.06)+(7×.05)+(9×.05)+(5×.04)+(9×.03)
+(8×.09)+(8×.09)+(8×.05)+(10×.05)
= 1.20+0.80+0.90+0.54+0.60+0.72+0.54+0.35+0.45+0.20+0.27
 +0.72+0.72+0.40+0.50
= 8.91 → 89.1/100
No anti-pattern cap (examples compile and run; no hallucinations; no contradicting docs; no `any` on public inputs).
```

### Gaps to close to reach 95+

1. **D10 Drift prevention → 9**: Add a CI script that greps every doc file for `cache.<method>(` / `cacheClass.<method>(` and asserts each name against the exported surface in `dist/types/cache/index.d.ts`.
2. **D8 Educational errors → 9**: Append `See https://…/cache#<code>` anchors to each `CacheError` message, as the auth module does.
3. **D13/D14 → 9**: Collapse the 8 `cacheClass.*` utility methods by dropping `getStrategy`/`getConfig` (subsumed by `getConfig().strategy`) and merging `shutdown` into `disconnectAll`. Shrinks surface area; removes the `shutdown` vs `disconnectAll` choice.

**Realistic ceiling:** ~94/100 with fixes 1–3.

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo">Bloomneo Team</a></strong><br>
  Because caching should be simple, not a Redis nightmare.
</p>
