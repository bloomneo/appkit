/**
 * Smart defaults and environment validation for utilities
 * @module @bloomneo/appkit/util
 * @file src/util/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure utility behavior and performance settings
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance like other modules
 */
export interface CacheConfig {
    enabled: boolean;
    maxSize: number;
    ttl: number;
}
export interface PerformanceConfig {
    enabled: boolean;
    memoization: boolean;
    largeArrayThreshold: number;
    chunkSizeLimit: number;
}
export interface DebugConfig {
    enabled: boolean;
    logOperations: boolean;
    trackPerformance: boolean;
}
export interface SlugifyConfig {
    lowercase: boolean;
    strict: boolean;
    locale: string;
    replacement: string;
}
export interface FormatConfig {
    locale: string;
    currency: string;
    dateFormat: string;
    numberPrecision: number;
}
export interface EnvironmentConfig {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    nodeEnv: string;
}
export interface UtilConfig {
    version: string;
    cache: CacheConfig;
    performance: PerformanceConfig;
    debug: DebugConfig;
    slugify: SlugifyConfig;
    format: FormatConfig;
    environment: EnvironmentConfig;
}
/**
 * Gets smart defaults using VOILA_UTIL_* environment variables
 * @llm-rule WHEN: App startup to get production-ready utility configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export declare function getSmartDefaults(): UtilConfig;
/**
 * Creates utility error with helpful context
 * @llm-rule WHEN: Creating errors in utility functions for better debugging
 * @llm-rule AVOID: Using generic Error objects - utility errors need context
 */
export declare function createUtilityError(message: string, operation?: string, input?: any): Error;
/**
 * Default configuration constants for reference
 */
export declare const DEFAULT_CACHE_SIZE = 1000;
export declare const DEFAULT_CACHE_TTL = 300000;
export declare const DEFAULT_ARRAY_THRESHOLD = 10000;
export declare const DEFAULT_CHUNK_LIMIT = 100000;
export declare const DEFAULT_NUMBER_PRECISION = 2;
export declare const DEFAULT_LOCALE = "en-US";
export declare const DEFAULT_CURRENCY = "USD";
export declare const DEFAULT_SLUGIFY_REPLACEMENT = "-";
//# sourceMappingURL=defaults.d.ts.map