/**
 * Redis event strategy with distributed pub/sub and automatic connection management
 * @module @bloomneo/appkit/event
 * @file src/event/strategies/redis.ts
 *
 * @llm-rule WHEN: App has REDIS_URL environment variable for distributed events across servers
 * @llm-rule AVOID: Manual Redis setup - this handles connection, retry, and subscription management
 * @llm-rule NOTE: Distributed events, automatic reconnection, pattern subscriptions, production-ready
 */
/**
 * Redis event strategy with distributed pub/sub and reliability features
 */
export class RedisStrategy {
    config;
    namespace;
    publisher = null;
    subscriber = null;
    connected = false;
    listeners = new Map();
    patternListeners = new Map();
    /**
     * Creates Redis strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Event initialization with REDIS_URL detected
     * @llm-rule AVOID: Manual Redis configuration - environment detection handles this
     */
    constructor(config, namespace) {
        this.config = config;
        this.namespace = namespace;
    }
    /**
     * Connects to Redis with automatic retry and pub/sub setup
     * @llm-rule WHEN: Event initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles all Redis complexity
     */
    async connect() {
        if (this.connected)
            return;
        try {
            // Dynamic import for Redis client
            const { createClient } = await import('redis');
            const redisConfig = this.config.redis;
            // Create Redis clients (separate for pub/sub)
            const clientConfig = {
                url: redisConfig.url,
                password: redisConfig.password,
                socket: {
                    connectTimeout: redisConfig.connectTimeout,
                    reconnectStrategy: (retries) => {
                        if (retries >= redisConfig.maxRetries) {
                            console.error(`[AppKit] Redis max retries (${redisConfig.maxRetries}) exceeded`);
                            return new Error('Redis connection failed');
                        }
                        const delay = Math.min(redisConfig.retryDelay * Math.pow(2, retries), 10000);
                        console.warn(`[AppKit] Redis reconnecting in ${delay}ms (attempt ${retries + 1})`);
                        return delay;
                    },
                },
            };
            // Create publisher and subscriber clients
            this.publisher = createClient(clientConfig);
            this.subscriber = createClient(clientConfig);
            // Set up event handlers
            this.setupEventHandlers();
            // Connect both clients
            await Promise.all([
                this.publisher.connect(),
                this.subscriber.connect()
            ]);
            this.connected = true;
            if (this.config.environment.isDevelopment) {
                console.log(`✅ [AppKit] Redis event strategy connected (namespace: ${this.namespace})`);
            }
        }
        catch (error) {
            this.connected = false;
            this.publisher = null;
            this.subscriber = null;
            throw new Error(`Redis event connection failed: ${error.message}`);
        }
    }
    /**
     * Sets up Redis event handlers for connection management
     */
    setupEventHandlers() {
        if (!this.publisher || !this.subscriber)
            return;
        // Publisher events
        this.publisher.on('error', (error) => {
            console.error('[AppKit] Redis publisher error:', error.message);
            this.connected = false;
        });
        this.publisher.on('ready', () => {
            if (this.config.environment.isDevelopment) {
                console.log('✅ [AppKit] Redis publisher ready');
            }
        });
        // Subscriber events
        this.subscriber.on('error', (error) => {
            console.error('[AppKit] Redis subscriber error:', error.message);
            this.connected = false;
        });
        this.subscriber.on('ready', () => {
            if (this.config.environment.isDevelopment) {
                console.log('✅ [AppKit] Redis subscriber ready');
            }
        });
        // Handle reconnection
        this.subscriber.on('reconnecting', () => {
            this.connected = false;
            if (this.config.environment.isDevelopment) {
                console.log('🔄 [AppKit] Redis subscriber reconnecting...');
            }
        });
        this.subscriber.on('end', () => {
            this.connected = false;
            if (this.config.environment.isDevelopment) {
                console.log('👋 [AppKit] Redis subscriber connection ended');
            }
        });
    }
    /**
     * Emits event via Redis pub/sub with automatic serialization
     * @llm-rule WHEN: Sending events across multiple servers/processes
     * @llm-rule AVOID: Manual Redis pub/sub - this handles serialization and namespacing
     * @llm-rule NOTE: Events are distributed to all connected servers automatically
     */
    async emit(event, data) {
        if (!this.connected || !this.publisher) {
            console.error(`[AppKit] Redis not connected, cannot emit event: ${event}`);
            return false;
        }
        try {
            // Build Redis channel name with prefix
            const channel = this.buildChannelName(event);
            // Serialize event data
            const message = this.serializeMessage(data);
            // Publish to Redis
            const result = await this.publisher.publish(channel, message);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`📤 [AppKit] Redis event published: ${event} (subscribers: ${result})`);
            }
            return result >= 0; // Redis returns number of subscribers
        }
        catch (error) {
            console.error(`[AppKit] Redis emit error for event "${event}":`, error.message);
            return false;
        }
    }
    /**
     * Adds event listener with Redis subscription management
     * @llm-rule WHEN: Listening to distributed events across servers
     * @llm-rule AVOID: Manual Redis subscribe - this handles pattern matching and message routing
     */
    on(event, handler) {
        try {
            // Add to local listeners map
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(handler);
            // Subscribe to Redis channel if this is the first listener
            if (this.listeners.get(event).size === 1) {
                this.subscribeToEvent(event);
            }
            if (this.config.environment.isDevelopment) {
                console.log(`📥 [AppKit] Redis listener added for: ${event} (total: ${this.listeners.get(event).size})`);
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis on error for event "${event}":`, error.message);
        }
    }
    /**
     * Adds one-time event listener with automatic cleanup
     * @llm-rule WHEN: Listening to distributed events that should only fire once
     * @llm-rule AVOID: Manual cleanup - this handles removal after first trigger
     */
    once(event, handler) {
        try {
            // Create wrapper that removes itself after first call
            const onceWrapper = (data) => {
                this.off(event, onceWrapper);
                handler(data);
            };
            // Add the wrapper as a regular listener
            this.on(event, onceWrapper);
            if (this.config.environment.isDevelopment) {
                console.log(`📥 [AppKit] Redis once listener added for: ${event}`);
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis once error for event "${event}":`, error.message);
        }
    }
    /**
     * Removes event listener(s) with Redis unsubscribe management
     * @llm-rule WHEN: Cleaning up distributed event listeners
     * @llm-rule AVOID: Manual Redis unsubscribe - this handles cleanup automatically
     */
    off(event, handler) {
        try {
            const eventListeners = this.listeners.get(event);
            if (!eventListeners)
                return;
            if (handler) {
                // Remove specific handler
                eventListeners.delete(handler);
                // Unsubscribe from Redis if no more listeners
                if (eventListeners.size === 0) {
                    this.listeners.delete(event);
                    this.unsubscribeFromEvent(event);
                }
            }
            else {
                // Remove all handlers for event
                const count = eventListeners.size;
                this.listeners.delete(event);
                this.unsubscribeFromEvent(event);
                if (this.config.environment.isDevelopment && count > 0) {
                    console.log(`📤 [AppKit] Redis removed ${count} listeners for: ${event}`);
                }
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis off error for event "${event}":`, error.message);
        }
    }
    /**
     * Gets current event listeners for debugging
     * @llm-rule WHEN: Debugging distributed event listeners
     * @llm-rule AVOID: Using for business logic - this is for debugging only
     */
    getListeners(event) {
        if (event) {
            const listeners = this.listeners.get(event);
            return {
                count: listeners ? listeners.size : 0,
                subscribed: this.listeners.has(event),
                channel: this.buildChannelName(event),
            };
        }
        // Get all events with listeners
        const events = Array.from(this.listeners.entries()).map(([eventName, handlers]) => ({
            event: eventName,
            count: handlers.size,
            channel: this.buildChannelName(eventName),
        }));
        return {
            totalEvents: events.length,
            totalListeners: events.reduce((sum, event) => sum + event.count, 0),
            connected: this.connected,
            events,
        };
    }
    /**
     * Disconnects Redis strategy gracefully
     * @llm-rule WHEN: App shutdown or event cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    async disconnect() {
        if (!this.connected)
            return;
        try {
            // Clear all listeners
            this.listeners.clear();
            this.patternListeners.clear();
            // Disconnect Redis clients
            const disconnectPromises = [];
            if (this.publisher) {
                disconnectPromises.push(this.publisher.quit());
            }
            if (this.subscriber) {
                disconnectPromises.push(this.subscriber.quit());
            }
            await Promise.all(disconnectPromises);
            this.connected = false;
            this.publisher = null;
            this.subscriber = null;
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [AppKit] Redis event strategy disconnected (namespace: ${this.namespace})`);
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis disconnect error:`, error.message);
            // Force close if graceful quit fails
            if (this.publisher)
                this.publisher.disconnect();
            if (this.subscriber)
                this.subscriber.disconnect();
            this.publisher = null;
            this.subscriber = null;
        }
    }
    // Private helper methods
    /**
     * Builds Redis channel name with prefix and namespace
     */
    buildChannelName(event) {
        const prefix = this.config.redis?.keyPrefix || 'events';
        return `${prefix}:${this.namespace}:${event}`;
    }
    /**
     * Serializes message data for Redis transmission
     */
    serializeMessage(data) {
        try {
            return JSON.stringify({
                data,
                timestamp: new Date().toISOString(),
                namespace: this.namespace,
            });
        }
        catch (error) {
            throw new Error(`Failed to serialize event data: ${error.message}`);
        }
    }
    /**
     * Deserializes message data from Redis
     */
    deserializeMessage(message) {
        try {
            const parsed = JSON.parse(message);
            return parsed.data;
        }
        catch (error) {
            console.error('Failed to deserialize Redis message:', error);
            return message; // Return raw message as fallback
        }
    }
    /**
     * Subscribes to Redis channel for specific event
     */
    async subscribeToEvent(event) {
        if (!this.connected || !this.subscriber)
            return;
        try {
            const channel = this.buildChannelName(event);
            // Subscribe to Redis channel
            await this.subscriber.subscribe(channel, (message) => {
                this.handleRedisMessage(event, message);
            });
            if (this.config.environment.isDevelopment) {
                console.log(`🔗 [AppKit] Redis subscribed to: ${channel}`);
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis subscribe error for event "${event}":`, error.message);
        }
    }
    /**
     * Unsubscribes from Redis channel for specific event
     */
    async unsubscribeFromEvent(event) {
        if (!this.connected || !this.subscriber)
            return;
        try {
            const channel = this.buildChannelName(event);
            // Unsubscribe from Redis channel
            await this.subscriber.unsubscribe(channel);
            if (this.config.environment.isDevelopment) {
                console.log(`🔓 [AppKit] Redis unsubscribed from: ${channel}`);
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis unsubscribe error for event "${event}":`, error.message);
        }
    }
    /**
     * Handles incoming Redis messages and routes to listeners
     */
    handleRedisMessage(event, message) {
        try {
            // Deserialize message
            const data = this.deserializeMessage(message);
            // Get listeners for this event
            const eventListeners = this.listeners.get(event);
            if (!eventListeners || eventListeners.size === 0)
                return;
            // Call all listeners
            for (const handler of eventListeners) {
                try {
                    const result = handler(data);
                    if (result && typeof result.then === 'function') {
                        result.catch((error) => {
                            console.error(`Redis event handler error for "${event}":`, error.message);
                        });
                    }
                }
                catch (error) {
                    console.error(`Redis event handler error for "${event}":`, error.message);
                }
            }
            if (this.config.environment.isDevelopment) {
                console.log(`📨 [AppKit] Redis message received: ${event} (${eventListeners.size} handlers)`);
            }
        }
        catch (error) {
            console.error(`[AppKit] Redis message handling error:`, error.message);
        }
    }
    /**
     * Gets Redis connection statistics
     */
    getConnectionInfo() {
        const redisConfig = this.config.redis;
        const subscriptions = Array.from(this.listeners.keys());
        const totalListeners = Array.from(this.listeners.values())
            .reduce((sum, listeners) => sum + listeners.size, 0);
        return {
            connected: this.connected,
            url: this.maskUrl(redisConfig.url),
            namespace: this.namespace,
            totalSubscriptions: subscriptions.length,
            totalListeners,
        };
    }
    /**
     * Masks sensitive parts of Redis URL for logging
     */
    maskUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.password) {
                parsed.password = '***';
            }
            return parsed.toString();
        }
        catch {
            return 'redis://***';
        }
    }
}
//# sourceMappingURL=redis.js.map