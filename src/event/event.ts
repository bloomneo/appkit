/**
 * Core event class with automatic strategy selection and ultra-simple API
 * @module @bloomneo/appkit/event
 * @file src/event/event.ts
 * 
 * @llm-rule WHEN: Building apps that need event-driven architecture with automatic Redis/Memory selection
 * @llm-rule AVOID: Using directly - always get instance via eventClass.get()
 * @llm-rule NOTE: Auto-detects Redis vs Memory based on environment variables
 */

import { RedisStrategy } from './strategies/redis.js';
import { MemoryStrategy } from './strategies/memory.js';
import type { EventConfig } from './defaults.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/event/README.md';

export interface EventHandler {
  (data: any): void | Promise<void>;
}

export interface WildcardHandler {
  (eventName: string, data: any): void | Promise<void>;
}

export interface EventHistoryEntry {
  event: string;
  data: any;
  timestamp: string;
  namespace: string;
}

export interface EventStrategy {
  emit(event: string, data: any): Promise<boolean>;
  on(event: string, handler: EventHandler): void;
  once(event: string, handler: EventHandler): void;
  off(event: string, handler?: EventHandler): void;
  getListeners(event?: string): any;
  disconnect(): Promise<void>;
}

export interface BatchEvent {
  event: string;
  data: any;
}

/**
 * Event class with automatic strategy selection and ultra-simple API
 */
export class EventClass {
  public config: EventConfig;
  public namespace: string;
  private strategy: RedisStrategy | MemoryStrategy;
  private connected: boolean = false;
  private eventHistory: EventHistoryEntry[] = []; // ✅ Renamed from 'history' to 'eventHistory'
  private wildcardHandlers = new Map<string, WildcardHandler[]>();

  constructor(config: EventConfig, namespace: string) {
    this.config = config;
    this.namespace = namespace;
    this.strategy = this.createStrategy();
  }

  /**
   * Creates appropriate strategy based on configuration
   * @llm-rule WHEN: Event initialization - selects Redis or Memory based on environment
   * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
   */
  private createStrategy(): RedisStrategy | MemoryStrategy {
    switch (this.config.strategy) {
      case 'redis':
        return new RedisStrategy(this.config, this.namespace);
      case 'memory':
        return new MemoryStrategy(this.config, this.namespace);
      default:
        throw new Error(`[@bloomneo/appkit/event] Unknown event strategy: ${this.config.strategy}. See: ${DOCS_URL}#environment-variables`);
    }
  }

  /**
   * Connects to event backend with automatic retry logic
   * @llm-rule WHEN: Event initialization or reconnection after failure
   * @llm-rule AVOID: Manual connection management - this handles connection state
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      // Strategy-specific connection (Redis connects, Memory is immediate)
      if ('connect' in this.strategy) {
        await (this.strategy as any).connect();
      }
      
      this.connected = true;

      if (this.config.environment.isDevelopment) {
        console.log(`✅ [@bloomneo/appkit/event] Event system connected using ${this.config.strategy} strategy (namespace: ${this.namespace})`);
      }
    } catch (error) {
      console.error(`❌ [@bloomneo/appkit/event] Event connection failed:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Disconnects from event backend gracefully
   * @llm-rule WHEN: App shutdown or event cleanup
   * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.strategy.disconnect();
      this.connected = false;
      this.wildcardHandlers.clear();

      if (this.config.environment.isDevelopment) {
        console.log(`👋 [@bloomneo/appkit/event] Event system disconnected (namespace: ${this.namespace})`);
      }
    } catch (error) {
      console.error(`⚠️ [@bloomneo/appkit/event] Event disconnect error:`, (error as Error).message);
    }
  }

  /**
   * Emits an event with automatic namespacing and history tracking
   * @llm-rule WHEN: Triggering events in your application
   * @llm-rule AVOID: Manual event management - this handles namespacing and distribution
   * @llm-rule NOTE: Automatically adds to history if enabled, handles wildcards
   */
  async emit(event: string, data: any = {}): Promise<boolean> {
    this.validateEventName(event);
    await this.ensureConnected();

    try {
      // Build namespaced event name
      const namespacedEvent = this.buildEventName(event);

      // Emit via strategy
      const result = await this.strategy.emit(namespacedEvent, data);

      // Add to history if enabled
      if (this.config.history.enabled) {
        this.addToHistory(event, data);
      }

      // Handle local wildcard listeners (for both Redis and Memory)
      this.handleWildcardEmit(event, data);

      // Log in development
      if (this.config.environment.isDevelopment) {
        console.log(`📤 [@bloomneo/appkit/event] Event emitted: ${event}`, data);
      }

      return result;
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Event emit error for "${event}":`, (error as Error).message);
      return false;
    }
  }

  /**
   * Adds event listener with automatic namespacing and wildcard support
   * @llm-rule WHEN: Listening to events in your application
   * @llm-rule AVOID: Manual listener management - this handles namespacing and wildcards
   * @llm-rule NOTE: Supports wildcard patterns like 'user.*' or 'order.*.completed'
   */
  on(event: string, handler: EventHandler | WildcardHandler): void {
    this.validateEventName(event);
    this.validateHandler(handler);

    if (this.isWildcardPattern(event)) {
      this.addWildcardHandler(event, handler as WildcardHandler);
    } else {
      const namespacedEvent = this.buildEventName(event);
      this.strategy.on(namespacedEvent, handler as EventHandler);
    }
  }

  /**
   * Adds one-time event listener with automatic cleanup
   * @llm-rule WHEN: Listening to events that should only fire once
   * @llm-rule AVOID: Manual cleanup - this handles removal after first trigger
   */
  once(event: string, handler: EventHandler): void {
    this.validateEventName(event);
    this.validateHandler(handler);

    if (this.isWildcardPattern(event)) {
      // For wildcards, create wrapper that removes itself
      const onceWrapper: WildcardHandler = (eventName: string, data: any) => {
        this.removeWildcardHandler(event, onceWrapper);
        (handler as any)(eventName, data);
      };
      this.addWildcardHandler(event, onceWrapper);
    } else {
      const namespacedEvent = this.buildEventName(event);
      this.strategy.once(namespacedEvent, handler);
    }
  }

  /**
   * Removes event listener(s)
   * @llm-rule WHEN: Cleaning up event listeners to prevent memory leaks
   * @llm-rule AVOID: Forgetting to remove listeners - causes memory leaks over time
   */
  off(event: string, handler?: EventHandler | WildcardHandler): void {
    this.validateEventName(event);

    if (this.isWildcardPattern(event)) {
      if (handler) {
        this.removeWildcardHandler(event, handler as WildcardHandler);
      } else {
        this.wildcardHandlers.delete(event);
      }
    } else {
      const namespacedEvent = this.buildEventName(event);
      this.strategy.off(namespacedEvent, handler as EventHandler);
    }
  }

  /**
   * Emits multiple events efficiently (batch operation)
   * @llm-rule WHEN: Emitting multiple events like bulk notifications or data sync
   * @llm-rule AVOID: Multiple individual emit() calls - this handles batching efficiently
   */
  async emitBatch(events: BatchEvent[]): Promise<boolean[]> {
    const results: boolean[] = [];
    
    // Process in batches of 10 for performance
    const batchSize = 10;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      // Emit batch concurrently
      const batchPromises = batch.map(({ event, data }) => this.emit(event, data));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push(false);
        }
      }
      
      // Small delay between batches to be respectful
      if (i + batchSize < events.length) {
        await this.sleep(10);
      }
    }
    
    return results;
  }

  /**
   * Gets event history for debugging and replay
   * @llm-rule WHEN: Debugging event flow or implementing event replay functionality
   * @llm-rule AVOID: Using for business logic - history is for debugging and replay only
   */
  async history(event?: string, limit?: number): Promise<EventHistoryEntry[]> {
    if (!this.config.history.enabled) {
      return [];
    }

    let filtered = this.eventHistory; // ✅ Updated to use renamed property

    // Filter by event if specified
    if (event) {
      filtered = this.eventHistory.filter(entry => 
        entry.event === event || this.matchesWildcard(entry.event, event)
      );
    }

    // Apply limit
    if (limit && limit > 0) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Gets current event listeners for debugging
   * @llm-rule WHEN: Debugging event listeners or building admin interfaces
   * @llm-rule AVOID: Using for business logic - this is for debugging only
   */
  getListeners(event?: string): any {
    const strategyListeners = this.strategy.getListeners(event);
    const wildcardListeners = event 
      ? Array.from(this.wildcardHandlers.entries()).filter(([pattern]) => 
          this.matchesWildcard(event, pattern)
        )
      : Array.from(this.wildcardHandlers.entries());

    return {
      direct: strategyListeners,
      wildcards: wildcardListeners.map(([pattern, handlers]) => ({
        pattern,
        count: handlers.length
      }))
    };
  }

  /**
   * Gets current event strategy name for debugging
   * @llm-rule WHEN: Debugging or health checks to see which strategy is active
   * @llm-rule AVOID: Using for application logic - events should be transparent
   */
  getStrategy(): string {
    return this.config.strategy;
  }

  /**
   * Gets event configuration summary for debugging
   * @llm-rule WHEN: Health checks or debugging event configuration
   * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
   */
  getConfig(): {
    strategy: string;
    namespace: string;
    historyEnabled: boolean;
    historySize: number;
    connected: boolean;
  } {
    return {
      strategy: this.config.strategy,
      namespace: this.namespace,
      historyEnabled: this.config.history.enabled,
      historySize: this.eventHistory.length, // ✅ Updated to use renamed property
      connected: this.connected,
    };
  }

  // Private helper methods

  /**
   * Ensures event system is connected before operations
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Builds namespaced event name
   */
  private buildEventName(event: string): string {
    return `${this.namespace}:${event}`;
  }

  /**
   * Validates event name format
   */
  private validateEventName(event: string): void {
    if (!event || typeof event !== 'string') {
      throw new Error('[@bloomneo/appkit/event] Event name must be a non-empty string');
    }

    if (event.length > 255) {
      throw new Error('[@bloomneo/appkit/event] Event name too long (max 255 characters)');
    }

    // Allow alphanumeric, dots, dashes, underscores, and asterisks (for wildcards)
    if (!/^[a-zA-Z0-9._*-]+$/.test(event)) {
      throw new Error('[@bloomneo/appkit/event] Event name contains invalid characters. Use only letters, numbers, dots, dashes, underscores, and asterisks.');
    }
  }

  /**
   * Validates event handler function
   */
  private validateHandler(handler: any): void {
    if (typeof handler !== 'function') {
      throw new Error('[@bloomneo/appkit/event] Event handler must be a function');
    }
  }

  /**
   * Checks if event name is a wildcard pattern
   */
  private isWildcardPattern(event: string): boolean {
    return event.includes('*');
  }

  /**
   * Adds wildcard handler
   */
  private addWildcardHandler(pattern: string, handler: WildcardHandler): void {
    if (!this.wildcardHandlers.has(pattern)) {
      this.wildcardHandlers.set(pattern, []);
    }
    this.wildcardHandlers.get(pattern)!.push(handler);
  }

  /**
   * Removes wildcard handler
   */
  private removeWildcardHandler(pattern: string, handler: WildcardHandler): void {
    const handlers = this.wildcardHandlers.get(pattern);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.wildcardHandlers.delete(pattern);
      }
    }
  }

  /**
   * Handles wildcard pattern matching for emitted events
   */
  private handleWildcardEmit(event: string, data: any): void {
    for (const [pattern, handlers] of this.wildcardHandlers.entries()) {
      if (this.matchesWildcard(event, pattern)) {
        for (const handler of handlers) {
          try {
            const result = handler(event, data);
            if (result && typeof result.then === 'function') {
              result.catch((error: Error) => {
                console.error(`[@bloomneo/appkit/event] Wildcard handler error for pattern "${pattern}":`, error.message);
              });
            }
          } catch (error) {
            console.error(`[@bloomneo/appkit/event] Wildcard handler error for pattern "${pattern}":`, (error as Error).message);
          }
        }
      }
    }
  }

  /**
   * Checks if event matches wildcard pattern
   */
  private matchesWildcard(event: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return event === pattern;
    }

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^.]*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(event);
  }

  /**
   * Adds event to history with size management
   */
  private addToHistory(event: string, data: any): void {
    const entry: EventHistoryEntry = {
      event,
      data,
      timestamp: new Date().toISOString(),
      namespace: this.namespace,
    };

    this.eventHistory.push(entry); // ✅ Updated to use renamed property

    // Maintain history size limit
    if (this.eventHistory.length > this.config.history.maxSize) {
      this.eventHistory = this.eventHistory.slice(-this.config.history.maxSize); // ✅ Updated to use renamed property
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}