/**
 * Ultra-simple event-driven architecture that just works with automatic Redis/Memory strategy
 * @module @bloomneo/appkit/event
 * @file src/event/index.ts
 *
 * @llm-rule WHEN: Building apps that need event-driven architecture with zero configuration
 * @llm-rule AVOID: Complex event setups - this auto-detects Redis/Memory from environment
 * @llm-rule NOTE: Uses eventClass.get() pattern like auth - get() → event.emit() → distributed
 * @llm-rule NOTE: Common pattern - eventClass.get(namespace) → event.on() → event.emit() → handled
 */
import { type EventConfig } from './defaults.js';
export interface Event {
    emit(event: string, data?: any): Promise<boolean>;
    on(event: string, handler: EventHandler | WildcardHandler): void;
    once(event: string, handler: EventHandler): void;
    off(event: string, handler?: EventHandler | WildcardHandler): void;
    emitBatch(events: BatchEvent[]): Promise<boolean[]>;
    history(event?: string, limit?: number): Promise<EventHistoryEntry[]>;
    getListeners(event?: string): any;
    disconnect(): Promise<void>;
    getStrategy(): string;
    getConfig(): any;
}
export interface EventHandler {
    (data: any): void | Promise<void>;
}
export interface WildcardHandler {
    (eventName: string, data: any): void | Promise<void>;
}
export interface BatchEvent {
    event: string;
    data: any;
}
export interface EventHistoryEntry {
    event: string;
    data: any;
    timestamp: string;
    namespace: string;
}
/**
 * Get event instance for specific namespace - the only function you need to learn
 * Strategy auto-detected from environment (REDIS_URL → Redis, no URL → Memory)
 * @llm-rule WHEN: Need event-driven architecture in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating EventClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get(namespace) → event.on() → event.emit() → distributed handling
 */
declare function get(namespace?: string): Event;
/**
 * Clear all event instances and disconnect - essential for testing
 * @llm-rule WHEN: Testing event logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
declare function clear(): Promise<void>;
/**
 * Reset event configuration (useful for testing)
 * @llm-rule WHEN: Testing event logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<EventConfig>): Promise<void>;
/**
 * Get active event strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Redis vs Memory)
 * @llm-rule AVOID: Using for application logic - events should be transparent
 */
declare function getStrategy(): string;
/**
 * Get all active event namespaces
 * @llm-rule WHEN: Debugging or monitoring which event namespaces are active
 * @llm-rule AVOID: Using for business logic - this is for observability only
 */
declare function getActiveNamespaces(): string[];
/**
 * Get event configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging event configuration
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
declare function getConfig(): {
    strategy: string;
    historyEnabled: boolean;
    activeNamespaces: string[];
    environment: string;
};
/**
 * Check if Redis is available and configured
 * @llm-rule WHEN: Conditional logic based on event capabilities
 * @llm-rule AVOID: Complex event detection - just use events normally, strategy handles it
 */
declare function hasRedis(): boolean;
/**
 * Emit event across all namespaces (dangerous)
 * @llm-rule WHEN: Broadcasting system-wide events like shutdown or maintenance
 * @llm-rule AVOID: Using for regular events - use namespace-specific events instead
 * @llm-rule NOTE: Only use for system-level events that need global broadcast
 */
declare function broadcast(event: string, data?: any): Promise<boolean[]>;
/**
 * Get event statistics across all namespaces
 * @llm-rule WHEN: Monitoring event system health and usage
 * @llm-rule AVOID: Using for business logic - this is for monitoring only
 */
declare function getStats(): {
    strategy: string;
    totalNamespaces: number;
    totalListeners: number;
    connected: number;
    namespaces: Array<{
        namespace: string;
        listeners: number;
        connected: boolean;
    }>;
};
/**
 * Validate event configuration at startup with detailed feedback
 * @llm-rule WHEN: App startup to ensure events are properly configured
 * @llm-rule AVOID: Skipping validation - missing event config causes runtime issues
 * @llm-rule NOTE: Returns validation results instead of throwing - allows graceful handling
 */
declare function validateConfig(): {
    valid: boolean;
    strategy: string;
    warnings: string[];
    errors: string[];
    ready: boolean;
};
/**
 * Validate production requirements and throw if critical issues found
 * @llm-rule WHEN: Production deployment validation - ensures events work in production
 * @llm-rule AVOID: Skipping in production - event failures are often silent
 * @llm-rule NOTE: Throws on critical issues, warns on non-critical ones
 */
declare function validateProduction(): void;
/**
 * Get comprehensive health check status for monitoring
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Using in critical application path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed status without exposing sensitive configuration
 */
declare function getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error';
    strategy: string;
    configured: boolean;
    issues: string[];
    ready: boolean;
    timestamp: string;
};
/**
 * Close every namespace's transport and reset internal state — the canonical
 * teardown call. Named to match cache/queue per NAMING.md §Bulk-and-Lifecycle-Ops
 * so agents see one teardown verb across every appkit module.
 *
 * Emits a final `system.shutdown` broadcast before closing so subscribers in
 * worker processes get a heads-up (with Redis strategy).
 *
 * @llm-rule WHEN: App shutdown, SIGTERM handler, end-of-test-suite teardown
 * @llm-rule AVOID: Abrupt process exit — graceful drain prevents in-flight event loss
 */
declare function disconnectAll(): Promise<void>;
/**
 * Single eventing export with minimal API (like auth module)
 */
export declare const eventClass: {
    readonly get: typeof get;
    readonly clear: typeof clear;
    readonly reset: typeof reset;
    readonly getStrategy: typeof getStrategy;
    readonly getActiveNamespaces: typeof getActiveNamespaces;
    readonly getConfig: typeof getConfig;
    readonly hasRedis: typeof hasRedis;
    readonly getStats: typeof getStats;
    readonly broadcast: typeof broadcast;
    readonly validateConfig: typeof validateConfig;
    readonly validateProduction: typeof validateProduction;
    readonly getHealthStatus: typeof getHealthStatus;
    readonly disconnectAll: typeof disconnectAll;
};
export type { EventConfig } from './defaults.js';
export { EventClass } from './event.js';
export default eventClass;
//# sourceMappingURL=index.d.ts.map