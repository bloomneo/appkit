/**
 * Core cache class with Redis and Memory strategies and simplified API
 * @module @bloomneo/appkit/cache
 * @file src/cache/cache.ts
 *
 * @llm-rule WHEN: Building apps that need caching with automatic strategy selection
 * @llm-rule AVOID: Using directly - always get instance via cacheClass.get()
 * @llm-rule NOTE: Auto-detects Redis vs Memory from environment, namespace passed to get() function
 */
import type { CacheConfig } from './defaults.js';
export interface CacheStrategy {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<boolean>;
    has(key: string): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
    deleteMany(keys: string[]): Promise<number>;
}
/**
 * Cache class with automatic strategy selection and ultra-simple API
 */
export declare class CacheClass {
    config: CacheConfig;
    namespace: string;
    private strategy;
    private connected;
    constructor(config: CacheConfig, namespace: string);
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Cache initialization - selects Redis or Memory based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    private createStrategy;
    /**
     * Connects to cache backend with automatic retry logic
     * @llm-rule WHEN: Cache initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles connection state
     */
    connect(): Promise<void>;
    /**
     * Disconnects from cache backend gracefully
     * @llm-rule WHEN: App shutdown or cache cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    disconnect(): Promise<void>;
    /**
     * Gets a value from cache with automatic key prefixing
     * @llm-rule WHEN: Retrieving cached data by key
     * @llm-rule AVOID: Manual key management - automatic prefixing handles namespacing
     * @llm-rule NOTE: Returns null if key not found or expired
     */
    get(key: string): Promise<any>;
    /**
     * Sets a value in cache with TTL and automatic key prefixing
     * @llm-rule WHEN: Storing data in cache with optional expiration
     * @llm-rule AVOID: Storing large objects without TTL - can cause memory issues
     * @llm-rule NOTE: Uses default TTL from config if not specified
     */
    set(key: string, value: any, ttl?: number): Promise<boolean>;
    /**
     * Deletes a key from cache
     * @llm-rule WHEN: Removing specific cached data or cache invalidation
     * @llm-rule AVOID: Mass deletion without consideration - use clear() for full cache clear
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clears entire namespace in cache
     * @llm-rule WHEN: Cache invalidation or cleanup operations for this namespace
     * @llm-rule AVOID: Using in production without careful consideration - affects all namespace data
     * @llm-rule NOTE: Only clears keys within current namespace, not entire cache
     */
    clear(): Promise<boolean>;
    /**
     * Gets a value from cache or sets it using a factory function
     * @llm-rule WHEN: Cache-aside pattern - get cached value or compute and cache
     * @llm-rule AVOID: Manual get/set logic - this handles race conditions properly
     * @llm-rule NOTE: Factory function only called on cache miss
     */
    getOrSet(key: string, factory: () => Promise<any>, ttl?: number): Promise<any>;
    /**
     * Gets current cache strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - cache should be transparent
     */
    getStrategy(): string;
    /**
     * Gets cache configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging cache configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig(): {
        strategy: string;
        keyPrefix: string;
        namespace: string;
        defaultTTL: number;
        connected: boolean;
    };
    /**
     * Ensures cache is connected before operations
     */
    private ensureConnected;
    /**
     * Builds full cache key with prefix and namespace
     */
    private buildKey;
    /**
     * Validates cache key format and length
     */
    private validateKey;
    /**
     * Validates cache value
     */
    private validateValue;
}
//# sourceMappingURL=cache.d.ts.map