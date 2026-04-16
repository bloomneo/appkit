/**
 * Ultra-simple job queuing that just works with automatic transport detection
 * @module @bloomneo/appkit/queue
 * @file src/queue/index.ts
 *
 * @llm-rule WHEN: Building apps that need background job processing
 * @llm-rule AVOID: Complex queue setups with multiple libraries - this handles everything automatically
 * @llm-rule NOTE: Uses queueClass.get() pattern like other modules - get() → queue.add() → queue.process() → done
 * @llm-rule NOTE: Auto-detects transports: Memory (dev) → Redis (REDIS_URL) → Database (DATABASE_URL)
 * @llm-rule NOTE: Common pattern - queueClass.get() → queue.add() → queue.process() → automatic retry + dead letter queue
 */
import { QueueClass } from './queue.js';
import { getSmartDefaults } from './defaults.js';
// Global queuing instance for performance (like auth module)
let globalQueuing = null;
/**
 * Get queuing instance - the only function you need to learn
 * Transport auto-detection: Memory → Redis → Database based on environment
 * @llm-rule WHEN: Starting any background job operation - this is your main entry point
 * @llm-rule AVOID: Creating QueueClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → queue.add() → queue.process() → automatic handling
 */
function get(overrides = {}) {
    // Lazy initialization - parse environment once (like auth)
    if (!globalQueuing) {
        const defaults = getSmartDefaults();
        const config = { ...defaults, ...overrides };
        globalQueuing = new QueueClass(config);
    }
    return globalQueuing;
}
/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing queuing logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function reset(newConfig = {}) {
    if (globalQueuing) {
        // Close existing instance gracefully
        globalQueuing.close();
    }
    const defaults = getSmartDefaults();
    const config = { ...defaults, ...newConfig };
    globalQueuing = new QueueClass(config);
    return globalQueuing;
}
/**
 * Get active transport type for debugging
 * @llm-rule WHEN: Need to see which transport is running (memory, redis, database)
 * @llm-rule AVOID: Using for business logic - this is for debugging only
 */
function getActiveTransport() {
    if (!globalQueuing) {
        return 'none';
    }
    return globalQueuing.getActiveTransport();
}
/**
 * Check if specific transport is active
 * @llm-rule WHEN: Conditionally handling jobs based on transport capability
 * @llm-rule AVOID: Complex transport detection - just add jobs normally, transports auto-handle
 */
function hasTransport(name) {
    if (!globalQueuing) {
        return false;
    }
    return globalQueuing.hasTransport(name);
}
/**
 * Get current configuration for debugging
 * @llm-rule WHEN: Debugging queuing setup or checking environment detection
 * @llm-rule AVOID: Using for runtime decisions - configuration is set at startup
 */
function getConfig() {
    if (!globalQueuing) {
        return null;
    }
    return globalQueuing.getConfig();
}
/**
 * Close transports and reset the singleton — the canonical teardown call.
 * Name mirrors cacheClass.disconnectAll() per NAMING.md §Bulk-and-Lifecycle-Ops.
 *
 * @llm-rule WHEN: End-of-test-suite teardown, graceful shutdown, SIGTERM handler
 * @llm-rule AVOID: Calling between individual tests if your jobs are still
 *   running — wait for queue drain first
 */
async function disconnectAll() {
    if (globalQueuing) {
        await globalQueuing.close();
        globalQueuing = null;
    }
}
/**
 * Get health status of queuing system
 * @llm-rule WHEN: Health checks or monitoring dashboard
 * @llm-rule AVOID: Frequent polling - expensive operation for some transports
 */
function getHealth() {
    if (!globalQueuing) {
        return { status: 'unhealthy', transport: 'none', message: 'Queuing not initialized' };
    }
    return globalQueuing.getHealth();
}
/**
 * Single queuing export with minimal functionality (like auth module)
 */
export const queueClass = {
    // Core method (like auth.get())
    get,
    // Bulk / lifecycle ops
    disconnectAll, // Close transports + reset singleton. Use for teardown / SIGTERM.
    reset, // Close + reinitialize (tests with different config only)
    // Utility methods
    getActiveTransport,
    hasTransport,
    getConfig,
    getHealth,
};
export { QueueClass } from './queue.js';
// Default export
export default queueClass;
// Graceful shutdown is opt-in. The library does not register process signal
// handlers — the host app owns its lifecycle. Wire it up yourself:
//
//   import queueClass from '@bloomneo/appkit/queue';
//   process.on('SIGTERM', () => queueClass.disconnectAll().finally(() => process.exit(0)));
//   process.on('SIGINT',  () => queueClass.disconnectAll().finally(() => process.exit(0)));
//# sourceMappingURL=index.js.map