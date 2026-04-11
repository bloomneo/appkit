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

import { CacheClass } from './cache.js';
import { getSmartDefaults, type CacheConfig } from './defaults.js';

// Global cache instances for performance (like auth module)
let globalConfig: CacheConfig | null = null;
const namedCaches = new Map<string, CacheClass>();

export interface Cache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  getOrSet(key: string, factory: () => Promise<any>, ttl?: number): Promise<any>;
  getStrategy(): string;
  getConfig(): any;
}

/**
 * Get cache instance for specific namespace - the only function you need to learn
 * Strategy auto-detected from environment (REDIS_URL = Redis, no REDIS_URL = Memory)
 * @llm-rule WHEN: Need caching in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating CacheClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get(namespace) → cache.set() → cache.get() → cached data
 */
function get(namespace: string = 'app'): Cache {
  // Validate namespace
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('Cache namespace must be a non-empty string');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(namespace)) {
    throw new Error('Cache namespace must contain only letters, numbers, underscores, and hyphens');
  }

  // Lazy initialization - parse environment once (like auth)
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }

  // Return cached instance if exists
  if (namedCaches.has(namespace)) {
    return namedCaches.get(namespace)!;
  }

  // Create new cache instance for namespace
  const cacheInstance = new CacheClass(globalConfig, namespace);
  
  // Auto-connect on first use
  cacheInstance.connect().catch((error) => {
    console.error(`[AppKit] Cache auto-connect failed for namespace "${namespace}":`, error.message);
  });

  namedCaches.set(namespace, cacheInstance);
  return cacheInstance;
}

/**
 * Clear all cache instances and disconnect - essential for testing
 * @llm-rule WHEN: Testing cache logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
async function clear(): Promise<void> {
  const disconnectPromises: Promise<void>[] = [];

  for (const [namespace, cache] of namedCaches) {
    disconnectPromises.push(
      cache.disconnect().catch((error) => {
        console.error(`[AppKit] Cache disconnect failed for namespace "${namespace}":`, error.message);
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
  // Clear existing instances
  await clear();

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
 * Flush all caches across all namespaces (dangerous)
 * @llm-rule WHEN: Testing or emergency cache clearing across all namespaces
 * @llm-rule AVOID: Using in production - this clears ALL cached data in ALL namespaces
 * @llm-rule NOTE: Only use for testing or emergency situations
 */
async function flushAll(): Promise<boolean> {
  try {
    const clearPromises: Promise<boolean>[] = [];

    for (const cache of namedCaches.values()) {
      clearPromises.push(cache.clear());
    }

    const results = await Promise.all(clearPromises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('[AppKit] Cache flushAll error:', (error as Error).message);
    return false;
  }
}

/**
 * Graceful shutdown for all cache instances
 * @llm-rule WHEN: App shutdown or process termination
 * @llm-rule AVOID: Abrupt process exit - graceful shutdown prevents data loss
 */
async function shutdown(): Promise<void> {
  console.log('🔄 [AppKit] Cache graceful shutdown...');
  
  try {
    await clear();
    console.log('✅ [AppKit] Cache shutdown complete');
  } catch (error) {
    console.error('❌ [AppKit] Cache shutdown error:', (error as Error).message);
  }
}

/**
 * Single caching export with minimal API (like auth module)
 */
export const cacheClass = {
  // Core method (like auth.get())
  get,
  
  // Utility methods
  clear,
  reset,
  getStrategy,
  getActiveNamespaces,
  getConfig,
  hasRedis,
  flushAll,
  shutdown,
} as const;

// Re-export types for consumers
export type { CacheConfig } from './defaults.js';
export { CacheClass } from './cache.js';

// Default export
export default cacheClass;

// Auto-setup graceful shutdown handlers
if (typeof process !== 'undefined') {
  // Handle graceful shutdown
  const shutdownHandler = () => {
    shutdown().finally(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[AppKit] Uncaught exception during cache operation:', error);
    shutdown().finally(() => {
      process.exit(1);
    });
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[AppKit] Unhandled rejection during cache operation:', reason);
    shutdown().finally(() => {
      process.exit(1);
    });
  });
}