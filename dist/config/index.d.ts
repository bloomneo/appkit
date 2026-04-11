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
import { type ConfigValue } from './defaults.js';
/**
 * Get configuration instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any operation that needs configuration - this is your main entry point
 * @llm-rule AVOID: Calling new ConfigClass() directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → config.get('path') → use value
 * @llm-rule NOTE: Only parses non-framework variables for your app config
 */
declare function get(overrides?: ConfigValue): ConfigClass;
/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing config logic with different environment variables
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: ConfigValue): ConfigClass;
/**
 * Clear the cached configuration instance
 * @llm-rule WHEN: Testing or when you need to reload environment variables
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function clearCache(): void;
/**
 * Get current environment (development, production, test)
 * @llm-rule WHEN: Need to conditionally enable features based on environment
 * @llm-rule AVOID: Checking process.env.NODE_ENV directly - use this for consistency
 */
declare function getEnvironment(): string;
/**
 * Check if running in development mode
 * @llm-rule WHEN: Need to enable debug features or detailed logging
 * @llm-rule AVOID: Manual environment checks - use this for consistency
 */
declare function isDevelopment(): boolean;
/**
 * Check if running in production mode
 * @llm-rule WHEN: Need to disable debug features or enable optimizations
 * @llm-rule AVOID: Manual environment checks - use this for consistency
 */
declare function isProduction(): boolean;
/**
 * Check if running in test mode
 * @llm-rule WHEN: Need to enable test-specific behavior
 * @llm-rule AVOID: Manual environment checks - use this for consistency
 */
declare function isTest(): boolean;
/**
 * Get all environment variables that follow the UPPER_SNAKE_CASE convention
 * @llm-rule WHEN: Debugging configuration or documenting available config options
 * @llm-rule AVOID: Using for runtime config access - use get() instead
 * @llm-rule NOTE: Only returns non-framework variables - your app config
 */
declare function getEnvVars(): Record<string, string>;
/**
 * Validate that required configuration paths exist
 * @llm-rule WHEN: App startup to ensure critical config is present
 * @llm-rule AVOID: Using in request handlers - expensive validation
 * @llm-rule NOTE: Throws descriptive errors with environment variable names
 */
declare function validateRequired(paths: string[]): void;
/**
 * Get configuration for a specific module/feature
 * @llm-rule WHEN: Module initialization that needs multiple related config values
 * @llm-rule AVOID: Multiple get() calls - use this for better performance
 */
declare function getModuleConfig<T extends Record<string, any>>(modulePrefix: string, defaults?: T): T;
/**
 * Single configuration export with enhanced functionality
 */
export declare const configClass: {
    readonly get: typeof get;
    readonly reset: typeof reset;
    readonly clearCache: typeof clearCache;
    readonly getEnvironment: typeof getEnvironment;
    readonly isDevelopment: typeof isDevelopment;
    readonly isProduction: typeof isProduction;
    readonly isTest: typeof isTest;
    readonly getEnvVars: typeof getEnvVars;
    readonly validateRequired: typeof validateRequired;
    readonly getModuleConfig: typeof getModuleConfig;
};
export type { ConfigValue, AppConfig } from './defaults.js';
export { ConfigClass } from './config.js';
//# sourceMappingURL=index.d.ts.map