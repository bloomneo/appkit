/**
 * Ultra-simple caching that just works with automatic Redis/Memory strategy selection
 * @module @bloomneo/appkit/cache
 * @file src/cache/index.ts
 * 
 * @llm-rule WHEN: Building apps that need caching with zero configuration
 * @llm-rule AVOID: Complex cache setups - this auto-detects Redis vs Memory from environment
 * @llm-rule NOTE: Uses cacheClass.get(namespace) pattern like auth - get() → cache.set() → done
 * @llm-rule NOTE: Common pattern - cacheClass.get('users') → cache.set('user:123', data) → cache.get('user:123')
 */

import { CacheClass, CacheError } from './cache.js';
import { getSmartDefaults, type CacheConfig } from './defaults.js';

// Global cache instances for performance (like auth module)
let globalConfig: CacheConfig | null = null;
const namedCaches = new Map<string, CacheClass>();

export interface Cache {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  getOrSet<T = unknown>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
  getStrategy(): string;
  getConfig(): { strategy: string; keyPrefix: string; namespace: string; defaultTTL: number; connected: boolean };
}

/**
 * Get cache instance for specific namespace - the only function you need to learn
 * Strategy auto-detected from environment (REDIS_URL = Redis, no REDIS_URL = Memory)
 * @llm-rule WHEN: Need caching in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating CacheClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get(namespace) → cache.set() → cache.get() → cached data
 */
function get(namespace?: string): Cache {
  // Lazy initialization - parse environment once (like auth)
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }

  // If no namespace is passed, fall back to BLOOM_CACHE_NAMESPACE, then 'app'.
  const resolvedNamespace = namespace ?? globalConfig.namespace ?? 'app';

  // Validate namespace
  if (!resolvedNamespace || typeof resolvedNamespace !== 'string') {
    throw new CacheError('Cache namespace must be a non-empty string', {
      code: 'CACHE_INVALID_NAMESPACE',
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(resolvedNamespace)) {
    throw new CacheError(
      `Cache namespace "${resolvedNamespace}" must contain only letters, numbers, underscores, and hyphens`,
      { code: 'CACHE_INVALID_NAMESPACE' },
    );
  }

  // Return cached instance if exists
  if (namedCaches.has(resolvedNamespace)) {
    return namedCaches.get(resolvedNamespace)!;
  }

  // Create new cache instance for namespace
  const cacheInstance = new CacheClass(globalConfig, resolvedNamespace);
  
  // Auto-connect on first use
  cacheInstance.connect().catch((error) => {
    console.error(`[@bloomneo/appkit/cache] Auto-connect failed for namespace "${resolvedNamespace}":`, error.message);
  });

  namedCaches.set(resolvedNamespace, cacheInstance);
  return cacheInstance;
}

/**
 * Disconnect all cache instances and reset internal state.
 * Use this for full teardown (e.g., end-of-suite cleanup, graceful shutdown).
 * For clearing cached data between individual tests use clearAll().
 *
 * @llm-rule WHEN: End-of-test-suite teardown, app shutdown, or SIGTERM handler
 * @llm-rule AVOID: Calling between individual tests — use clearAll() instead
 */
async function disconnectAll(): Promise<void> {
  const disconnectPromises: Promise<void>[] = [];

  for (const [namespace, cache] of namedCaches) {
    disconnectPromises.push(
      cache.disconnect().catch((error) => {
        console.error(`[@bloomneo/appkit/cache] Disconnect failed for namespace "${namespace}":`, error.message);
      })
    );
  }

  await Promise.all(disconnectPromises);
  namedCaches.clear();
  globalConfig = null;
}

/**
 * Reset cache configuration (useful for testing)
 * @llm-rule WHEN: Testing cache logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
async function reset(newConfig?: Partial<CacheConfig>): Promise<void> {
  // Disconnect existing instances before reconfiguring
  await disconnectAll();

  // Reset configuration
  if (newConfig) {
    const defaults = getSmartDefaults();
    globalConfig = { ...defaults, ...newConfig };
  } else {
    globalConfig = null; // Will reload from environment on next get()
  }
}

/**
 * Get active cache strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Redis vs Memory)
 * @llm-rule AVOID: Using for application logic - cache should be transparent
 */
function getStrategy(): string {
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }
  return globalConfig.strategy;
}

/**
 * Get all active cache namespaces
 * @llm-rule WHEN: Debugging or monitoring which cache namespaces are active
 * @llm-rule AVOID: Using for business logic - this is for observability only
 */
function getActiveNamespaces(): string[] {
  return Array.from(namedCaches.keys());
}

/**
 * Get cache configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging cache configuration
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
function getConfig(): {
  strategy: string;
  keyPrefix: string;
  defaultTTL: number;
  activeNamespaces: string[];
  environment: string;
} {
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }

  return {
    strategy: globalConfig.strategy,
    keyPrefix: globalConfig.keyPrefix,
    defaultTTL: globalConfig.defaultTTL,
    activeNamespaces: getActiveNamespaces(),
    environment: globalConfig.environment.nodeEnv,
  };
}

/**
 * Check if Redis is available and configured
 * @llm-rule WHEN: Conditional logic based on cache capabilities
 * @llm-rule AVOID: Complex cache detection - just use cache normally, it handles strategy
 */
function hasRedis(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Clear all cached data across all namespaces (keeps connections open).
 * @llm-rule WHEN: Between tests, or emergency cache clearing
 * @llm-rule AVOID: Using in production - this clears ALL cached data in ALL namespaces
 * @llm-rule NOTE: Use disconnectAll() instead for full teardown (closes connections)
 */
async function clearAll(): Promise<boolean> {
  try {
    const clearPromises: Promise<boolean>[] = [];

    for (const cache of namedCaches.values()) {
      clearPromises.push(cache.clear());
    }

    const results = await Promise.all(clearPromises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('[@bloomneo/appkit/cache] clearAll error:', (error as Error).message);
    return false;
  }
}

/**
 * Single caching export with minimal API (like auth module)
 */
export const cacheClass = {
  // Core method (like auth.get())
  get,

  // Bulk ops
  clearAll,       // Clears cached data across all namespaces (keeps connections). Use between tests.
  disconnectAll,  // Disconnects all instances + resets state. Use for teardown / graceful shutdown.

  // Utility methods
  reset,
  getStrategy,
  getActiveNamespaces,
  getConfig,
  hasRedis,
} as const;

// Re-export types and error class for consumers
export type { CacheConfig } from './defaults.js';
export { CacheClass, CacheError } from './cache.js';

// Default export
export default cacheClass;

// Graceful shutdown is opt-in. The library does not register process signal
// handlers — the host app owns its lifecycle. Wire it up yourself:
//
//   import cacheClass from '@bloomneo/appkit/cache';
//   process.on('SIGTERM', () => cacheClass.disconnectAll().finally(() => process.exit(0)));
//   process.on('SIGINT',  () => cacheClass.disconnectAll().finally(() => process.exit(0)));