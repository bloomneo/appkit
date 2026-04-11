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
/**
 * Event class with automatic strategy selection and ultra-simple API
 */
export class EventClass {
    config;
    namespace;
    strategy;
    connected = false;
    eventHistory = []; // ✅ Renamed from 'history' to 'eventHistory'
    wildcardHandlers = new Map();
    constructor(config, namespace) {
        this.config = config;
        this.namespace = namespace;
        this.strategy = this.createStrategy();
    }
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Event initialization - selects Redis or Memory based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    createStrategy() {
        switch (this.config.strategy) {
            case 'redis':
                return new RedisStrategy(this.config, this.namespace);
            case 'memory':
                return new MemoryStrategy(this.config, this.namespace);
            default:
                throw new Error(`Unknown event strategy: ${this.config.strategy}`);
        }
    }
    /**
     * Connects to event backend with automatic retry logic
     * @llm-rule WHEN: Event initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles connection state
     */
    async connect() {
        if (this.connected)
            return;
        try {
            // Strategy-specific connection (Redis connects, Memory is immediate)
            if ('connect' in this.strategy) {
                await this.strategy.connect();
            }
            this.connected = true;
            if (this.config.environment.isDevelopment) {
                console.log(`✅ [AppKit] Event system connected using ${this.config.strategy} strategy (namespace: ${this.namespace})`);
            }
        }
        catch (error) {
            console.error(`❌ [AppKit] Event connection failed:`, error.message);
            throw error;
        }
    }
    /**
     * Disconnects from event backend gracefully
     * @llm-rule WHEN: App shutdown or event cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    async disconnect() {
        if (!this.connected)
            return;
        try {
            await this.strategy.disconnect();
            this.connected = false;
            this.wildcardHandlers.clear();
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [AppKit] Event system disconnected (namespace: ${this.namespace})`);
            }
        }
        catch (error) {
            console.error(`⚠️ [AppKit] Event disconnect error:`, error.message);
        }
    }
    /**
     * Emits an event with automatic namespacing and history tracking
     * @llm-rule WHEN: Triggering events in your application
     * @llm-rule AVOID: Manual event management - this handles namespacing and distribution
     * @llm-rule NOTE: Automatically adds to history if enabled, handles wildcards
     */
    async emit(event, data = {}) {
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
                console.log(`📤 [AppKit] Event emitted: ${event}`, data);
            }
            return result;
        }
        catch (error) {
            console.error(`[AppKit] Event emit error for "${event}":`, error.message);
            return false;
        }
    }
    /**
     * Adds event listener with automatic namespacing and wildcard support
     * @llm-rule WHEN: Listening to events in your application
     * @llm-rule AVOID: Manual listener management - this handles namespacing and wildcards
     * @llm-rule NOTE: Supports wildcard patterns like 'user.*' or 'order.*.completed'
     */
    on(event, handler) {
        this.validateEventName(event);
        this.validateHandler(handler);
        if (this.isWildcardPattern(event)) {
            this.addWildcardHandler(event, handler);
        }
        else {
            const namespacedEvent = this.buildEventName(event);
            this.strategy.on(namespacedEvent, handler);
        }
    }
    /**
     * Adds one-time event listener with automatic cleanup
     * @llm-rule WHEN: Listening to events that should only fire once
     * @llm-rule AVOID: Manual cleanup - this handles removal after first trigger
     */
    once(event, handler) {
        this.validateEventName(event);
        this.validateHandler(handler);
        if (this.isWildcardPattern(event)) {
            // For wildcards, create wrapper that removes itself
            const onceWrapper = (eventName, data) => {
                this.removeWildcardHandler(event, onceWrapper);
                handler(eventName, data);
            };
            this.addWildcardHandler(event, onceWrapper);
        }
        else {
            const namespacedEvent = this.buildEventName(event);
            this.strategy.once(namespacedEvent, handler);
        }
    }
    /**
     * Removes event listener(s)
     * @llm-rule WHEN: Cleaning up event listeners to prevent memory leaks
     * @llm-rule AVOID: Forgetting to remove listeners - causes memory leaks over time
     */
    off(event, handler) {
        this.validateEventName(event);
        if (this.isWildcardPattern(event)) {
            if (handler) {
                this.removeWildcardHandler(event, handler);
            }
            else {
                this.wildcardHandlers.delete(event);
            }
        }
        else {
            const namespacedEvent = this.buildEventName(event);
            this.strategy.off(namespacedEvent, handler);
        }
    }
    /**
     * Emits multiple events efficiently (batch operation)
     * @llm-rule WHEN: Emitting multiple events like bulk notifications or data sync
     * @llm-rule AVOID: Multiple individual emit() calls - this handles batching efficiently
     */
    async emitBatch(events) {
        const results = [];
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
                }
                else {
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
    async history(event, limit) {
        if (!this.config.history.enabled) {
            return [];
        }
        let filtered = this.eventHistory; // ✅ Updated to use renamed property
        // Filter by event if specified
        if (event) {
            filtered = this.eventHistory.filter(entry => entry.event === event || this.matchesWildcard(entry.event, event));
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
    getListeners(event) {
        const strategyListeners = this.strategy.getListeners(event);
        const wildcardListeners = event
            ? Array.from(this.wildcardHandlers.entries()).filter(([pattern]) => this.matchesWildcard(event, pattern))
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
    getStrategy() {
        return this.config.strategy;
    }
    /**
     * Gets event configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging event configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig() {
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
    async ensureConnected() {
        if (!this.connected) {
            await this.connect();
        }
    }
    /**
     * Builds namespaced event name
     */
    buildEventName(event) {
        return `${this.namespace}:${event}`;
    }
    /**
     * Validates event name format
     */
    validateEventName(event) {
        if (!event || typeof event !== 'string') {
            throw new Error('Event name must be a non-empty string');
        }
        if (event.length > 255) {
            throw new Error('Event name too long (max 255 characters)');
        }
        // Allow alphanumeric, dots, dashes, underscores, and asterisks (for wildcards)
        if (!/^[a-zA-Z0-9._*-]+$/.test(event)) {
            throw new Error('Event name contains invalid characters. Use only letters, numbers, dots, dashes, underscores, and asterisks.');
        }
    }
    /**
     * Validates event handler function
     */
    validateHandler(handler) {
        if (typeof handler !== 'function') {
            throw new Error('Event handler must be a function');
        }
    }
    /**
     * Checks if event name is a wildcard pattern
     */
    isWildcardPattern(event) {
        return event.includes('*');
    }
    /**
     * Adds wildcard handler
     */
    addWildcardHandler(pattern, handler) {
        if (!this.wildcardHandlers.has(pattern)) {
            this.wildcardHandlers.set(pattern, []);
        }
        this.wildcardHandlers.get(pattern).push(handler);
    }
    /**
     * Removes wildcard handler
     */
    removeWildcardHandler(pattern, handler) {
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
    handleWildcardEmit(event, data) {
        for (const [pattern, handlers] of this.wildcardHandlers.entries()) {
            if (this.matchesWildcard(event, pattern)) {
                for (const handler of handlers) {
                    try {
                        const result = handler(event, data);
                        if (result && typeof result.then === 'function') {
                            result.catch((error) => {
                                console.error(`Wildcard handler error for pattern "${pattern}":`, error.message);
                            });
                        }
                    }
                    catch (error) {
                        console.error(`Wildcard handler error for pattern "${pattern}":`, error.message);
                    }
                }
            }
        }
    }
    /**
     * Checks if event matches wildcard pattern
     */
    matchesWildcard(event, pattern) {
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
    addToHistory(event, data) {
        const entry = {
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=event.js.map