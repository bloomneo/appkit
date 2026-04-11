/**
 * Memory cache strategy with LRU eviction and TTL expiration
 * @module @bloomneo/appkit/cache
 * @file src/cache/strategies/memory.ts
 *
 * @llm-rule WHEN: No REDIS_URL environment variable - perfect for development and testing
 * @llm-rule AVOID: Production use without Redis - memory cache doesn't persist across restarts
 * @llm-rule NOTE: LRU eviction, TTL cleanup, memory limits, thread-safe operations
 */
import type { CacheStrategy } from '../cache.js';
import type { CacheConfig } from '../defaults.js';
/**
 * Memory cache strategy with intelligent eviction and cleanup
 */
export declare class MemoryStrategy implements CacheStrategy {
    private config;
    private cache;
    private totalSize;
    private cleanupInterval;
    private connected;
    /**
     * Creates memory strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Cache initialization without Redis URL - automatic fallback
     * @llm-rule AVOID: Manual memory configuration - environment detection handles this
     */
    constructor(config: CacheConfig);
    /**
     * Connects memory cache (starts cleanup intervals)
     * @llm-rule WHEN: Cache initialization - sets up automatic TTL cleanup
     * @llm-rule AVOID: Manual memory management - this handles TTL and size limits automatically
     */
    connect(): Promise<void>;
    /**
     * Disconnects memory cache (stops cleanup intervals)
     * @llm-rule WHEN: App shutdown or cache cleanup
     * @llm-rule AVOID: Memory leaks - always stop intervals on shutdown
     */
    disconnect(): Promise<void>;
    /**
     * Gets value from memory cache with TTL checking
     * @llm-rule WHEN: Retrieving cached data from in-memory storage
     * @llm-rule AVOID: Manual TTL checking - this handles expiration automatically
     */
    get(key: string): Promise<any>;
    /**
     * Sets value in memory cache with TTL and automatic eviction
     * @llm-rule WHEN: Storing data in memory cache with size and TTL management
     * @llm-rule AVOID: Manual memory management - this handles LRU eviction automatically
     */
    set(key: string, value: any, ttl: number): Promise<boolean>;
    /**
     * Deletes key from memory cache
     * @llm-rule WHEN: Cache invalidation or removing specific cached data
     * @llm-rule AVOID: Manual memory cleanup - this handles size tracking automatically
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clears entire memory cache
     * @llm-rule WHEN: Full cache invalidation or testing cleanup
     * @llm-rule AVOID: Using in production without consideration - clears all cached data
     */
    clear(): Promise<boolean>;
    /**
     * Checks if key exists in memory cache
     * @llm-rule WHEN: Checking cache key existence without retrieving value
     * @llm-rule AVOID: Using get() then checking null - this is more efficient
     */
    has(key: string): Promise<boolean>;
    /**
     * Gets all keys matching pattern (supports wildcards)
     * @llm-rule WHEN: Finding all keys in namespace for bulk operations
     * @llm-rule AVOID: Complex pattern matching - simple wildcards only
     */
    keys(pattern?: string): Promise<string[]>;
    /**
     * Deletes multiple keys efficiently
     * @llm-rule WHEN: Bulk deletion operations like namespace clearing
     * @llm-rule AVOID: Individual delete calls in loops - this batches operations
     */
    deleteMany(keys: string[]): Promise<number>;
    /**
     * Deletes single item and updates size tracking
     */
    private deleteItem;
    /**
     * Checks if cache item has expired
     */
    private isExpired;
    /**
     * Evicts items when memory limits are exceeded
     */
    private evictIfNeeded;
    /**
     * Evicts least recently used item
     */
    private evictLRU;
    /**
     * Calculates memory size of value (approximate)
     */
    private calculateSize;
    /**
     * Deep clones value to prevent external mutations
     */
    private deepClone;
    /**
     * Converts glob pattern to regex for key matching
     */
    private patternToRegex;
    /**
     * Starts automatic cleanup interval for TTL expiration
     */
    private startCleanupInterval;
    /**
     * Stops cleanup interval
     */
    private stopCleanupInterval;
    /**
     * Removes expired items from cache
     */
    private cleanupExpired;
    /**
     * Formats bytes for human-readable display
     */
    private formatBytes;
    /**
     * Gets memory cache statistics for debugging
     */
    getStats(): {
        itemCount: number;
        totalSize: number;
        totalSizeFormatted: string;
        maxItems: number;
        maxSize: number;
        maxSizeFormatted: string;
        memoryUsage: number;
    };
}
//# sourceMappingURL=memory.d.ts.map