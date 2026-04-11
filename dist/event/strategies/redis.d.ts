/**
 * Redis event strategy with distributed pub/sub and automatic connection management
 * @module @bloomneo/appkit/event
 * @file src/event/strategies/redis.ts
 *
 * @llm-rule WHEN: App has REDIS_URL environment variable for distributed events across servers
 * @llm-rule AVOID: Manual Redis setup - this handles connection, retry, and subscription management
 * @llm-rule NOTE: Distributed events, automatic reconnection, pattern subscriptions, production-ready
 */
import type { EventStrategy, EventHandler } from '../event.js';
import type { EventConfig } from '../defaults.js';
/**
 * Redis event strategy with distributed pub/sub and reliability features
 */
export declare class RedisStrategy implements EventStrategy {
    private config;
    private namespace;
    private publisher;
    private subscriber;
    private connected;
    private listeners;
    private patternListeners;
    /**
     * Creates Redis strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Event initialization with REDIS_URL detected
     * @llm-rule AVOID: Manual Redis configuration - environment detection handles this
     */
    constructor(config: EventConfig, namespace: string);
    /**
     * Connects to Redis with automatic retry and pub/sub setup
     * @llm-rule WHEN: Event initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles all Redis complexity
     */
    connect(): Promise<void>;
    /**
     * Sets up Redis event handlers for connection management
     */
    private setupEventHandlers;
    /**
     * Emits event via Redis pub/sub with automatic serialization
     * @llm-rule WHEN: Sending events across multiple servers/processes
     * @llm-rule AVOID: Manual Redis pub/sub - this handles serialization and namespacing
     * @llm-rule NOTE: Events are distributed to all connected servers automatically
     */
    emit(event: string, data: any): Promise<boolean>;
    /**
     * Adds event listener with Redis subscription management
     * @llm-rule WHEN: Listening to distributed events across servers
     * @llm-rule AVOID: Manual Redis subscribe - this handles pattern matching and message routing
     */
    on(event: string, handler: EventHandler): void;
    /**
     * Adds one-time event listener with automatic cleanup
     * @llm-rule WHEN: Listening to distributed events that should only fire once
     * @llm-rule AVOID: Manual cleanup - this handles removal after first trigger
     */
    once(event: string, handler: EventHandler): void;
    /**
     * Removes event listener(s) with Redis unsubscribe management
     * @llm-rule WHEN: Cleaning up distributed event listeners
     * @llm-rule AVOID: Manual Redis unsubscribe - this handles cleanup automatically
     */
    off(event: string, handler?: EventHandler): void;
    /**
     * Gets current event listeners for debugging
     * @llm-rule WHEN: Debugging distributed event listeners
     * @llm-rule AVOID: Using for business logic - this is for debugging only
     */
    getListeners(event?: string): any;
    /**
     * Disconnects Redis strategy gracefully
     * @llm-rule WHEN: App shutdown or event cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    disconnect(): Promise<void>;
    /**
     * Builds Redis channel name with prefix and namespace
     */
    private buildChannelName;
    /**
     * Serializes message data for Redis transmission
     */
    private serializeMessage;
    /**
     * Deserializes message data from Redis
     */
    private deserializeMessage;
    /**
     * Subscribes to Redis channel for specific event
     */
    private subscribeToEvent;
    /**
     * Unsubscribes from Redis channel for specific event
     */
    private unsubscribeFromEvent;
    /**
     * Handles incoming Redis messages and routes to listeners
     */
    private handleRedisMessage;
    /**
     * Gets Redis connection statistics
     */
    getConnectionInfo(): {
        connected: boolean;
        url: string;
        namespace: string;
        totalSubscriptions: number;
        totalListeners: number;
    };
    /**
     * Masks sensitive parts of Redis URL for logging
     */
    private maskUrl;
}
//# sourceMappingURL=redis.d.ts.map