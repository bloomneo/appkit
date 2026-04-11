/**
 * Ultra-simple logging that just works with enterprise features and enhanced error display
 * @module @bloomneo/appkit/logger
 * @file src/logger/index.ts
 * 
 * @llm-rule WHEN: Need logging in any app - console, files, database, external services
 * @llm-rule AVOID: Using console.log directly - this provides structured logging with levels
 * @llm-rule NOTE: Uses loggerClass.get() pattern like auth - get() → log.info() → done
 * @llm-rule NOTE: Enhanced error() method now provides automatic visual formatting in development
 */

import { LoggerClass } from './logger.js';
import { getSmartDefaults } from './defaults.js';

// Global logger instances for performance (like auth module)
let globalLogger: LoggerClass | null = null;
const namedLoggers = new Map<string, LoggerClass>();

export interface LogMeta {
  [key: string]: any;
}

export interface Logger {
  info(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;  // Enhanced with automatic visual formatting
  warn(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
  fatal(message: string, meta?: LogMeta): void;  // Critical — process is about to exit
  child(bindings: LogMeta): Logger;
  flush(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Get logger instance - the only function you need to learn
 * @llm-rule WHEN: Starting any logging operation - this is your main entry point
 * @llm-rule AVOID: Creating LoggerClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → info/error/warn/debug() → automatic transport
 * @llm-rule NOTE: error() method now automatically provides visual formatting when appropriate
 */
function get(component?: string): Logger {
  // Lazy initialization - parse environment once (like auth)
  if (!globalLogger) {
    const config = getSmartDefaults();
    globalLogger = new LoggerClass(config);
  }

  // Return main logger if no component specified
  if (!component) {
    return globalLogger;
  }

  // Return cached or create new child logger
  if (namedLoggers.has(component)) {
    return namedLoggers.get(component)!;
  }

  const childLogger = globalLogger.child({ component });
  namedLoggers.set(component, childLogger);
  return childLogger;
}

/**
 * Clear all loggers and close transports - essential for testing
 * @llm-rule WHEN: Testing logging logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and cleanup
 */
async function clear(): Promise<void> {
  if (globalLogger) {
    await globalLogger.close();
    globalLogger = null;
  }
  namedLoggers.clear();
}

/**
 * Get active transport names for debugging
 * @llm-rule WHEN: Need to see which transports are running (console, file, database, etc)
 * @llm-rule AVOID: Using for business logic - this is for debugging only
 */
function getActiveTransports(): string[] {
  if (!globalLogger) {
    return [];
  }
  return globalLogger.getActiveTransports();
}

/**
 * Check if specific transport is active
 * @llm-rule WHEN: Conditionally logging based on transport availability
 * @llm-rule AVOID: Complex transport detection - just log normally, transports auto-enable
 */
function hasTransport(name: string): boolean {
  if (!globalLogger) {
    return false;
  }
  return globalLogger.hasTransport(name);
}

/**
 * Get current configuration for debugging
 * @llm-rule WHEN: Debugging logging setup or checking environment detection
 * @llm-rule AVOID: Using for runtime decisions - configuration is set at startup
 */
function getConfig() {
  if (!globalLogger) {
    return null;
  }
  return globalLogger.getConfig();
}

/**
 * Single logger export with minimal API (like auth module)
 */
export const loggerClass = {
  // Core method (like auth.get())
  get,
  
  // Utility methods
  clear,
  getActiveTransports,
  hasTransport,
  getConfig,
} as const;

// Export types for consumers
export type { LoggingConfig } from './defaults.js';
export { LoggerClass } from './logger.js';

// Default export
export default loggerClass;