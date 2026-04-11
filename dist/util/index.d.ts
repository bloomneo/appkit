/**
 * Ultra-simple utilities that just work
 * @module @bloomneo/appkit/util
 * @file src/util/index.ts
 *
 * @llm-rule WHEN: Building apps that need common utility functions (get, chunk, slugify, debounce, etc.)
 * @llm-rule AVOID: Manual utility implementation - this provides tested, optimized functions with edge cases handled
 * @llm-rule NOTE: Common pattern - utilclass.get() → util.get() → util.chunk() → util.slugify()
 * @llm-rule NOTE: 12 essential utilities: get, isEmpty, slugify, chunk, debounce, pick, unique, clamp, formatBytes, truncate, sleep, uuid
 */
import { UtilClass } from './util.js';
import { type UtilConfig } from './defaults.js';
/**
 * Get utility instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any utility operation - this is your main entry point
 * @llm-rule AVOID: Calling new UtilClass() directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → util.get() → util.chunk() → util.slugify()
 */
declare function get(overrides?: Partial<UtilConfig>): UtilClass;
/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing utility logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<UtilConfig>): UtilClass;
/**
 * Clear the cached utility instance
 * @llm-rule WHEN: Testing or when you need to reload environment variables
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function clearCache(): void;
/**
 * Get current utility configuration for inspection
 * @llm-rule WHEN: Debugging utility behavior or documenting utility configuration
 * @llm-rule AVOID: Using for runtime utility decisions - use get() instead
 */
declare function getConfig(): UtilConfig;
/**
 * Check if running in development mode (affects utility logging)
 * @llm-rule WHEN: Need to conditionally add debug information to utility operations
 * @llm-rule AVOID: Manual NODE_ENV checks - use this for consistency
 */
declare function isDevelopment(): boolean;
/**
 * Check if running in production mode (affects utility performance optimizations)
 * @llm-rule WHEN: Need to conditionally enable performance optimizations
 * @llm-rule AVOID: Manual NODE_ENV checks - use this for consistency
 */
declare function isProduction(): boolean;
/**
 * Get utility status for health checks and monitoring
 * @llm-rule WHEN: Building health check endpoints or utility monitoring
 * @llm-rule AVOID: Exposing internal utility details - this only shows availability
 */
declare function getStatus(): {
    cacheEnabled: boolean;
    performance: boolean;
    environment: string;
    version: string;
};
/**
 * Quick utility setup helper for common patterns
 * @llm-rule WHEN: Setting up utilities with custom configuration quickly
 * @llm-rule AVOID: Using without understanding - review configuration for your needs
 * @llm-rule NOTE: Returns utility instance with optimized settings for common use cases
 */
declare function quickSetup(options?: {
    performance?: boolean;
    cache?: boolean;
    debug?: boolean;
}): UtilClass;
/**
 * Validate utility configuration at startup
 * @llm-rule WHEN: App startup to ensure utility config is valid
 * @llm-rule AVOID: Using in request handlers - expensive validation
 * @llm-rule NOTE: Validates performance settings and cache configuration
 */
declare function validateConfig(): void;
/**
 * Single utility export with enhanced functionality
 */
export declare const utilClass: {
    readonly get: typeof get;
    readonly reset: typeof reset;
    readonly clearCache: typeof clearCache;
    readonly getConfig: typeof getConfig;
    readonly isDevelopment: typeof isDevelopment;
    readonly isProduction: typeof isProduction;
    readonly quickSetup: typeof quickSetup;
    readonly validateConfig: typeof validateConfig;
    readonly getStatus: typeof getStatus;
};
export type { UtilConfig } from './defaults.js';
export type { GetOptions, ChunkOptions, TruncateOptions, DebounceOptions, FormatBytesOptions, SlugifyOptions, } from './util.js';
export { UtilClass } from './util.js';
//# sourceMappingURL=index.d.ts.map