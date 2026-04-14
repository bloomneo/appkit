/**
 * Vitest tests for the cache module.
 *
 * All tests use the memory strategy (no Redis required). This is the
 * correct way to test cache logic in CI environments — force memory via
 * cacheClass.reset({ strategy: 'memory' }) before each test.
 *
 * What this catches:
 *   - Hallucinated method names (every public method is exercised here)
 *   - Namespace isolation guarantees
 *   - getOrSet cache-miss vs cache-hit behavior
 *   - Key validation rules
 *   - cacheClass utility method correctness
 *   - Drift between this file and src/cache/cache.ts + src/cache/index.ts
 *
 * If you add or rename a public method, update this file in the same change.
 *
 * @file src/cache/cache.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cacheClass, CacheError } from './index.js';

// Force memory strategy for all tests — no Redis needed.
beforeEach(async () => {
  await cacheClass.reset({ strategy: 'memory' } as any);
});

afterEach(async () => {
  // flushAll() clears cached data between individual tests.
  // disconnectAll() is reserved for full suite teardown.
  await cacheClass.flushAll();
});

// ─── cacheClass.get() ───────────────────────────────────────────────────────

describe('cacheClass.get()', () => {
  it('returns a cache instance for a valid namespace', () => {
    const cache = cacheClass.get('users');
    expect(cache).toBeDefined();
    expect(typeof cache).toBe('object');
  });

  it('returns the same instance for the same namespace (singleton)', () => {
    const a = cacheClass.get('users');
    const b = cacheClass.get('users');
    expect(a).toBe(b);
  });

  it('returns different instances for different namespaces', () => {
    const a = cacheClass.get('users');
    const b = cacheClass.get('sessions');
    expect(a).not.toBe(b);
  });

  it('throws on empty namespace', () => {
    expect(() => cacheClass.get('')).toThrow(/namespace/i);
  });

  it('throws on namespace with invalid characters', () => {
    expect(() => cacheClass.get('bad:name')).toThrow(/namespace/i);
  });

  it('accepts namespaces with hyphens and underscores', () => {
    expect(() => cacheClass.get('my-cache_v2')).not.toThrow();
  });
});

// ─── cache.set() / cache.get() ──────────────────────────────────────────────

describe('cache.set() and cache.get()', () => {
  it('set returns true and get returns the stored value', async () => {
    const cache = cacheClass.get('test');
    const ok = await cache.set('key1', { name: 'Alice' }, 60);
    expect(ok).toBe(true);
    const result = await cache.get('key1');
    expect(result).toEqual({ name: 'Alice' });
  });

  it('get returns null for a missing key (never throws)', async () => {
    const cache = cacheClass.get('test');
    const result = await cache.get('does-not-exist');
    expect(result).toBeNull();
  });

  it('stores and retrieves strings', async () => {
    const cache = cacheClass.get('test');
    await cache.set('str', 'hello', 60);
    expect(await cache.get('str')).toBe('hello');
  });

  it('stores and retrieves numbers', async () => {
    const cache = cacheClass.get('test');
    await cache.set('num', 42, 60);
    expect(await cache.get('num')).toBe(42);
  });

  it('stores and retrieves arrays', async () => {
    const cache = cacheClass.get('test');
    await cache.set('arr', [1, 2, 3], 60);
    expect(await cache.get('arr')).toEqual([1, 2, 3]);
  });

  it('allows the canonical Redis colon idiom in keys (user:123, session:abc)', async () => {
    const cache = cacheClass.get('test');
    await cache.set('user:123', { name: 'Alice' }, 60);
    expect(await cache.get('user:123')).toEqual({ name: 'Alice' });
    // Delete round-trips too — colons are not special on the consumer side.
    await cache.delete('user:123');
    expect(await cache.get('user:123')).toBeNull();
  });

  it('throws CacheError on key with newline', async () => {
    const cache = cacheClass.get('test');
    await expect(cache.set('bad\nkey', 'value', 60)).rejects.toThrow(CacheError);
    await expect(cache.set('bad\nkey', 'value', 60)).rejects.toThrow(/newline/i);
  });

  it('throws CacheError on empty key', async () => {
    const cache = cacheClass.get('test');
    await expect(cache.set('', 'value', 60)).rejects.toThrow(CacheError);
  });

  it('throws CacheError on undefined value', async () => {
    const cache = cacheClass.get('test');
    await expect(cache.set('key', undefined, 60)).rejects.toThrow(CacheError);
  });
});

// ─── cache.delete() ─────────────────────────────────────────────────────────

describe('cache.delete()', () => {
  it('removes a previously set key', async () => {
    const cache = cacheClass.get('test');
    await cache.set('toDelete', 'value', 60);
    await cache.delete('toDelete');
    expect(await cache.get('toDelete')).toBeNull();
  });

  it('returns false (does not throw) when deleting a missing key', async () => {
    const cache = cacheClass.get('test');
    // Deleting a non-existent key is not an error — strategy returns false.
    const result = await cache.delete('nonexistent');
    expect(result).toBe(false);
  });
});

// ─── cache.clear() ──────────────────────────────────────────────────────────

describe('cache.clear()', () => {
  it('removes all keys in the namespace', async () => {
    const cache = cacheClass.get('test');
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    await cache.clear();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('only clears the target namespace, not others', async () => {
    const c1 = cacheClass.get('ns1');
    const c2 = cacheClass.get('ns2');
    await c1.set('key', 'value1', 60);
    await c2.set('key', 'value2', 60);
    await c1.clear();
    expect(await c1.get('key')).toBeNull();
    expect(await c2.get('key')).toBe('value2'); // unaffected
  });
});

// ─── cache.getOrSet() ───────────────────────────────────────────────────────

describe('cache.getOrSet()', () => {
  it('calls factory on cache miss and returns its result', async () => {
    const cache = cacheClass.get('test');
    let callCount = 0;
    const result = await cache.getOrSet('computed', async () => {
      callCount++;
      return { computed: true };
    }, 60);
    expect(result).toEqual({ computed: true });
    expect(callCount).toBe(1);
  });

  it('does NOT call factory on cache hit', async () => {
    const cache = cacheClass.get('test');
    await cache.set('hot', 'cached-value', 60);
    let callCount = 0;
    const result = await cache.getOrSet('hot', async () => {
      callCount++;
      return 'fresh-value';
    }, 60);
    expect(result).toBe('cached-value');
    expect(callCount).toBe(0);
  });

  it('caches the factory result so second call hits cache', async () => {
    const cache = cacheClass.get('test');
    let callCount = 0;
    const factory = async () => { callCount++; return 42; };
    await cache.getOrSet('computed2', factory, 60);
    await cache.getOrSet('computed2', factory, 60);
    expect(callCount).toBe(1); // factory called only once
  });

  it('re-throws factory errors as-is (not wrapped in CacheError)', async () => {
    const cache = cacheClass.get('test');
    const factoryError = new Error('db down');
    await expect(
      cache.getOrSet('fail', async () => { throw factoryError; }, 60)
    ).rejects.toThrow('db down');
    // Factory errors are NOT CacheError — they come from your code, not the cache layer
    await expect(
      cache.getOrSet('fail2', async () => { throw factoryError; }, 60)
    ).rejects.not.toThrow(CacheError);
    // Value is not cached on factory error
    expect(await cache.get('fail')).toBeNull();
  });
});

// ─── cache.getStrategy() / cache.getConfig() ────────────────────────────────

describe('cache instance utility methods', () => {
  it('getStrategy() returns the active strategy string', () => {
    const cache = cacheClass.get('test');
    const strategy = cache.getStrategy();
    expect(typeof strategy).toBe('string');
    expect(['redis', 'memory']).toContain(strategy);
  });

  it('getConfig() returns an object with expected keys', () => {
    const cache = cacheClass.get('test');
    const config = cache.getConfig();
    expect(config).toHaveProperty('strategy');
    expect(config).toHaveProperty('namespace');
    expect(config).toHaveProperty('keyPrefix');
    expect(config).toHaveProperty('defaultTTL');
    expect(config).toHaveProperty('connected');
  });
});

// ─── cacheClass utility methods ─────────────────────────────────────────────

describe('cacheClass utility methods', () => {
  it('getStrategy() returns a valid strategy string', () => {
    const s = cacheClass.getStrategy();
    expect(['redis', 'memory']).toContain(s);
  });

  it('getActiveNamespaces() returns an array', () => {
    cacheClass.get('alpha');
    cacheClass.get('beta');
    const namespaces = cacheClass.getActiveNamespaces();
    expect(Array.isArray(namespaces)).toBe(true);
    expect(namespaces).toContain('alpha');
    expect(namespaces).toContain('beta');
  });

  it('getConfig() returns an object with strategy and defaultTTL', () => {
    const config = cacheClass.getConfig();
    expect(config).toHaveProperty('strategy');
    expect(config).toHaveProperty('defaultTTL');
    expect(config).toHaveProperty('keyPrefix');
    expect(config).toHaveProperty('activeNamespaces');
  });

  it('hasRedis() returns a boolean', () => {
    expect(typeof cacheClass.hasRedis()).toBe('boolean');
  });

  it('flushAll() clears all data without throwing', async () => {
    const cache = cacheClass.get('flush-test');
    await cache.set('x', 1, 60);
    const result = await cacheClass.flushAll();
    expect(typeof result).toBe('boolean');
    expect(await cache.get('x')).toBeNull();
  });
});

// ─── Namespace isolation (full matrix) ──────────────────────────────────────

describe('Namespace isolation', () => {
  it('same key in different namespaces returns different values', async () => {
    const user = cacheClass.get('users');
    const session = cacheClass.get('sessions');
    await user.set('id123', { role: 'admin' }, 60);
    await session.set('id123', { token: 'abc' }, 60);
    expect(await user.get('id123')).toEqual({ role: 'admin' });
    expect(await session.get('id123')).toEqual({ token: 'abc' });
  });
});

// ─── CacheError shape ───────────────────────────────────────────────────────

describe('CacheError', () => {
  it('is an instance of Error', () => {
    const e = new CacheError('test message', { code: 'CACHE_GET_FAILED' });
    expect(e instanceof Error).toBe(true);
    expect(e instanceof CacheError).toBe(true);
  });

  it('has the correct name and code', () => {
    const e = new CacheError('test', { code: 'CACHE_SET_FAILED' });
    expect(e.name).toBe('CacheError');
    expect(e.code).toBe('CACHE_SET_FAILED');
  });

  it('prefixes the message with [@bloomneo/appkit/cache]', () => {
    const e = new CacheError('something went wrong');
    expect(e.message).toContain('[@bloomneo/appkit/cache]');
    expect(e.message).toContain('something went wrong');
  });

  it('defaults code to CACHE_ERROR when not provided', () => {
    const e = new CacheError('oops');
    expect(e.code).toBe('CACHE_ERROR');
  });

  it('key validation throws CacheError (verifies caller can instanceof-check)', async () => {
    const cache = cacheClass.get('test');
    try {
      await cache.get('bad\nkey');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err instanceof CacheError).toBe(true);
    }
  });
});

// ─── Public API surface — drift check ───────────────────────────────────────

describe('Public API surface — drift check', () => {
  // Update this list if you add or rename a method on cacheClass.
  const CACHECLASS_METHODS = [
    'get', 'disconnectAll', 'reset', 'getStrategy', 'getActiveNamespaces',
    'getConfig', 'hasRedis', 'flushAll', 'shutdown',
  ];

  // Update this list if you add or rename a method on a Cache instance.
  const CACHE_INSTANCE_METHODS = [
    'get', 'set', 'delete', 'clear', 'getOrSet', 'getStrategy', 'getConfig',
  ];

  // Methods that MUST NOT exist — hallucinations from earlier docs.
  const HALLUCINATED_CACHE_INSTANCE_METHODS = [
    'del',   // wrong name — real name is delete()
    'has',   // internal CacheStrategy method, not public on Cache interface
  ];

  // cacheClass-level methods that must NOT exist (old names).
  const RENAMED_CACHECLASS_METHODS = [
    'clear', // renamed to disconnectAll() to eliminate collision with cache.clear()
  ];

  for (const method of CACHECLASS_METHODS) {
    it(`cacheClass.${method} exists and is a function`, () => {
      expect(typeof (cacheClass as any)[method]).toBe('function');
    });
  }

  const instance = cacheClass.get('drift-check');

  for (const method of CACHE_INSTANCE_METHODS) {
    it(`cache instance .${method} exists and is a function`, () => {
      expect(typeof (instance as any)[method]).toBe('function');
    });
  }

  for (const method of HALLUCINATED_CACHE_INSTANCE_METHODS) {
    it(`cache instance .${method} does NOT exist on public Cache interface`, () => {
      // If this starts failing, the method was added to CacheClass — update
      // CACHE_INSTANCE_METHODS above and remove from HALLUCINATED list.
      expect(typeof (instance as any)[method]).not.toBe('function');
    });
  }

  for (const method of RENAMED_CACHECLASS_METHODS) {
    it(`cacheClass.${method} does NOT exist (was renamed to eliminate naming collision)`, () => {
      expect(typeof (cacheClass as any)[method]).not.toBe('function');
    });
  }
});
