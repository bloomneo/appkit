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
import { type CacheConfig } from './defaults.js';
export interface Cache {
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(key: string, value: T, ttl?: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<boolean>;
    getOrSet<T = unknown>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
    getStrategy(): string;
    getConfig(): {
        strategy: string;
        keyPrefix: string;
        namespace: string;
        defaultTTL: number;
        connected: boolean;
    };
}
/**
 * Get cache instance for specific namespace - the only function you need to learn
 * Strategy auto-detected from environment (REDIS_URL = Redis, no REDIS_URL = Memory)
 * @llm-rule WHEN: Need caching in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating CacheClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get(namespace) → cache.set() → cache.get() → cached data
 */
declare function get(namespace?: string): Cache;
/**
 * Disconnect all cache instances and reset internal state.
 * Use this for full teardown (e.g., end-of-suite cleanup, graceful shutdown).
 * For clearing cached data between individual tests use clearAll().
 *
 * @llm-rule WHEN: End-of-test-suite teardown, app shutdown, or SIGTERM handler
 * @llm-rule AVOID: Calling between individual tests — use clearAll() instead
 */
declare function disconnectAll(): Promise<void>;
/**
 * Reset cache configuration (useful for testing)
 * @llm-rule WHEN: Testing cache logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<CacheConfig>): Promise<void>;
/**
 * Get active cache strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Redis vs Memory)
 * @llm-rule AVOID: Using for application logic - cache should be transparent
 */
declare function getStrategy(): string;
/**
 * Get all active cache namespaces
 * @llm-rule WHEN: Debugging or monitoring which cache namespaces are active
 * @llm-rule AVOID: Using for business logic - this is for observability only
 */
declare function getActiveNamespaces(): string[];
/**
 * Get cache configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging cache configuration
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
declare function getConfig(): {
    strategy: string;
    keyPrefix: string;
    defaultTTL: number;
    activeNamespaces: string[];
    environment: string;
};
/**
 * Check if Redis is available and configured
 * @llm-rule WHEN: Conditional logic based on cache capabilities
 * @llm-rule AVOID: Complex cache detection - just use cache normally, it handles strategy
 */
declare function hasRedis(): boolean;
/**
 * Clear all cached data across all namespaces (keeps connections open).
 * @llm-rule WHEN: Between tests, or emergency cache clearing
 * @llm-rule AVOID: Using in production - this clears ALL cached data in ALL namespaces
 * @llm-rule NOTE: Use disconnectAll() instead for full teardown (closes connections)
 */
declare function clearAll(): Promise<boolean>;
/**
 * Single caching export with minimal API (like auth module)
 */
export declare const cacheClass: {
    readonly get: typeof get;
    readonly clearAll: typeof clearAll;
    readonly disconnectAll: typeof disconnectAll;
    readonly reset: typeof reset;
    readonly getStrategy: typeof getStrategy;
    readonly getActiveNamespaces: typeof getActiveNamespaces;
    readonly getConfig: typeof getConfig;
    readonly hasRedis: typeof hasRedis;
};
export type { CacheConfig } from './defaults.js';
export { CacheClass, CacheError } from './cache.js';
export default cacheClass;
//# sourceMappingURL=index.d.ts.map