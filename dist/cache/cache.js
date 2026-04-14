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
 * Thrown by all cache operations when the underlying strategy fails.
 * Catch this in your route/service and decide whether to fall back to the
 * database, re-throw, or log — the cache module never makes that call for you.
 *
 * @example
 * import { CacheError } from '@bloomneo/appkit/cache';
 *
 * try {
 *   const user = await cache.get<User>('user:123');
 * } catch (err) {
 *   if (err instanceof CacheError) {
 *     logger.warn('Cache unavailable, falling back to DB', { code: err.code });
 *     return await db.user.findUnique({ where: { id: 123 } });
 *   }
 *   throw err; // re-throw unrelated errors
 * }
 */
export class CacheError extends Error {
    /** Machine-readable error code, e.g. 'CACHE_GET_FAILED', 'CACHE_CONNECT_FAILED' */
    code;
    constructor(message, options) {
        super(`[@bloomneo/appkit/cache] ${message}`);
        this.name = 'CacheError';
        this.code = options?.code ?? 'CACHE_ERROR';
        if (options?.cause) {
            this.cause = options.cause;
        }
    }
}
/**
 * Cache class with automatic strategy selection and ultra-simple API
 */
export class CacheClass {
    config;
    namespace;
    strategy;
    connected = false;
    inFlight = new Map();
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
                throw new CacheError(`Unknown cache strategy: ${this.config.strategy}`, {
                    code: 'CACHE_INVALID_STRATEGY',
                });
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
                console.log(`[@bloomneo/appkit/cache] Connected using ${this.config.strategy} strategy.`);
            }
        }
        catch (cause) {
            throw new CacheError(`Failed to connect using ${this.config.strategy} strategy: ${cause.message}`, { code: 'CACHE_CONNECT_FAILED', cause });
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
                console.log(`[@bloomneo/appkit/cache] Disconnected.`);
            }
        }
        catch (cause) {
            // Disconnect errors are non-fatal — log a warning but don't throw.
            // Throwing during shutdown can mask the original reason the app is shutting down.
            console.warn(`[@bloomneo/appkit/cache] Disconnect warning:`, cause.message);
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
        const prefixedKey = this.buildKey(key);
        try {
            return await this.strategy.get(prefixedKey);
        }
        catch (cause) {
            throw new CacheError(`get failed for key "${key}": ${cause.message}`, {
                code: 'CACHE_GET_FAILED',
                cause,
            });
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
        const prefixedKey = this.buildKey(key);
        const cacheTTL = ttl ?? this.config.defaultTTL;
        try {
            return await this.strategy.set(prefixedKey, value, cacheTTL);
        }
        catch (cause) {
            throw new CacheError(`set failed for key "${key}": ${cause.message}`, {
                code: 'CACHE_SET_FAILED',
                cause,
            });
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
        const prefixedKey = this.buildKey(key);
        try {
            return await this.strategy.delete(prefixedKey);
        }
        catch (cause) {
            throw new CacheError(`delete failed for key "${key}": ${cause.message}`, {
                code: 'CACHE_DELETE_FAILED',
                cause,
            });
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
            const pattern = this.buildKey('*');
            const keys = await this.strategy.keys(pattern);
            if (keys.length === 0)
                return true;
            const deleted = await this.strategy.deleteMany(keys);
            return deleted === keys.length;
        }
        catch (cause) {
            throw new CacheError(`clear failed for namespace "${this.namespace}": ${cause.message}`, {
                code: 'CACHE_CLEAR_FAILED',
                cause,
            });
        }
    }
    /**
     * Gets a value from cache or sets it using a factory function.
     *
     * Race safety: concurrent callers for the same key share a single factory
     * run via an in-flight promise map — the factory is executed at most once
     * per in-flight key.
     *
     * Null handling: if the factory previously cached `null`, subsequent calls
     * return that cached `null` (via a membership check) instead of re-running
     * the factory. A cache miss and a cached `null` are distinct outcomes.
     *
     * @llm-rule WHEN: Cache-aside pattern - get cached value or compute and cache
     * @llm-rule AVOID: Manual get/set logic - this dedupes concurrent misses and preserves cached null
     * @llm-rule NOTE: Factory errors propagate as-is (not wrapped in CacheError); in-flight entry is cleared on error
     */
    async getOrSet(key, factory, ttl) {
        this.validateKey(key);
        const pending = this.inFlight.get(key);
        if (pending) {
            return pending;
        }
        const promise = this.runGetOrSet(key, factory, ttl).finally(() => {
            this.inFlight.delete(key);
        });
        this.inFlight.set(key, promise);
        return promise;
    }
    async runGetOrSet(key, factory, ttl) {
        const existing = await this.get(key);
        if (existing !== null) {
            return existing;
        }
        // `existing === null` is ambiguous: could be a miss or a cached null.
        // Disambiguate via a membership check so we don't re-run the factory on cached null.
        const prefixedKey = this.buildKey(key);
        let exists = false;
        try {
            exists = await this.strategy.has(prefixedKey);
        }
        catch {
            // If the membership check fails, treat as miss and let the factory recompute.
            exists = false;
        }
        if (exists) {
            return null;
        }
        const value = await factory(); // factory errors propagate as-is — not wrapped in CacheError
        await this.set(key, value, ttl);
        return value;
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
     * Validates cache key format and length.
     *
     * Colons ARE allowed — the canonical Redis idiom (`user:123`, `session:abc`)
     * is supported. Internal namespacing uses `${keyPrefix}:${namespace}:${key}`
     * so your key's colons are scoped to your namespace and cannot collide.
     */
    validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new CacheError('Cache key must be a non-empty string', { code: 'CACHE_INVALID_KEY' });
        }
        if (key.length > 250) {
            throw new CacheError('Cache key too long (max 250 characters)', { code: 'CACHE_INVALID_KEY' });
        }
        if (key.includes('\n') || key.includes('\r')) {
            throw new CacheError('Cache key cannot contain newline characters', { code: 'CACHE_INVALID_KEY' });
        }
    }
    validateValue(value) {
        if (value === undefined) {
            throw new CacheError('Cannot cache undefined values', { code: 'CACHE_INVALID_VALUE' });
        }
        try {
            JSON.stringify(value);
        }
        catch {
            throw new CacheError('Value must be JSON serializable', { code: 'CACHE_INVALID_VALUE' });
        }
    }
}
//# sourceMappingURL=cache.js.map