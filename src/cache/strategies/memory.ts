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

interface CacheItem {
  value: any;
  ttl: number;
  size: number;
  accessTime: number;
  createTime: number;
}

/**
 * Memory cache strategy with intelligent eviction and cleanup
 */
export class MemoryStrategy implements CacheStrategy {
  private config: CacheConfig;
  private cache = new Map<string, CacheItem>();
  private totalSize = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private connected = false;

  /**
   * Creates memory strategy with direct environment access (like auth pattern)
   * @llm-rule WHEN: Cache initialization without Redis URL - automatic fallback
   * @llm-rule AVOID: Manual memory configuration - environment detection handles this
   */
  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Connects memory cache (starts cleanup intervals)
   * @llm-rule WHEN: Cache initialization - sets up automatic TTL cleanup
   * @llm-rule AVOID: Manual memory management - this handles TTL and size limits automatically
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    // Start cleanup interval for TTL expiration
    this.startCleanupInterval();
    this.connected = true;

    if (this.config.environment.isDevelopment) {
      console.log(`✅ [AppKit] Memory cache initialized (max: ${this.formatBytes(this.config.memory!.maxSizeBytes)}, items: ${this.config.memory!.maxItems})`);
    }
  }

  /**
   * Disconnects memory cache (stops cleanup intervals)
   * @llm-rule WHEN: App shutdown or cache cleanup
   * @llm-rule AVOID: Memory leaks - always stop intervals on shutdown
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    this.stopCleanupInterval();
    this.cache.clear();
    this.totalSize = 0;
    this.connected = false;

    if (this.config.environment.isDevelopment) {
      console.log(`👋 [AppKit] Memory cache disconnected`);
    }
  }

  /**
   * Gets value from memory cache with TTL checking
   * @llm-rule WHEN: Retrieving cached data from in-memory storage
   * @llm-rule AVOID: Manual TTL checking - this handles expiration automatically
   */
  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null; // Key not found
    }

    // Check TTL expiration
    if (this.isExpired(item)) {
      this.deleteItem(key);
      return null;
    }

    // Update access time for LRU
    item.accessTime = Date.now();
    
    return this.deepClone(item.value);
  }

  /**
   * Sets value in memory cache with TTL and automatic eviction
   * @llm-rule WHEN: Storing data in memory cache with size and TTL management
   * @llm-rule AVOID: Manual memory management - this handles LRU eviction automatically
   */
  async set(key: string, value: any, ttl: number): Promise<boolean> {
    try {
      // Clone value to prevent external mutations
      const clonedValue = this.deepClone(value);
      const size = this.calculateSize(clonedValue);
      const now = Date.now();
      
      const item: CacheItem = {
        value: clonedValue,
        ttl: now + (ttl * 1000), // Convert seconds to milliseconds
        size,
        accessTime: now,
        createTime: now,
      };

      // Remove existing item if present
      if (this.cache.has(key)) {
        this.deleteItem(key);
      }

      // Check if single item exceeds max size
      if (size > this.config.memory!.maxSizeBytes) {
        console.warn(`[AppKit] Cache item too large (${this.formatBytes(size)} > ${this.formatBytes(this.config.memory!.maxSizeBytes)})`);
        return false;
      }

      // Evict items to make space
      this.evictIfNeeded(size);

      // Add new item
      this.cache.set(key, item);
      this.totalSize += size;

      return true;
    } catch (error) {
      console.error(`[AppKit] Memory set error for key "${key}":`, (error as Error).message);
      return false;
    }
  }

  /**
   * Deletes key from memory cache
   * @llm-rule WHEN: Cache invalidation or removing specific cached data
   * @llm-rule AVOID: Manual memory cleanup - this handles size tracking automatically
   */
  async delete(key: string): Promise<boolean> {
    return this.deleteItem(key);
  }

  /**
   * Clears entire memory cache
   * @llm-rule WHEN: Full cache invalidation or testing cleanup
   * @llm-rule AVOID: Using in production without consideration - clears all cached data
   */
  async clear(): Promise<boolean> {
    this.cache.clear();
    this.totalSize = 0;
    return true;
  }

  /**
   * Checks if key exists in memory cache
   * @llm-rule WHEN: Checking cache key existence without retrieving value
   * @llm-rule AVOID: Using get() then checking null - this is more efficient
   */
  async has(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    // Check TTL expiration
    if (this.isExpired(item)) {
      this.deleteItem(key);
      return false;
    }

    return true;
  }

  /**
   * Gets all keys matching pattern (supports wildcards)
   * @llm-rule WHEN: Finding all keys in namespace for bulk operations
   * @llm-rule AVOID: Complex pattern matching - simple wildcards only
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    const keys: string[] = [];
    const regex = this.patternToRegex(pattern);
    
    for (const [key, item] of this.cache.entries()) {
      // Skip expired items
      if (this.isExpired(item)) {
        this.deleteItem(key);
        continue;
      }

      if (regex.test(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Deletes multiple keys efficiently
   * @llm-rule WHEN: Bulk deletion operations like namespace clearing
   * @llm-rule AVOID: Individual delete calls in loops - this batches operations
   */
  async deleteMany(keys: string[]): Promise<number> {
    let deletedCount = 0;
    
    for (const key of keys) {
      if (this.deleteItem(key)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  // Private helper methods

  /**
   * Deletes single item and updates size tracking
   */
  private deleteItem(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    this.cache.delete(key);
    this.totalSize -= item.size;
    return true;
  }

  /**
   * Checks if cache item has expired
   */
  private isExpired(item: CacheItem): boolean {
    return Date.now() > item.ttl;
  }

  /**
   * Evicts items when memory limits are exceeded
   */
  private evictIfNeeded(newItemSize: number): void {
    const memoryConfig = this.config.memory!;
    
    // Check item count limit
    while (this.cache.size >= memoryConfig.maxItems) {
      this.evictLRU();
    }

    // Check memory size limit
    while (this.totalSize + newItemSize > memoryConfig.maxSizeBytes) {
      if (!this.evictLRU()) {
        break; // No more items to evict
      }
    }
  }

  /**
   * Evicts least recently used item
   */
  private evictLRU(): boolean {
    if (this.cache.size === 0) return false;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    // Find LRU item
    for (const [key, item] of this.cache.entries()) {
      if (item.accessTime < oldestTime) {
        oldestTime = item.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.deleteItem(oldestKey);
      return true;
    }

    return false;
  }

  /**
   * Calculates memory size of value (approximate)
   */
  private calculateSize(value: any): number {
    try {
      // Simple size calculation using JSON serialization
      const serialized = JSON.stringify(value);
      return Buffer.byteLength(serialized, 'utf8');
    } catch {
      // Fallback for non-serializable values
      return 1024; // 1KB default
    }
  }

  /**
   * Deep clones value to prevent external mutations
   */
  private deepClone(value: any): any {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      // Fallback for non-serializable values
      return value;
    }
  }

  /**
   * Converts glob pattern to regex for key matching
   */
  private patternToRegex(pattern: string): RegExp {
    if (pattern === '*') {
      return /.*/; // Match everything
    }

    // Escape special regex characters except * and ?
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')  // * becomes .*
      .replace(/\?/g, '.');  // ? becomes .

    return new RegExp(`^${escaped}$`);
  }

  /**
   * Starts automatic cleanup interval for TTL expiration
   */
  private startCleanupInterval(): void {
    const interval = this.config.memory!.checkInterval;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, interval);

    // Don't let interval keep process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stops cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Removes expired items from cache
   */
  private cleanupExpired(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        keysToDelete.push(key);
      }
    }

    // Delete expired items
    for (const key of keysToDelete) {
      this.deleteItem(key);
    }

    // Log cleanup results in development
    if (keysToDelete.length > 0 && this.config.environment.isDevelopment) {
      console.log(`🧹 [AppKit] Memory cache cleanup: removed ${keysToDelete.length} expired items`);
    }
  }

  /**
   * Formats bytes for human-readable display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

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
  } {
    const memoryConfig = this.config.memory!;
    
    return {
      itemCount: this.cache.size,
      totalSize: this.totalSize,
      totalSizeFormatted: this.formatBytes(this.totalSize),
      maxItems: memoryConfig.maxItems,
      maxSize: memoryConfig.maxSizeBytes,
      maxSizeFormatted: this.formatBytes(memoryConfig.maxSizeBytes),
      memoryUsage: this.totalSize / memoryConfig.maxSizeBytes,
    };
  }
}