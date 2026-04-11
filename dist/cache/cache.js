/**
 * Core cache class with Redis and Memory strategies and simplified API
 * @module @bloomneo/appkit/cache
 * @file src/cache/cache.ts
 *
 * @llm-rule WHEN: Building apps that need caching with automatic strategy selection
 * @llm-rule AVOID: Using directly - always get instance via cacheClass.get()
 * @llm-rule NOTE: Auto-detects Redis vs Memory from environment, namespace passed to get() function
 */
import { RedisStrategy } from './strategies/redis.js';
import { MemoryStrategy } from './strategies/memory.js';
/**
 * Cache class with automatic strategy selection and ultra-simple API
 */
export class CacheClass {
    config;
    namespace;
    strategy;
    connected = false;
    constructor(config, namespace) {
        this.config = config;
        this.namespace = namespace;
        this.strategy = this.createStrategy();
    }
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Cache initialization - selects Redis or Memory based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    createStrategy() {
        switch (this.config.strategy) {
            case 'redis':
                return new RedisStrategy(this.config);
            case 'memory':
                return new MemoryStrategy(this.config);
            default:
                throw new Error(`Unknown cache strategy: ${this.config.strategy}`);
        }
    }
    /**
     * Connects to cache backend with automatic retry logic
     * @llm-rule WHEN: Cache initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles connection state
     */
    async connect() {
        if (this.connected)
            return;
        try {
            await this.strategy.connect();
            this.connected = true;
            if (this.config.environment.isDevelopment) {
                console.log(`✅ [AppKit] Cache connected using ${this.config.strategy} strategy`);
            }
        }
        catch (error) {
            console.error(`❌ [AppKit] Cache connection failed:`, error.message);
            throw error;
        }
    }
    /**
     * Disconnects from cache backend gracefully
     * @llm-rule WHEN: App shutdown or cache cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    async disconnect() {
        if (!this.connected)
            return;
        try {
            await this.strategy.disconnect();
            this.connected = false;
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [AppKit] Cache disconnected`);
            }
        }
        catch (error) {
            console.error(`⚠️ [AppKit] Cache disconnect error:`, error.message);
        }
    }
    /**
     * Gets a value from cache with automatic key prefixing
     * @llm-rule WHEN: Retrieving cached data by key
     * @llm-rule AVOID: Manual key management - automatic prefixing handles namespacing
     * @llm-rule NOTE: Returns null if key not found or expired
     */
    async get(key) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            const prefixedKey = this.buildKey(key);
            return await this.strategy.get(prefixedKey);
        }
        catch (error) {
            console.error(`[AppKit] Cache get error for key "${key}":`, error.message);
            return null; // Graceful degradation
        }
    }
    /**
     * Sets a value in cache with TTL and automatic key prefixing
     * @llm-rule WHEN: Storing data in cache with optional expiration
     * @llm-rule AVOID: Storing large objects without TTL - can cause memory issues
     * @llm-rule NOTE: Uses default TTL from config if not specified
     */
    async set(key, value, ttl) {
        this.validateKey(key);
        this.validateValue(value);
        await this.ensureConnected();
        try {
            const prefixedKey = this.buildKey(key);
            const cacheTTL = ttl ?? this.config.defaultTTL;
            return await this.strategy.set(prefixedKey, value, cacheTTL);
        }
        catch (error) {
            console.error(`[AppKit] Cache set error for key "${key}":`, error.message);
            return false; // Graceful degradation
        }
    }
    /**
     * Deletes a key from cache
     * @llm-rule WHEN: Removing specific cached data or cache invalidation
     * @llm-rule AVOID: Mass deletion without consideration - use clear() for full cache clear
     */
    async delete(key) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            const prefixedKey = this.buildKey(key);
            return await this.strategy.delete(prefixedKey);
        }
        catch (error) {
            console.error(`[AppKit] Cache delete error for key "${key}":`, error.message);
            return false;
        }
    }
    /**
     * Clears entire namespace in cache
     * @llm-rule WHEN: Cache invalidation or cleanup operations for this namespace
     * @llm-rule AVOID: Using in production without careful consideration - affects all namespace data
     * @llm-rule NOTE: Only clears keys within current namespace, not entire cache
     */
    async clear() {
        await this.ensureConnected();
        try {
            // Get all keys in this namespace and delete them
            const pattern = this.buildKey('*');
            const keys = await this.strategy.keys(pattern);
            if (keys.length === 0)
                return true;
            const deleted = await this.strategy.deleteMany(keys);
            return deleted === keys.length;
        }
        catch (error) {
            console.error(`[AppKit] Cache clear error:`, error.message);
            return false;
        }
    }
    /**
     * Gets a value from cache or sets it using a factory function
     * @llm-rule WHEN: Cache-aside pattern - get cached value or compute and cache
     * @llm-rule AVOID: Manual get/set logic - this handles race conditions properly
     * @llm-rule NOTE: Factory function only called on cache miss
     */
    async getOrSet(key, factory, ttl) {
        // Try to get existing value first
        const existing = await this.get(key);
        if (existing !== null) {
            return existing;
        }
        // Generate new value and cache it
        try {
            const value = await factory();
            await this.set(key, value, ttl);
            return value;
        }
        catch (error) {
            console.error(`[AppKit] Cache getOrSet factory error for key "${key}":`, error.message);
            throw error; // Re-throw factory errors
        }
    }
    /**
     * Gets current cache strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - cache should be transparent
     */
    getStrategy() {
        return this.config.strategy;
    }
    /**
     * Gets cache configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging cache configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig() {
        return {
            strategy: this.config.strategy,
            keyPrefix: this.config.keyPrefix,
            namespace: this.namespace,
            defaultTTL: this.config.defaultTTL,
            connected: this.connected,
        };
    }
    // Private helper methods
    /**
     * Ensures cache is connected before operations
     */
    async ensureConnected() {
        if (!this.connected) {
            await this.connect();
        }
    }
    /**
     * Builds full cache key with prefix and namespace
     */
    buildKey(key) {
        return `${this.config.keyPrefix}:${this.namespace}:${key}`;
    }
    /**
     * Validates cache key format and length
     */
    validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('Cache key must be a non-empty string');
        }
        if (key.length > 250) {
            throw new Error('Cache key too long (max 250 characters)');
        }
        if (key.includes('\n') || key.includes('\r')) {
            throw new Error('Cache key cannot contain newline characters');
        }
        if (key.includes(':')) {
            throw new Error('Cache key cannot contain colon characters (reserved for namespacing)');
        }
    }
    /**
     * Validates cache value
     */
    validateValue(value) {
        if (value === undefined) {
            throw new Error('Cannot cache undefined values');
        }
        // Check if value can be serialized
        try {
            JSON.stringify(value);
        }
        catch (error) {
            throw new Error('Value must be JSON serializable');
        }
    }
}
//# sourceMappingURL=cache.js.map