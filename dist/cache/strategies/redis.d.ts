/**
 * Redis cache strategy with automatic connection management and retry logic
 * @module @bloomneo/appkit/cache
 * @file src/cache/strategies/redis.ts
 *
 * @llm-rule WHEN: App has REDIS_URL environment variable for distributed caching
 * @llm-rule AVOID: Manual Redis setup - this handles connection, retry, and serialization automatically
 * @llm-rule NOTE: Auto-reconnects on failure, handles JSON serialization, production-ready
 */
import type { CacheStrategy } from '../cache.js';
import type { CacheConfig } from '../defaults.js';
/**
 * Redis cache strategy with enterprise-grade reliability
 */
export declare class RedisStrategy implements CacheStrategy {
    private config;
    private client;
    private connected;
    private connectionPromise;
    /**
     * Creates Redis strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Cache initialization with Redis URL detected
     * @llm-rule AVOID: Manual Redis configuration - environment detection handles this
     */
    constructor(config: CacheConfig);
    /**
     * Connects to Redis with automatic retry and connection pooling
     * @llm-rule WHEN: Cache initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles all Redis complexity
     */
    connect(): Promise<void>;
    /**
     * Establishes Redis connection with retry logic
     */
    private establishConnection;
    /**
     * Sets up Redis event handlers for connection management
     */
    private setupEventHandlers;
    /**
     * Disconnects from Redis gracefully
     * @llm-rule WHEN: App shutdown or cache cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    disconnect(): Promise<void>;
    /**
     * Gets value from Redis with automatic JSON deserialization
     * @llm-rule WHEN: Retrieving cached data from distributed Redis cache
     * @llm-rule AVOID: Manual Redis commands - this handles serialization automatically
     */
    get(key: string): Promise<any>;
    /**
     * Sets value in Redis with TTL and automatic JSON serialization
     * @llm-rule WHEN: Storing data in distributed Redis cache with expiration
     * @llm-rule AVOID: Manual Redis commands - this handles serialization and TTL automatically
     */
    set(key: string, value: any, ttl: number): Promise<boolean>;
    /**
     * Deletes key from Redis
     * @llm-rule WHEN: Cache invalidation or removing specific cached data
     * @llm-rule AVOID: Manual key management - this handles Redis delete operations
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clears all keys matching pattern (usually namespace-based)
     * @llm-rule WHEN: Namespace-based cache invalidation
     * @llm-rule AVOID: Using FLUSHDB - this only clears specific namespace keys
     */
    clear(): Promise<boolean>;
    /**
     * Checks if key exists in Redis
     * @llm-rule WHEN: Checking cache key existence without retrieving value
     * @llm-rule AVOID: Using get() then checking null - this is more efficient
     */
    has(key: string): Promise<boolean>;
    /**
     * Gets all keys matching pattern (for namespace operations)
     * @llm-rule WHEN: Finding all keys in namespace for bulk operations
     * @llm-rule AVOID: Using KEYS in production with large datasets - use SCAN instead
     */
    keys(pattern?: string): Promise<string[]>;
    /**
     * Deletes multiple keys efficiently
     * @llm-rule WHEN: Bulk deletion operations like namespace clearing
     * @llm-rule AVOID: Individual delete calls - batch operations are much faster
     */
    deleteMany(keys: string[]): Promise<number>;
    /**
     * Ensures Redis connection is established
     */
    private ensureConnected;
    /**
     * Serializes value to JSON string for Redis storage
     */
    private serialize;
    /**
     * Deserializes JSON string from Redis
     */
    private deserialize;
    /**
     * Masks sensitive parts of Redis URL for logging
     */
    private maskUrl;
}
//# sourceMappingURL=redis.d.ts.map