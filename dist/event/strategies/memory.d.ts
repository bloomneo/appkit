/**
 * Memory event strategy with Node.js EventEmitter and cleanup management
 * @module @bloomneo/appkit/event
 * @file src/event/strategies/memory.ts
 *
 * @llm-rule WHEN: No REDIS_URL environment variable - perfect for development and single-server apps
 * @llm-rule AVOID: Production use across multiple servers - events don't work across processes
 * @llm-rule NOTE: Fast local events, automatic cleanup, memory limits, great for development
 */
import type { EventStrategy, EventHandler } from '../event.js';
import type { EventConfig } from '../defaults.js';
/**
 * Memory event strategy with intelligent cleanup and limits
 */
export declare class MemoryStrategy implements EventStrategy {
    private config;
    private namespace;
    private emitter;
    private cleanupInterval;
    private listenerCounts;
    /**
     * Creates memory strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Event initialization without Redis URL - automatic fallback
     * @llm-rule AVOID: Manual memory configuration - environment detection handles this
     */
    constructor(config: EventConfig, namespace: string);
    /**
     * Emits event via Node.js EventEmitter
     * @llm-rule WHEN: Sending events within single process/server
     * @llm-rule AVOID: Expecting cross-process delivery - memory events are local only
     * @llm-rule NOTE: Instant delivery, no network latency, perfect for development
     */
    emit(event: string, data: any): Promise<boolean>;
    /**
     * Adds event listener with automatic cleanup tracking
     * @llm-rule WHEN: Listening to events within single process
     * @llm-rule AVOID: Adding too many listeners - respects maxListeners limit
     */
    on(event: string, handler: EventHandler): void;
    /**
     * Adds one-time event listener with automatic cleanup
     * @llm-rule WHEN: Listening to events that should only fire once
     * @llm-rule AVOID: Manual cleanup - this handles removal automatically
     */
    once(event: string, handler: EventHandler): void;
    /**
     * Removes event listener(s) with cleanup tracking
     * @llm-rule WHEN: Cleaning up event listeners to prevent memory leaks
     * @llm-rule AVOID: Forgetting to remove listeners - memory strategy tracks everything
     */
    off(event: string, handler?: EventHandler): void;
    /**
     * Gets current event listeners for debugging
     * @llm-rule WHEN: Debugging event listeners or monitoring memory usage
     * @llm-rule AVOID: Using for business logic - this is for debugging only
     */
    getListeners(event?: string): any;
    /**
     * Disconnects memory strategy gracefully
     * @llm-rule WHEN: App shutdown or event cleanup
     * @llm-rule AVOID: Memory leaks - always cleanup intervals and listeners
     */
    disconnect(): Promise<void>;
    /**
     * Checks if adding listener would exceed limit
     */
    private checkListenerLimit;
    /**
     * Increments listener count tracking
     */
    private incrementListenerCount;
    /**
     * Decrements listener count tracking
     */
    private decrementListenerCount;
    /**
     * Updates listener count from actual emitter state
     */
    private updateListenerCount;
    /**
     * Sets up automatic cleanup interval
     */
    private setupCleanup;
    /**
     * Stops cleanup interval
     */
    private stopCleanup;
    /**
     * Performs memory cleanup and garbage collection
     */
    private performCleanup;
    /**
     * Syncs tracking counts with actual emitter state
     */
    private syncListenerCounts;
    /**
     * Cleans up events with no listeners
     */
    private cleanupEmptyEvents;
    /**
     * Gets memory usage statistics
     */
    private getMemoryStats;
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
        events: Array<{
            event: string;
            listeners: number;
        }>;
        cleanupEnabled: boolean;
        lastCleanup: string;
    };
}
//# sourceMappingURL=memory.d.ts.map