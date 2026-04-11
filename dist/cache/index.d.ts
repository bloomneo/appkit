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
declare function get(namespace?: string): Cache;
/**
 * Clear all cache instances and disconnect - essential for testing
 * @llm-rule WHEN: Testing cache logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
declare function clear(): Promise<void>;
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
 * Flush all caches across all namespaces (dangerous)
 * @llm-rule WHEN: Testing or emergency cache clearing across all namespaces
 * @llm-rule AVOID: Using in production - this clears ALL cached data in ALL namespaces
 * @llm-rule NOTE: Only use for testing or emergency situations
 */
declare function flushAll(): Promise<boolean>;
/**
 * Graceful shutdown for all cache instances
 * @llm-rule WHEN: App shutdown or process termination
 * @llm-rule AVOID: Abrupt process exit - graceful shutdown prevents data loss
 */
declare function shutdown(): Promise<void>;
/**
 * Single caching export with minimal API (like auth module)
 */
export declare const cacheClass: {
    readonly get: typeof get;
    readonly clear: typeof clear;
    readonly reset: typeof reset;
    readonly getStrategy: typeof getStrategy;
    readonly getActiveNamespaces: typeof getActiveNamespaces;
    readonly getConfig: typeof getConfig;
    readonly hasRedis: typeof hasRedis;
    readonly flushAll: typeof flushAll;
    readonly shutdown: typeof shutdown;
};
export type { CacheConfig } from './defaults.js';
export { CacheClass } from './cache.js';
export default cacheClass;
//# sourceMappingURL=index.d.ts.map