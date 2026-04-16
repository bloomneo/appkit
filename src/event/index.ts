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

import { EventClass } from './event.js';
import {
  getSmartDefaults,
  validateProductionRequirements,
  validateStartupConfiguration,
  performHealthCheck,
  type EventConfig
} from './defaults.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/event/README.md';

// Global event instances for performance (like auth module)
let globalConfig: EventConfig | null = null;
const namedEvents = new Map<string, EventClass>();

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
function get(namespace: string = 'default'): Event {
  // Validate namespace
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('[@bloomneo/appkit/event] Event namespace must be a non-empty string');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(namespace)) {
    throw new Error('[@bloomneo/appkit/event] Event namespace must contain only letters, numbers, underscores, and hyphens');
  }

  // Lazy initialization - parse environment once (like auth)
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }

  // Return cached instance if exists
  if (namedEvents.has(namespace)) {
    return namedEvents.get(namespace)!;
  }

  // Create new event instance for namespace
  const eventInstance = new EventClass(globalConfig, namespace);
  
  // Auto-connect on first use
  eventInstance.connect().catch((error) => {
    console.error(`[@bloomneo/appkit/event] Event auto-connect failed for namespace "${namespace}":`, error.message);
  });

  namedEvents.set(namespace, eventInstance);
  return eventInstance;
}

/**
 * Clear all event instances and disconnect - essential for testing
 * @llm-rule WHEN: Testing event logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
async function clear(): Promise<void> {
  const disconnectPromises: Promise<void>[] = [];

  for (const [namespace, event] of namedEvents) {
    disconnectPromises.push(
      event.disconnect().catch((error) => {
        console.error(`[@bloomneo/appkit/event] Event disconnect failed for namespace "${namespace}":`, error.message);
      })
    );
  }

  await Promise.all(disconnectPromises);
  namedEvents.clear();
  globalConfig = null;
}

/**
 * Reset event configuration (useful for testing)
 * @llm-rule WHEN: Testing event logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
async function reset(newConfig?: Partial<EventConfig>): Promise<void> {
  // Clear existing instances
  await clear();

  // Reset configuration
  if (newConfig) {
    const defaults = getSmartDefaults();
    globalConfig = { ...defaults, ...newConfig };
  } else {
    globalConfig = null; // Will reload from environment on next get()
  }
}

/**
 * Get active event strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Redis vs Memory)
 * @llm-rule AVOID: Using for application logic - events should be transparent
 */
function getStrategy(): string {
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }
  return globalConfig.strategy;
}

/**
 * Get all active event namespaces
 * @llm-rule WHEN: Debugging or monitoring which event namespaces are active
 * @llm-rule AVOID: Using for business logic - this is for observability only
 */
function getActiveNamespaces(): string[] {
  return Array.from(namedEvents.keys());
}

/**
 * Get event configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging event configuration
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
function getConfig(): {
  strategy: string;
  historyEnabled: boolean;
  activeNamespaces: string[];
  environment: string;
} {
  if (!globalConfig) {
    globalConfig = getSmartDefaults();
  }

  return {
    strategy: globalConfig.strategy,
    historyEnabled: globalConfig.history.enabled,
    activeNamespaces: getActiveNamespaces(),
    environment: globalConfig.environment.nodeEnv,
  };
}

/**
 * Check if Redis is available and configured
 * @llm-rule WHEN: Conditional logic based on event capabilities
 * @llm-rule AVOID: Complex event detection - just use events normally, strategy handles it
 */
function hasRedis(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Emit event across all namespaces (dangerous)
 * @llm-rule WHEN: Broadcasting system-wide events like shutdown or maintenance
 * @llm-rule AVOID: Using for regular events - use namespace-specific events instead
 * @llm-rule NOTE: Only use for system-level events that need global broadcast
 */
async function broadcast(event: string, data: any = {}): Promise<boolean[]> {
  const activeInstances = Array.from(namedEvents.values());
  
  if (activeInstances.length === 0) {
    console.warn(`[@bloomneo/appkit/event] No active event namespaces for broadcast: ${event}`);
    return [];
  }

  const results = await Promise.allSettled(
    activeInstances.map(instance => instance.emit(event, data))
  );

  return results.map(result => 
    result.status === 'fulfilled' ? result.value : false
  );
}

/**
 * Get event statistics across all namespaces
 * @llm-rule WHEN: Monitoring event system health and usage
 * @llm-rule AVOID: Using for business logic - this is for monitoring only
 */
function getStats(): {
  strategy: string;
  totalNamespaces: number;
  totalListeners: number;
  connected: number;
  namespaces: Array<{
    namespace: string;
    listeners: number;
    connected: boolean;
  }>;
} {
  const strategy = getStrategy();
  const namespaces = Array.from(namedEvents.entries()).map(([namespace, instance]) => {
    const config = instance.getConfig();
    const listeners = instance.getListeners();
    
    return {
      namespace,
      listeners: listeners.totalListeners || 0,
      connected: config.connected,
    };
  });

  return {
    strategy,
    totalNamespaces: namespaces.length,
    totalListeners: namespaces.reduce((sum, ns) => sum + ns.listeners, 0),
    connected: namespaces.filter(ns => ns.connected).length,
    namespaces,
  };
}

/**
 * Validate event configuration at startup with detailed feedback
 * @llm-rule WHEN: App startup to ensure events are properly configured
 * @llm-rule AVOID: Skipping validation - missing event config causes runtime issues
 * @llm-rule NOTE: Returns validation results instead of throwing - allows graceful handling
 */
function validateConfig(): {
  valid: boolean;
  strategy: string;
  warnings: string[];
  errors: string[];
  ready: boolean;
} {
  try {
    const validation = validateStartupConfiguration();
    
    if (validation.errors.length > 0) {
      console.error('[@bloomneo/appkit/event] Event configuration errors:', validation.errors);
    }

    if (validation.warnings.length > 0) {
      console.warn('[@bloomneo/appkit/event] Event configuration warnings:', validation.warnings);
    }

    if (validation.ready) {
      console.log(`✅ [@bloomneo/appkit/event] Events configured with ${validation.strategy} strategy`);
    }
    
    return {
      valid: validation.errors.length === 0,
      strategy: validation.strategy,
      warnings: validation.warnings,
      errors: validation.errors,
      ready: validation.ready,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[@bloomneo/appkit/event] Event configuration validation failed:', errorMessage);
    
    return {
      valid: false,
      strategy: 'unknown',
      warnings: [],
      errors: [errorMessage],
      ready: false,
    };
  }
}

/**
 * Validate production requirements and throw if critical issues found
 * @llm-rule WHEN: Production deployment validation - ensures events work in production
 * @llm-rule AVOID: Skipping in production - event failures are often silent
 * @llm-rule NOTE: Throws on critical issues, warns on non-critical ones
 */
function validateProduction(): void {
  try {
    validateProductionRequirements();
    
    if (process.env.NODE_ENV === 'production' && !hasRedis()) {
      console.warn(
        '[@bloomneo/appkit/event] No Redis configured in production. ' +
        `Set REDIS_URL for distributed events across servers. See: ${DOCS_URL}#production-deployment`
      );
    }

    console.log('✅ [@bloomneo/appkit/event] Production event requirements validated');
  } catch (error) {
    console.error('[@bloomneo/appkit/event] Production event validation failed:', (error as Error).message);
    throw error;
  }
}

/**
 * Get comprehensive health check status for monitoring
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Using in critical application path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed status without exposing sensitive configuration
 */
function getHealthStatus(): {
  status: 'healthy' | 'warning' | 'error';
  strategy: string;
  configured: boolean;
  issues: string[];
  ready: boolean;
  timestamp: string;
} {
  return performHealthCheck();
}

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
async function disconnectAll(): Promise<void> {
  console.log('🔄 [@bloomneo/appkit/event] Event graceful shutdown...');

  try {
    // Broadcast shutdown event before closing
    await broadcast('system.shutdown', {
      timestamp: new Date().toISOString(),
      reason: 'graceful_shutdown'
    });

    // Small delay to allow event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clear all instances
    await clear();
    console.log('✅ [@bloomneo/appkit/event] Event shutdown complete');
  } catch (error) {
    console.error('❌ [@bloomneo/appkit/event] Event shutdown error:', (error as Error).message);
  }
}

/**
 * Single eventing export with minimal API (like auth module)
 */
export const eventClass = {
  // Core method (like auth.get())
  get,
  
  // Utility methods
  clear,
  reset,
  getStrategy,
  getActiveNamespaces,
  getConfig,
  hasRedis,
  getStats,
  
  // Advanced methods
  broadcast,
  
  // Validation and lifecycle
  validateConfig,
  validateProduction,
  getHealthStatus,
  disconnectAll,
} as const;

// Re-export types for consumers
export type { EventConfig } from './defaults.js';
export { EventClass } from './event.js';

// Default export
export default eventClass;

// Graceful shutdown is opt-in. The library does not register process signal
// handlers — the host app owns its lifecycle. Wire it up yourself:
//
//   import eventClass from '@bloomneo/appkit/event';
//   process.on('SIGTERM', () => eventClass.disconnectAll().finally(() => process.exit(0)));
//   process.on('SIGINT',  () => eventClass.disconnectAll().finally(() => process.exit(0)));