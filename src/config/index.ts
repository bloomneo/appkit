/**
 * Ultra-simple configuration management that just works
 * @module @bloomneo/appkit/config
 * @file src/config/index.ts
 * 
 * @llm-rule WHEN: Building apps that need configuration from environment variables
 * @llm-rule AVOID: Complex config setups with multiple files - this handles everything automatically
 * @llm-rule NOTE: Uses UPPER_SNAKE_CASE convention (DATABASE_HOST → config.get('database.host'))
 * @llm-rule NOTE: Common pattern - configClass.get() → config.get('path', default) → use value
 * 
 * CRITICAL UNDERSCORE CONVENTION:
 * - BLOOM_* and FLUX_* = Framework internal variables (NOT parsed as app config)
 * - Everything else = Your app config (parsed into config object)
 * 
 * Examples:
 * ✅ BLOOM_AUTH_SECRET=secret           → Framework internal (not in config object)
 * ✅ DATABASE_HOST=localhost            → config.get('database.host')
 * ✅ REDIS_URL=redis://local            → config.get('redis.url')
 * ❌ BLOOM_DATABASE_HOST=localhost      → Framework var (won't be parsed as app config)
 */

import { ConfigClass } from './config.js';
import {
  getSmartDefaults,
  validateConfig,
  isFrameworkVariable,
  isSystemVariable,
  type AppConfig,
  type ConfigValue,
} from './defaults.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/config/README.md';

// Global configuration instance for performance
let globalConfig: ConfigClass | null = null;

/**
 * Get configuration instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any operation that needs configuration - this is your main entry point
 * @llm-rule AVOID: Calling new ConfigClass() directly - always use this function
 * @llm-rule AVOID: Passing overrides after first call - they are rejected; use reset(newConfig) to rebuild
 * @llm-rule NOTE: Typical flow - get() → config.get('path') → use value
 * @llm-rule NOTE: Only parses non-framework variables for your app config
 */
function get(overrides: ConfigValue = {}): ConfigClass {
  if (globalConfig) {
    if (overrides && Object.keys(overrides).length > 0) {
      throw new Error(
        `[@bloomneo/appkit/config] configClass.get() overrides are only applied on first call. Use configClass.reset(newConfig) to rebuild with new config. See: ${DOCS_URL}#configuration`
      );
    }
    return globalConfig;
  }

  const defaults = getSmartDefaults();
  const finalConfig = { ...defaults, ...overrides } as AppConfig;
  validateConfig(finalConfig);
  globalConfig = new ConfigClass(finalConfig);
  return globalConfig;
}

/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing config logic with different environment variables, or forcing an env re-read
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function reset(newConfig: ConfigValue = {}): ConfigClass {
  const defaults = getSmartDefaults();
  const finalConfig = { ...defaults, ...newConfig } as AppConfig;
  validateConfig(finalConfig);
  globalConfig = new ConfigClass(finalConfig);
  return globalConfig;
}

/**
 * Get current environment (development, production, test)
 * @llm-rule WHEN: Need to conditionally enable features based on environment
 * @llm-rule AVOID: Checking process.env.NODE_ENV directly - use this for consistency
 */
function getEnvironment(): string {
  const config = get();
  return config.get<string>('app.environment', 'development') as string;
}

/**
 * Check if running in development mode
 * @llm-rule WHEN: Need to enable debug features or detailed logging
 * @llm-rule AVOID: Manual environment checks - use this for consistency
 */
function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if running in production mode
 * @llm-rule WHEN: Need to disable debug features or enable optimizations
 * @llm-rule AVOID: Manual environment checks - use this for consistency
 */
function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in test mode
 * @llm-rule WHEN: Need to enable test-specific behavior
 * @llm-rule AVOID: Manual environment checks - use this for consistency
 */
function isTest(): boolean {
  return getEnvironment() === 'test';
}

/**
 * Get all environment variables that follow the UPPER_SNAKE_CASE convention
 * @llm-rule WHEN: Debugging configuration or documenting available config options
 * @llm-rule AVOID: Using for runtime config access - use get() instead
 * @llm-rule NOTE: Only returns non-framework variables - your app config
 */
function getEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {};

  // Mirror the filter used by buildConfigFromEnv so this helper's output
  // stays consistent with what configClass.get() actually parses.
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (isFrameworkVariable(key) || isSystemVariable(key)) continue;
    envVars[key] = value;
  }

  return envVars;
}

/**
 * Validate that required configuration paths exist
 * @llm-rule WHEN: App startup to ensure critical config is present
 * @llm-rule AVOID: Using in request handlers - expensive validation
 * @llm-rule NOTE: Throws descriptive errors with environment variable names
 */
function validateRequired(paths: string[]): void {
  const config = get();
  const missing: string[] = [];
  
  for (const path of paths) {
    if (!config.has(path)) {
      missing.push(path);
    }
  }
  
  if (missing.length > 0) {
    const envVars = missing.map(path => path.split('.').join('_').toUpperCase());
    throw new Error(
      `[@bloomneo/appkit/config] Missing required configuration: ${missing.join(', ')}. Set environment variables: ${envVars.join(', ')}. See: ${DOCS_URL}#startup-validation`
    );
  }
}

/**
 * Get configuration for a specific module/feature
 * @llm-rule WHEN: Module initialization that needs multiple related config values
 * @llm-rule AVOID: Multiple get() calls - use this for better performance
 */
function getModuleConfig<T extends Record<string, any>>(
  modulePrefix: string, 
  defaults: T = {} as T
): T {
  const config = get();
  const moduleConfig = config.get(modulePrefix, {}) as Record<string, any>;
  
  return { ...defaults, ...moduleConfig } as T;
}

/**
 * Single configuration export with enhanced functionality
 */
export const configClass = {
  // Core methods
  get,
  reset,

  // Environment helpers
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,

  // Utility methods
  getEnvVars,
  validateRequired,
  getModuleConfig,
} as const;

// Re-export types for consumers
export type { ConfigValue, AppConfig } from './defaults.js';
export { ConfigClass } from './config.js';

// Default export
export default configClass;