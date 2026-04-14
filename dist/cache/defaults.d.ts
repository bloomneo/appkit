/**
 * Smart defaults and environment validation for caching
 * @module @bloomneo/appkit/cache
 * @file src/cache/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure cache behavior and connection strategy
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export interface RedisConfig {
    url: string;
    password?: string;
    maxRetries: number;
    retryDelay: number;
    connectTimeout: number;
    commandTimeout: number;
}
export interface MemoryConfig {
    maxItems: number;
    maxSizeBytes: number;
    checkInterval: number;
}
export interface CacheConfig {
    strategy: 'redis' | 'memory';
    keyPrefix: string;
    defaultTTL: number;
    namespace: string;
    redis?: RedisConfig;
    memory?: MemoryConfig;
    environment: {
        isDevelopment: boolean;
        isProduction: boolean;
        isTest: boolean;
        nodeEnv: string;
    };
}
/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready cache configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects Redis vs Memory based on REDIS_URL environment variable
 */
export declare function getSmartDefaults(): CacheConfig;
//# sourceMappingURL=defaults.d.ts.map