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
// ✅ CORRECT - Graceful cache degradation
async function getUser(id) {
  try {
    // Try cache first
    let user = await userCache.get(`user:${id}`);

    if (!user) {
      // Cache miss - get from database
      user = await database.getUser(id);

      // Cache for 1 hour (ignore cache errors)
      await userCache.set(`user:${id}`, user, 3600);
    }

    return user;
  } catch (error) {
    console.error('Cache error:', error.message);
    // Fallback to database on cache failure
    return await database.getUser(id);
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
  await cacheClass.clear(); // Clean up between tests
});
```

## 🚨 Error Handling Patterns

### **Cache-Aside with Fallback**

```typescript
async function getUserProfile(userId) {
  const cache = cacheClass.get('profiles');

  try {
    // Try cache first
    let profile = await cache.get(`profile:${userId}`);

    if (!profile) {
      // Cache miss - get from database
      profile = await database.getUserProfile(userId);

      if (profile) {
        // Cache for 30 minutes
        await cache.set(`profile:${userId}`, profile, 1800);
      }
    }

    return profile;
  } catch (error) {
    console.error('Cache error:', error.message);

    // Always fallback to database on cache failure
    return await database.getUserProfile(userId);
  }
}
```

### **Session Management with Error Recovery**

```typescript
async function getSession(sessionId) {
  const cache = cacheClass.get('sessions');

  try {
    const session = await cache.get(`session:${sessionId}`);

    if (!session) {
      throw new Error('Session not found or expired');
    }

    return session;
  } catch (error) {
    if (error.message.includes('Session not found')) {
      throw error; // Re-throw session errors
    }

    console.error('Cache error:', error.message);
    // For cache infrastructure errors, return null
    return null;
  }
}

async function createSession(userId) {
  const cache = cacheClass.get('sessions');
  const sessionId = crypto.randomUUID();
  const sessionData = { userId, loginTime: Date.now() };

  try {
    // Store for 2 hours
    await cache.set(`session:${sessionId}`, sessionData, 7200);
    return sessionId;
  } catch (error) {
    console.error('Failed to cache session:', error.message);
    // Continue without cache - session creation still succeeds
    return sessionId;
  }
}
```

### **API Response Caching**

```typescript
async function getWeatherData(city) {
  const cache = cacheClass.get('weather');
  const cacheKey = `weather:${city.toLowerCase()}`;

  try {
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    // Fetch fresh data
    const response = await fetch(
      `https://api.weather.com/v1/weather?q=${city}`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache for 30 minutes
    await cache.set(cacheKey, data, 1800);

    return { ...data, source: 'api' };
  } catch (error) {
    console.error('Weather fetch error:', error.message);

    // Try to return stale cache data
    try {
      const staleData = await cache.get(cacheKey);
      if (staleData) {
        console.warn('Returning stale weather data due to API error');
        return { ...staleData, source: 'stale' };
      }
    } catch (cacheError) {
      console.error('Stale cache retrieval failed:', cacheError.message);
    }

    throw error; // No fallback available
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
VOILA_CACHE_TTL=3600                    # 1 hour default TTL
VOILA_CACHE_REDIS_CONNECT_TIMEOUT=10000 # 10 second connect timeout
VOILA_CACHE_REDIS_COMMAND_TIMEOUT=5000  # 5 second command timeout
```

### **Production Checklist**

- ✅ **Redis Connection**: Set secure `REDIS_URL` with authentication
- ✅ **TTL Strategy**: Set appropriate `VOILA_CACHE_TTL` for your use case
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
VOILA_CACHE_MEMORY_MAX_ITEMS=10000      # Max items in memory
VOILA_CACHE_MEMORY_MAX_SIZE=100000000   # 100MB memory limit
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
    await cacheClass.clear(); // Clean up between tests
  });

  test('basic caching', async () => {
    const cache = cacheClass.get('test');

    await cache.set('key', 'value', 60);
    const result = await cache.get('key');

    expect(result).toBe('value');
  });

  test('cache expiration', async () => {
    const cache = cacheClass.get('test');

    await cache.set('temp', 'data', 1); // 1 second TTL

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = await cache.get('temp');
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

### **Mock Redis for Tests**

```typescript
describe('Cache with Memory Strategy', () => {
  beforeEach(async () => {
    // Force memory strategy for tests
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
    await cacheClass.clear();
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
import type { Cache } from '@bloomneo/appkit/cache';

// Strongly typed cache operations
const cache: Cache = cacheClass.get('users');
const user: User | null = await cache.get('user:123');

// Typed namespace operations
interface UserCache extends Cache {
  getUser(id: string): Promise<User | null>;
  setUser(id: string, user: User, ttl?: number): Promise<boolean>;
}
```

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

## 📄 License

MIT © [VoilaJSX](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo">Bloomneo Team</a></strong><br>
  Because caching should be simple, not a Redis nightmare.
</p>
