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
import type { CacheConfig } from './defaults.js';

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
  readonly code: string;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(`[@bloomneo/appkit/cache] ${message}`);
    this.name = 'CacheError';
    this.code = options?.code ?? 'CACHE_ERROR';
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
  }
}

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
export class CacheClass {
  public config: CacheConfig;
  public namespace: string;
  private strategy: RedisStrategy | MemoryStrategy;
  private connected: boolean = false;

  constructor(config: CacheConfig, namespace: string) {
    this.config = config;
    this.namespace = namespace;
    this.strategy = this.createStrategy();
  }

  /**
   * Creates appropriate strategy based on configuration
   * @llm-rule WHEN: Cache initialization - selects Redis or Memory based on environment
   * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
   */
  private createStrategy(): RedisStrategy | MemoryStrategy {
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
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      await this.strategy.connect();
      this.connected = true;

      if (this.config.environment.isDevelopment) {
        console.log(`[@bloomneo/appkit/cache] Connected using ${this.config.strategy} strategy.`);
      }
    } catch (cause) {
      throw new CacheError(
        `Failed to connect using ${this.config.strategy} strategy: ${(cause as Error).message}`,
        { code: 'CACHE_CONNECT_FAILED', cause },
      );
    }
  }

  /**
   * Disconnects from cache backend gracefully
   * @llm-rule WHEN: App shutdown or cache cleanup
   * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.strategy.disconnect();
      this.connected = false;

      if (this.config.environment.isDevelopment) {
        console.log(`[@bloomneo/appkit/cache] Disconnected.`);
      }
    } catch (cause) {
      // Disconnect errors are non-fatal — log a warning but don't throw.
      // Throwing during shutdown can mask the original reason the app is shutting down.
      console.warn(`[@bloomneo/appkit/cache] Disconnect warning:`, (cause as Error).message);
    }
  }

  /**
   * Gets a value from cache with automatic key prefixing
   * @llm-rule WHEN: Retrieving cached data by key
   * @llm-rule AVOID: Manual key management - automatic prefixing handles namespacing
   * @llm-rule NOTE: Returns null if key not found or expired
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    this.validateKey(key);
    await this.ensureConnected();

    const prefixedKey = this.buildKey(key);
    try {
      return await this.strategy.get(prefixedKey) as T | null;
    } catch (cause) {
      throw new CacheError(`get failed for key "${key}": ${(cause as Error).message}`, {
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
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<boolean> {
    this.validateKey(key);
    this.validateValue(value);
    await this.ensureConnected();

    const prefixedKey = this.buildKey(key);
    const cacheTTL = ttl ?? this.config.defaultTTL;
    try {
      return await this.strategy.set(prefixedKey, value, cacheTTL);
    } catch (cause) {
      throw new CacheError(`set failed for key "${key}": ${(cause as Error).message}`, {
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
  async delete(key: string): Promise<boolean> {
    this.validateKey(key);
    await this.ensureConnected();

    const prefixedKey = this.buildKey(key);
    try {
      return await this.strategy.delete(prefixedKey);
    } catch (cause) {
      throw new CacheError(`delete failed for key "${key}": ${(cause as Error).message}`, {
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
  async clear(): Promise<boolean> {
    await this.ensureConnected();

    try {
      const pattern = this.buildKey('*');
      const keys = await this.strategy.keys(pattern);
      if (keys.length === 0) return true;
      const deleted = await this.strategy.deleteMany(keys);
      return deleted === keys.length;
    } catch (cause) {
      throw new CacheError(`clear failed for namespace "${this.namespace}": ${(cause as Error).message}`, {
        code: 'CACHE_CLEAR_FAILED',
        cause,
      });
    }
  }

  /**
   * Gets a value from cache or sets it using a factory function
   * @llm-rule WHEN: Cache-aside pattern - get cached value or compute and cache
   * @llm-rule AVOID: Manual get/set logic - this handles race conditions properly
   * @llm-rule NOTE: Factory function only called on cache miss
   */
  async getOrSet<T = unknown>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get existing value first
    const existing = await this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    // Generate new value and cache it
    const value = await factory(); // factory errors propagate as-is — not wrapped in CacheError
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Gets current cache strategy name for debugging
   * @llm-rule WHEN: Debugging or health checks to see which strategy is active
   * @llm-rule AVOID: Using for application logic - cache should be transparent
   */
  getStrategy(): string {
    return this.config.strategy;
  }

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
  } {
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
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Builds full cache key with prefix and namespace
   */
  private buildKey(key: string): string {
    return `${this.config.keyPrefix}:${this.namespace}:${key}`;
  }

  /**
   * Validates cache key format and length
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new CacheError('Cache key must be a non-empty string', { code: 'CACHE_INVALID_KEY' });
    }
    if (key.length > 250) {
      throw new CacheError('Cache key too long (max 250 characters)', { code: 'CACHE_INVALID_KEY' });
    }
    if (key.includes('\n') || key.includes('\r')) {
      throw new CacheError('Cache key cannot contain newline characters', { code: 'CACHE_INVALID_KEY' });
    }
    if (key.includes(':')) {
      throw new CacheError('Cache key cannot contain colon characters (reserved for namespacing)', { code: 'CACHE_INVALID_KEY' });
    }
  }

  private validateValue(value: unknown): void {
    if (value === undefined) {
      throw new CacheError('Cannot cache undefined values', { code: 'CACHE_INVALID_VALUE' });
    }
    try {
      JSON.stringify(value);
    } catch {
      throw new CacheError('Value must be JSON serializable', { code: 'CACHE_INVALID_VALUE' });
    }
  }
}