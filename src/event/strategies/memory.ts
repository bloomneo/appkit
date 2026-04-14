/**
 * Memory event strategy with Node.js EventEmitter and cleanup management
 * @module @bloomneo/appkit/event
 * @file src/event/strategies/memory.ts
 * 
 * @llm-rule WHEN: No REDIS_URL environment variable - perfect for development and single-server apps
 * @llm-rule AVOID: Production use across multiple servers - events don't work across processes
 * @llm-rule NOTE: Fast local events, automatic cleanup, memory limits, great for development
 */

import { EventEmitter } from 'events';
import type { EventStrategy, EventHandler } from '../event.js';
import type { EventConfig } from '../defaults.js';

/**
 * Memory event strategy with intelligent cleanup and limits
 */
export class MemoryStrategy implements EventStrategy {
  private config: EventConfig;
  private namespace: string;
  private emitter: EventEmitter;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private listenerCounts = new Map<string, number>();

  /**
   * Creates memory strategy with direct environment access (like auth pattern)
   * @llm-rule WHEN: Event initialization without Redis URL - automatic fallback
   * @llm-rule AVOID: Manual memory configuration - environment detection handles this
   */
  constructor(config: EventConfig, namespace: string) {
    this.config = config;
    this.namespace = namespace;
    this.emitter = new EventEmitter();
    
    // Set max listeners from config
    this.emitter.setMaxListeners(config.memory?.maxListeners || 1000);
    
    // Setup cleanup if garbage collection enabled
    if (config.memory?.enableGC) {
      this.setupCleanup();
    }

    if (this.config.environment.isDevelopment) {
      console.log(`✅ [@bloomneo/appkit/event] Memory event strategy initialized (namespace: ${namespace}, maxListeners: ${this.emitter.getMaxListeners()})`);
    }
  }

  /**
   * Emits event via Node.js EventEmitter
   * @llm-rule WHEN: Sending events within single process/server
   * @llm-rule AVOID: Expecting cross-process delivery - memory events are local only
   * @llm-rule NOTE: Instant delivery, no network latency, perfect for development
   */
  async emit(event: string, data: any): Promise<boolean> {
    try {
      // Emit via EventEmitter (synchronous but we return Promise for interface compatibility)
      const result = this.emitter.emit(event, data);
      
      // Update listener count tracking
      this.updateListenerCount(event);
      
      return result;
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Memory emit error for event "${event}":`, (error as Error).message);
      return false;
    }
  }

  /**
   * Adds event listener with automatic cleanup tracking
   * @llm-rule WHEN: Listening to events within single process
   * @llm-rule AVOID: Adding too many listeners - respects maxListeners limit
   */
  on(event: string, handler: EventHandler): void {
    try {
      // Check listener limit
      this.checkListenerLimit(event);
      
      // Add listener
      this.emitter.on(event, handler);
      
      // Track listener count
      this.incrementListenerCount(event);
      
      if (this.config.environment.isDevelopment) {
        console.log(`📥 [@bloomneo/appkit/event] Memory listener added for: ${event} (total: ${this.emitter.listenerCount(event)})`);
      }
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Memory on error for event "${event}":`, (error as Error).message);
    }
  }

  /**
   * Adds one-time event listener with automatic cleanup
   * @llm-rule WHEN: Listening to events that should only fire once
   * @llm-rule AVOID: Manual cleanup - this handles removal automatically
   */
  once(event: string, handler: EventHandler): void {
    try {
      // Check listener limit
      this.checkListenerLimit(event);
      
      // Wrap handler to track cleanup
      const onceWrapper = (data: any) => {
        this.decrementListenerCount(event);
        handler(data);
      };
      
      // Add one-time listener
      this.emitter.once(event, onceWrapper);
      
      // Track listener count
      this.incrementListenerCount(event);
      
      if (this.config.environment.isDevelopment) {
        console.log(`📥 [@bloomneo/appkit/event] Memory once listener added for: ${event}`);
      }
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Memory once error for event "${event}":`, (error as Error).message);
    }
  }

  /**
   * Removes event listener(s) with cleanup tracking
   * @llm-rule WHEN: Cleaning up event listeners to prevent memory leaks
   * @llm-rule AVOID: Forgetting to remove listeners - memory strategy tracks everything
   */
  off(event: string, handler?: EventHandler): void {
    try {
      if (handler) {
        // Remove specific handler
        this.emitter.off(event, handler);
        this.decrementListenerCount(event);
      } else {
        // Remove all handlers for event
        const count = this.emitter.listenerCount(event);
        this.emitter.removeAllListeners(event);
        this.listenerCounts.set(event, 0);
        
        if (this.config.environment.isDevelopment && count > 0) {
          console.log(`📤 [@bloomneo/appkit/event] Memory removed ${count} listeners for: ${event}`);
        }
      }
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Memory off error for event "${event}":`, (error as Error).message);
    }
  }

  /**
   * Gets current event listeners for debugging
   * @llm-rule WHEN: Debugging event listeners or monitoring memory usage
   * @llm-rule AVOID: Using for business logic - this is for debugging only
   */
  getListeners(event?: string): any {
    if (event) {
      return {
        count: this.emitter.listenerCount(event),
        events: [event],
        maxListeners: this.emitter.getMaxListeners(),
      };
    }

    // Get all events with listeners
    const eventNames = this.emitter.eventNames();
    const summary = eventNames.map(eventName => ({
      event: eventName.toString(),
      count: this.emitter.listenerCount(eventName),
    }));

    return {
      totalEvents: eventNames.length,
      totalListeners: summary.reduce((sum, item) => sum + item.count, 0),
      maxListeners: this.emitter.getMaxListeners(),
      events: summary,
    };
  }

  /**
   * Disconnects memory strategy gracefully
   * @llm-rule WHEN: App shutdown or event cleanup
   * @llm-rule AVOID: Memory leaks - always cleanup intervals and listeners
   */
  async disconnect(): Promise<void> {
    try {
      // Stop cleanup interval
      this.stopCleanup();
      
      // Remove all listeners
      this.emitter.removeAllListeners();
      
      // Clear tracking
      this.listenerCounts.clear();
      
      if (this.config.environment.isDevelopment) {
        console.log(`👋 [@bloomneo/appkit/event] Memory event strategy disconnected (namespace: ${this.namespace})`);
      }
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Memory disconnect error:`, (error as Error).message);
    }
  }

  // Private helper methods

  /**
   * Checks if adding listener would exceed limit
   */
  private checkListenerLimit(event: string): void {
    const currentCount = this.emitter.listenerCount(event);
    const maxListeners = this.emitter.getMaxListeners();
    
    if (currentCount >= maxListeners) {
      console.warn(
        `[@bloomneo/appkit/event] Memory event listener limit reached for "${event}" ` +
        `(${currentCount}/${maxListeners}). Consider removing unused listeners.`
      );
    }
  }

  /**
   * Increments listener count tracking
   */
  private incrementListenerCount(event: string): void {
    const current = this.listenerCounts.get(event) || 0;
    this.listenerCounts.set(event, current + 1);
  }

  /**
   * Decrements listener count tracking
   */
  private decrementListenerCount(event: string): void {
    const current = this.listenerCounts.get(event) || 0;
    const newCount = Math.max(0, current - 1);
    
    if (newCount === 0) {
      this.listenerCounts.delete(event);
    } else {
      this.listenerCounts.set(event, newCount);
    }
  }

  /**
   * Updates listener count from actual emitter state
   */
  private updateListenerCount(event: string): void {
    const actualCount = this.emitter.listenerCount(event);
    if (actualCount === 0) {
      this.listenerCounts.delete(event);
    } else {
      this.listenerCounts.set(event, actualCount);
    }
  }

  /**
   * Sets up automatic cleanup interval
   */
  private setupCleanup(): void {
    const interval = this.config.memory?.checkInterval || 30000;
    
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, interval);

    // Don't let interval keep process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stops cleanup interval
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Performs memory cleanup and garbage collection
   */
  private performCleanup(): void {
    try {
      // Sync listener counts with actual emitter state
      this.syncListenerCounts();
      
      // Clean up empty events
      this.cleanupEmptyEvents();
      
      // Log cleanup stats in development
      if (this.config.environment.isDevelopment) {
        const stats = this.getMemoryStats();
        if (stats.totalListeners > 0) {
          console.log(
            `🧹 [@bloomneo/appkit/event] Memory cleanup completed: ` +
            `${stats.totalEvents} events, ${stats.totalListeners} listeners`
          );
        }
      }
    } catch (error) {
      console.error(`[@bloomneo/appkit/event] Memory cleanup error:`, (error as Error).message);
    }
  }

  /**
   * Syncs tracking counts with actual emitter state
   */
  private syncListenerCounts(): void {
    // Check for events that no longer have listeners
    for (const [event] of this.listenerCounts.entries()) {
      const actualCount = this.emitter.listenerCount(event);
      if (actualCount === 0) {
        this.listenerCounts.delete(event);
      } else {
        this.listenerCounts.set(event, actualCount);
      }
    }
  }

  /**
   * Cleans up events with no listeners
   */
  private cleanupEmptyEvents(): void {
    const eventNames = this.emitter.eventNames();
    
    for (const eventName of eventNames) {
      const count = this.emitter.listenerCount(eventName);
      if (count === 0) {
        this.emitter.removeAllListeners(eventName);
        this.listenerCounts.delete(eventName.toString());
      }
    }
  }

  /**
   * Gets memory usage statistics
   */
  private getMemoryStats(): {
    totalEvents: number;
    totalListeners: number;
    maxListeners: number;
    memoryUsage: number;
  } {
    const eventNames = this.emitter.eventNames();
    const totalListeners = eventNames.reduce(
      (sum, eventName) => sum + this.emitter.listenerCount(eventName), 
      0
    );

    return {
      totalEvents: eventNames.length,
      totalListeners,
      maxListeners: this.emitter.getMaxListeners(),
      memoryUsage: totalListeners / this.emitter.getMaxListeners(),
    };
  }

  /**
   * Gets detailed memory statistics for debugging
   */
  getDetailedStats(): {
    strategy: string;
    namespace: string;
    totalEvents: number;
    totalListeners: number;
    maxListeners: number;
    memoryUsage: string;
    events: Array<{ event: string; listeners: number }>;
    cleanupEnabled: boolean;
    lastCleanup: string;
  } {
    const eventNames = this.emitter.eventNames();
    const events = eventNames.map(eventName => ({
      event: eventName.toString(),
      listeners: this.emitter.listenerCount(eventName),
    }));

    const totalListeners = events.reduce((sum, event) => sum + event.listeners, 0);
    const maxListeners = this.emitter.getMaxListeners();

    return {
      strategy: 'memory',
      namespace: this.namespace,
      totalEvents: events.length,
      totalListeners,
      maxListeners,
      memoryUsage: `${Math.round((totalListeners / maxListeners) * 100)}%`,
      events: events.sort((a, b) => b.listeners - a.listeners), // Sort by listener count
      cleanupEnabled: !!this.cleanupInterval,
      lastCleanup: new Date().toISOString(),
    };
  }
}