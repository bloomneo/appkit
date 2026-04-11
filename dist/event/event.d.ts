/**
 * Core event class with automatic strategy selection and ultra-simple API
 * @module @bloomneo/appkit/event
 * @file src/event/event.ts
 *
 * @llm-rule WHEN: Building apps that need event-driven architecture with automatic Redis/Memory selection
 * @llm-rule AVOID: Using directly - always get instance via eventClass.get()
 * @llm-rule NOTE: Auto-detects Redis vs Memory based on environment variables
 */
import type { EventConfig } from './defaults.js';
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
export declare class EventClass {
    config: EventConfig;
    namespace: string;
    private strategy;
    private connected;
    private eventHistory;
    private wildcardHandlers;
    constructor(config: EventConfig, namespace: string);
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Event initialization - selects Redis or Memory based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    private createStrategy;
    /**
     * Connects to event backend with automatic retry logic
     * @llm-rule WHEN: Event initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles connection state
     */
    connect(): Promise<void>;
    /**
     * Disconnects from event backend gracefully
     * @llm-rule WHEN: App shutdown or event cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    disconnect(): Promise<void>;
    /**
     * Emits an event with automatic namespacing and history tracking
     * @llm-rule WHEN: Triggering events in your application
     * @llm-rule AVOID: Manual event management - this handles namespacing and distribution
     * @llm-rule NOTE: Automatically adds to history if enabled, handles wildcards
     */
    emit(event: string, data?: any): Promise<boolean>;
    /**
     * Adds event listener with automatic namespacing and wildcard support
     * @llm-rule WHEN: Listening to events in your application
     * @llm-rule AVOID: Manual listener management - this handles namespacing and wildcards
     * @llm-rule NOTE: Supports wildcard patterns like 'user.*' or 'order.*.completed'
     */
    on(event: string, handler: EventHandler | WildcardHandler): void;
    /**
     * Adds one-time event listener with automatic cleanup
     * @llm-rule WHEN: Listening to events that should only fire once
     * @llm-rule AVOID: Manual cleanup - this handles removal after first trigger
     */
    once(event: string, handler: EventHandler): void;
    /**
     * Removes event listener(s)
     * @llm-rule WHEN: Cleaning up event listeners to prevent memory leaks
     * @llm-rule AVOID: Forgetting to remove listeners - causes memory leaks over time
     */
    off(event: string, handler?: EventHandler | WildcardHandler): void;
    /**
     * Emits multiple events efficiently (batch operation)
     * @llm-rule WHEN: Emitting multiple events like bulk notifications or data sync
     * @llm-rule AVOID: Multiple individual emit() calls - this handles batching efficiently
     */
    emitBatch(events: BatchEvent[]): Promise<boolean[]>;
    /**
     * Gets event history for debugging and replay
     * @llm-rule WHEN: Debugging event flow or implementing event replay functionality
     * @llm-rule AVOID: Using for business logic - history is for debugging and replay only
     */
    history(event?: string, limit?: number): Promise<EventHistoryEntry[]>;
    /**
     * Gets current event listeners for debugging
     * @llm-rule WHEN: Debugging event listeners or building admin interfaces
     * @llm-rule AVOID: Using for business logic - this is for debugging only
     */
    getListeners(event?: string): any;
    /**
     * Gets current event strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - events should be transparent
     */
    getStrategy(): string;
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
    };
    /**
     * Ensures event system is connected before operations
     */
    private ensureConnected;
    /**
     * Builds namespaced event name
     */
    private buildEventName;
    /**
     * Validates event name format
     */
    private validateEventName;
    /**
     * Validates event handler function
     */
    private validateHandler;
    /**
     * Checks if event name is a wildcard pattern
     */
    private isWildcardPattern;
    /**
     * Adds wildcard handler
     */
    private addWildcardHandler;
    /**
     * Removes wildcard handler
     */
    private removeWildcardHandler;
    /**
     * Handles wildcard pattern matching for emitted events
     */
    private handleWildcardEmit;
    /**
     * Checks if event matches wildcard pattern
     */
    private matchesWildcard;
    /**
     * Adds event to history with size management
     */
    private addToHistory;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
}
//# sourceMappingURL=event.d.ts.map