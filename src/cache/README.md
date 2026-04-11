# @bloomneo/appkit - Cache Module ⚡

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple caching that just works - One function, automatic Redis/Memory
> strategy, zero configuration

**One function** returns a cache object with automatic strategy selection. Zero
configuration needed, production-ready performance by default.

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
  // Missing: await cacheClass.clear();
});

// ✅ CORRECT - Proper test cleanup
afterEach(async () => {
  await cacheClass.flushAll(); // flushAll() clears data; clear() disconnects instances
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
    // flushAll() clears cached data. clear() disconnects all instances
    // (use only for full teardown, not between individual tests).
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
    await cacheClass.flushAll(); // clear data, keep instances alive
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
| `CACHE_INVALID_KEY` | Key is empty, too long, has colons or newlines |
| `CACHE_INVALID_VALUE` | Value is `undefined` or not JSON-serializable |
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

**Score: 75.3/100 — 🟡 Solid** *(no cap)*
*Scored 2026-04-11 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../AGENT_DEV_SCORING_ALGORITHM.md) v1.1*

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **9** | `examples/cache.ts` had `cache.has()` (not public) and `cache.del()` (wrong name) — both fixed. |
| 2 | Doc consistency | **9** | README now matches source after fixing test-cleanup pattern (`flushAll` vs `clear`). |
| 3 | Runtime verification | **9** | 49 vitest tests covering all public methods + drift-check section. |
| 4 | Type safety | **5** | `Cache` interface uses `any` for all values — no generics like `cache.get<T>()`. |
| 5 | Discoverability | **8** | Quick Start is clear and concise. |
| 6 | Example completeness | **7** | `examples/cache.ts` covers main patterns. Utility methods (`getConfig`, `getActiveNamespaces`) not shown. |
| 7 | Composability | **8** | `examples/cache.ts` now compiles. Patterns compose naturally. |
| 8 | Educational errors | **5** | Errors are plain English but missing `[@bloomneo/appkit/cache]` prefix + DOCS_URL anchor format used by auth module. |
| 9 | Convention enforcement | **9** | One canonical entry point: `cacheClass.get(namespace)`. Consistent across all examples. |
| 10 | Drift prevention | **5** | Drift-check section in test catches runtime drift. No scripted doc-vs-source checker. |
| 11 | Reading order | **8** | Quick Start → LLM ref → errors → API → examples → testing — no dead ends. |
| **12** | **Simplicity** | **8** | 5 core ops on instance + 9 class utilities. Dual surface is minimal. |
| **13** | **Clarity** | **6** | `cacheClass.clear()` (disconnects all instances) vs `cache.clear()` (clears namespace data) — same name, different effects. Confusing. |
| **14** | **Unambiguity** | **5** | The `clear()` collision is the dominant ambiguity — easy to call the wrong one in teardown. Also: `getOrSet` miss-then-throw behavior (does not cache error path) could surprise users. |
| **15** | **Learning curve** | **9** | Zero config. `cacheClass.get(ns) → cache.set/get/delete`. First call in < 2 minutes. |

### Weighted (v1.1)

```
(9×.12)+(9×.08)+(9×.09)+(5×.06)+(8×.06)+(7×.08)+(8×.06)+(5×.05)+(9×.05)+(5×.04)+(8×.03)
+(8×.09)+(6×.09)+(5×.05)+(9×.05) = 7.53 → 75.3/100
No anti-pattern cap (examples compile after fixes).
```

### Gaps to reach 🟢 90+

1. **D13/D14 → 9**: Rename `cacheClass.clear()` → `cacheClass.disconnect()` (or `shutdown()` — already exists) to eliminate the collision with `cache.clear()`. The two `clear()` callsites should behave consistently.
2. **D4 Type safety → 9**: Add generic overload `get<T>(key: string): Promise<T | null>` and `set<T>(key, value: T, ttl?)`.
3. **D8 Educational errors → 9**: Adopt `[@bloomneo/appkit/cache] message + DOCS_URL#anchor` format from auth module.
4. **D10 Drift prevention → 8**: Scripted doc-vs-source drift checker.

**Realistic ceiling:** ~88/100 with fixes 1–4.

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo">Bloomneo Team</a></strong><br>
  Because caching should be simple, not a Redis nightmare.
</p>
