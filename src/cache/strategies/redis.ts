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
export class RedisStrategy implements CacheStrategy {
  private config: CacheConfig;
  private client: any = null;
  private connected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Creates Redis strategy with direct environment access (like auth pattern)
   * @llm-rule WHEN: Cache initialization with Redis URL detected
   * @llm-rule AVOID: Manual Redis configuration - environment detection handles this
   */
  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Connects to Redis with automatic retry and connection pooling
   * @llm-rule WHEN: Cache initialization or reconnection after failure
   * @llm-rule AVOID: Manual connection management - this handles all Redis complexity
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    // Prevent multiple connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    await this.connectionPromise;
    this.connectionPromise = null;
  }

  /**
   * Establishes Redis connection with retry logic
   */
  private async establishConnection(): Promise<void> {
    try {
      // Dynamic import for Redis client
      const { createClient } = await import('redis');
      
      const redisConfig = this.config.redis!;
      
      // Create Redis client with comprehensive configuration
      this.client = createClient({
        url: redisConfig.url,
        password: redisConfig.password,
        socket: {
          connectTimeout: redisConfig.connectTimeout,
          reconnectStrategy: (retries: number) => {
            if (retries >= redisConfig.maxRetries) {
              console.error(`[AppKit] Redis max retries (${redisConfig.maxRetries}) exceeded`);
              return new Error('Redis connection failed');
            }
            
            const delay = Math.min(redisConfig.retryDelay * Math.pow(2, retries), 10000);
            console.warn(`[AppKit] Redis reconnecting in ${delay}ms (attempt ${retries + 1})`);
            return delay;
          },
        },
        commandsQueueMaxLength: 1000,
        // Set global command timeout via client options
        isolationPoolOptions: {
          min: 1,
          max: 10,
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to Redis
      await this.client.connect();
      this.connected = true;

      if (this.config.environment.isDevelopment) {
        console.log(`✅ [AppKit] Redis connected to ${this.maskUrl(redisConfig.url)}`);
      }
    } catch (error) {
      this.connected = false;
      this.client = null;
      throw new Error(`Redis connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Sets up Redis event handlers for connection management
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('error', (error: Error) => {
      console.error('[AppKit] Redis error:', error.message);
      this.connected = false;
    });

    this.client.on('connect', () => {
      if (this.config.environment.isDevelopment) {
        console.log('🔄 [AppKit] Redis connecting...');
      }
    });

    this.client.on('ready', () => {
      this.connected = true;
      if (this.config.environment.isDevelopment) {
        console.log('✅ [AppKit] Redis ready');
      }
    });

    this.client.on('reconnecting', () => {
      this.connected = false;
      if (this.config.environment.isDevelopment) {
        console.log('🔄 [AppKit] Redis reconnecting...');
      }
    });

    this.client.on('end', () => {
      this.connected = false;
      if (this.config.environment.isDevelopment) {
        console.log('👋 [AppKit] Redis connection ended');
      }
    });
  }

  /**
   * Disconnects from Redis gracefully
   * @llm-rule WHEN: App shutdown or cache cleanup
   * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.connected) return;

    try {
      await this.client.quit();
      this.connected = false;
      this.client = null;
    } catch (error) {
      console.error('[AppKit] Redis disconnect error:', (error as Error).message);
      // Force close if graceful quit fails
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  /**
   * Gets value from Redis with automatic JSON deserialization
   * @llm-rule WHEN: Retrieving cached data from distributed Redis cache
   * @llm-rule AVOID: Manual Redis commands - this handles serialization automatically
   */
  async get(key: string): Promise<any> {
    await this.ensureConnected();

    try {
      const value = await this.withTimeout(this.client.get(key), 'get');

      if (value === null) {
        return null; // Key not found or expired
      }

      // Deserialize JSON value
      return this.deserialize(value);
    } catch (error) {
      console.error(`[AppKit] Redis get error for key "${key}":`, (error as Error).message);
      return null; // Graceful degradation
    }
  }

  /**
   * Sets value in Redis with TTL and automatic JSON serialization
   * @llm-rule WHEN: Storing data in distributed Redis cache with expiration
   * @llm-rule AVOID: Manual Redis commands - this handles serialization and TTL automatically
   */
  async set(key: string, value: any, ttl: number): Promise<boolean> {
    await this.ensureConnected();

    try {
      // Serialize value to JSON
      const serialized = this.serialize(value);

      // Set with TTL (Redis EX option expects seconds)
      const result = await this.withTimeout(this.client.setEx(key, ttl, serialized), 'set');

      return result === 'OK';
    } catch (error) {
      console.error(`[AppKit] Redis set error for key "${key}":`, (error as Error).message);
      return false;
    }
  }

  /**
   * Deletes key from Redis
   * @llm-rule WHEN: Cache invalidation or removing specific cached data
   * @llm-rule AVOID: Manual key management - this handles Redis delete operations
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();

    try {
      const result = await this.withTimeout(this.client.del(key), 'delete');
      return result === 1; // Redis returns number of keys deleted
    } catch (error) {
      console.error(`[AppKit] Redis delete error for key "${key}":`, (error as Error).message);
      return false;
    }
  }

  /**
   * No-op at the strategy level: namespace-scoped clearing is handled by
   * CacheClass.clear() via keys() + deleteMany() to avoid a FLUSHDB footgun
   * that would wipe keys outside this cache's namespace.
   * @llm-rule WHEN: Called directly from a custom CacheStrategy consumer — use CacheClass.clear() instead
   * @llm-rule AVOID: Expecting this to clear anything
   */
  async clear(): Promise<boolean> {
    return true;
  }

  /**
   * Checks if key exists in Redis
   * @llm-rule WHEN: Checking cache key existence without retrieving value
   * @llm-rule AVOID: Using get() then checking null - this is more efficient
   */
  async has(key: string): Promise<boolean> {
    await this.ensureConnected();

    try {
      const result = await this.withTimeout(this.client.exists(key), 'has');
      return result === 1;
    } catch (error) {
      console.error(`[AppKit] Redis has error for key "${key}":`, (error as Error).message);
      return false;
    }
  }

  /**
   * Gets all keys matching pattern (for namespace operations)
   * @llm-rule WHEN: Finding all keys in namespace for bulk operations
   * @llm-rule AVOID: Using KEYS in production with large datasets - use SCAN instead
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    await this.ensureConnected();

    try {
      // Use SCAN instead of KEYS for production safety
      const keys: string[] = [];
      let cursor = 0;

      do {
        const result = await this.withTimeout(
          this.client.scan(cursor, {
            MATCH: pattern,
            COUNT: 1000, // Scan in batches of 1000
          }),
          'scan',
        );

        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      return keys;
    } catch (error) {
      console.error(`[AppKit] Redis keys error for pattern "${pattern}":`, (error as Error).message);
      return [];
    }
  }

  /**
   * Deletes multiple keys efficiently
   * @llm-rule WHEN: Bulk deletion operations like namespace clearing
   * @llm-rule AVOID: Individual delete calls - batch operations are much faster
   */
  async deleteMany(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    await this.ensureConnected();

    try {
      // Redis DEL command accepts multiple keys
      const result = await this.withTimeout(this.client.del(keys), 'deleteMany');
      return result; // Returns number of keys deleted
    } catch (error) {
      console.error(`[AppKit] Redis deleteMany error:`, (error as Error).message);
      return 0;
    }
  }

  // Private helper methods

  /**
   * Ensures Redis connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Enforces config.redis.commandTimeout on each Redis command. node-redis v4
   * has no client-level command timeout, so we race the command against a
   * setTimeout. If the command wins, its timer is unref'd/cleared.
   */
  private withTimeout(op: Promise<any>, label: string): Promise<any> {
    const ms = this.config.redis?.commandTimeout;
    if (!ms || ms <= 0) return op;

    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Redis ${label} timed out after ${ms}ms`));
      }, ms);
      op.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  /**
   * Serializes value to JSON string for Redis storage
   */
  private serialize(value: any): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new Error(`Failed to serialize value: ${(error as Error).message}`);
    }
  }

  /**
   * Deserializes JSON string from Redis
   */
  private deserialize(value: string): any {
    try {
      return JSON.parse(value);
    } catch (error) {
      // If it's not valid JSON, return as string (backward compatibility)
      return value;
    }
  }

  /**
   * Masks sensitive parts of Redis URL for logging
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      return parsed.toString();
    } catch {
      return 'redis://***';
    }
  }
}