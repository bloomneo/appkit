/**
 * Smart defaults and environment validation for event system with auto-strategy detection
 * @module @bloomneo/appkit/event
 * @file src/event/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure event system and connection strategy
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule NOTE: Auto-detects Redis vs Memory based on REDIS_URL environment variable
 */
export interface RedisConfig {
    url: string;
    password?: string;
    maxRetries: number;
    retryDelay: number;
    connectTimeout: number;
    commandTimeout: number;
    keyPrefix: string;
}
export interface MemoryConfig {
    maxListeners: number;
    maxHistory: number;
    checkInterval: number;
    enableGC: boolean;
}
export interface EventConfig {
    strategy: 'redis' | 'memory';
    namespace: string;
    redis?: RedisConfig;
    memory?: MemoryConfig;
    history: {
        enabled: boolean;
        maxSize: number;
    };
    environment: {
        isDevelopment: boolean;
        isProduction: boolean;
        isTest: boolean;
        nodeEnv: string;
    };
}
/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready event configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects strategy: REDIS_URL → Redis, no REDIS_URL → Memory
 */
export declare function getSmartDefaults(): EventConfig;
/**
 * Gets event configuration summary for debugging and health checks
 * @llm-rule WHEN: Debugging event configuration or building health check endpoints
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
export declare function getConfigSummary(): {
    strategy: string;
    namespace: string;
    historyEnabled: boolean;
    redisConnected: boolean;
    environment: string;
};
/**
 * Validates that required event configuration is present for production
 * @llm-rule WHEN: App startup validation for production deployments
 * @llm-rule AVOID: Skipping validation - missing event config causes runtime issues
 */
export declare function validateProductionRequirements(): void;
/**
 * Validates startup configuration and throws detailed errors
 * @llm-rule WHEN: App startup to ensure event configuration is valid before starting
 * @llm-rule AVOID: Skipping validation - catches config issues early
 * @llm-rule NOTE: Comprehensive validation for production readiness
 */
export declare function validateStartupConfiguration(): {
    strategy: string;
    warnings: string[];
    errors: string[];
    ready: boolean;
};
/**
 * Performs comprehensive event system health check
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Running in critical path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed health status without exposing sensitive data
 */
export declare function performHealthCheck(): {
    status: 'healthy' | 'warning' | 'error';
    strategy: string;
    configured: boolean;
    issues: string[];
    ready: boolean;
    timestamp: string;
};
/**
 * Gets optimal event configuration for different environments
 * @llm-rule WHEN: Setting up environment-specific event behavior
 * @llm-rule AVOID: Manual environment handling - this provides optimal defaults
 */
export declare function getEnvironmentOptimizedConfig(): EventConfig;
/**
 * Checks if Redis is available and properly configured
 * @llm-rule WHEN: Conditional logic based on event capabilities
 * @llm-rule AVOID: Complex event detection - just use events normally, strategy handles it
 */
export declare function hasRedis(): boolean;
/**
 * Gets recommended configuration for microservices
 * @llm-rule WHEN: Setting up events for microservices architecture
 * @llm-rule AVOID: Default config for microservices - needs specific tuning
 */
export declare function getMicroservicesConfig(): Partial<EventConfig>;
//# sourceMappingURL=defaults.d.ts.map