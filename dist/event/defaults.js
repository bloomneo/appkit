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
/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready event configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects strategy: REDIS_URL → Redis, no REDIS_URL → Memory
 */
export function getSmartDefaults() {
    validateEnvironment();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    // Auto-detect strategy from environment
    const strategy = detectEventStrategy();
    return {
        // Strategy selection with smart detection
        strategy,
        // Namespace with service identification
        namespace: process.env.BLOOM_EVENT_NAMESPACE || process.env.BLOOM_SERVICE_NAME || 'default',
        // Redis configuration (only used when strategy is 'redis')
        redis: {
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            password: process.env.REDIS_PASSWORD,
            maxRetries: parseInt(process.env.BLOOM_EVENT_REDIS_RETRIES || '3'),
            retryDelay: parseInt(process.env.BLOOM_EVENT_REDIS_RETRY_DELAY || '1000'),
            connectTimeout: parseInt(process.env.BLOOM_EVENT_REDIS_CONNECT_TIMEOUT || '10000'),
            commandTimeout: parseInt(process.env.BLOOM_EVENT_REDIS_COMMAND_TIMEOUT || '5000'),
            keyPrefix: process.env.BLOOM_EVENT_REDIS_PREFIX || 'events',
        },
        // Memory configuration (only used when strategy is 'memory')
        memory: {
            maxListeners: parseInt(process.env.BLOOM_EVENT_MEMORY_MAX_LISTENERS || '1000'),
            maxHistory: parseInt(process.env.BLOOM_EVENT_MEMORY_HISTORY || '100'),
            checkInterval: parseInt(process.env.BLOOM_EVENT_MEMORY_CHECK_INTERVAL || '30000'), // 30 seconds
            enableGC: process.env.BLOOM_EVENT_MEMORY_GC !== 'false',
        },
        // Event history configuration
        history: {
            enabled: process.env.BLOOM_EVENT_HISTORY_ENABLED !== 'false',
            maxSize: parseInt(process.env.BLOOM_EVENT_HISTORY_SIZE || (isProduction ? '50' : '100')),
        },
        // Environment information
        environment: {
            isDevelopment,
            isProduction,
            isTest,
            nodeEnv,
        },
    };
}
/**
 * Auto-detect event strategy from environment variables
 * @llm-rule WHEN: Determining which event strategy to use automatically
 * @llm-rule AVOID: Manual strategy selection - environment detection handles most cases
 * @llm-rule NOTE: Priority: REDIS_URL → Redis, no REDIS_URL → Memory (perfect for dev/prod)
 */
function detectEventStrategy() {
    // Explicit override wins (for testing/debugging)
    const explicit = process.env.BLOOM_EVENT_STRATEGY?.toLowerCase();
    if (explicit === 'redis' || explicit === 'memory') {
        return explicit;
    }
    // Auto-detection logic
    if (process.env.REDIS_URL) {
        return 'redis'; // Redis URL available - use distributed events
    }
    // Default to memory for development/testing
    if (process.env.NODE_ENV === 'production') {
        console.warn('[Bloomneo AppKit] No REDIS_URL found in production. ' +
            'Using memory event strategy which will not work across multiple servers. ' +
            'Set REDIS_URL for distributed events.');
    }
    return 'memory'; // Default to memory for single-server setups
}
/**
 * Validates environment variables for event configuration
 * @llm-rule WHEN: App startup to ensure proper event environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes silent event failures
 * @llm-rule NOTE: Validates Redis URLs, numeric values, and production requirements
 */
function validateEnvironment() {
    // Validate event strategy if explicitly set
    const strategy = process.env.BLOOM_EVENT_STRATEGY;
    if (strategy && !['redis', 'memory'].includes(strategy.toLowerCase())) {
        throw new Error(`Invalid BLOOM_EVENT_STRATEGY: "${strategy}". Must be "redis" or "memory"`);
    }
    // Validate Redis URL if provided
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && !isValidRedisUrl(redisUrl)) {
        throw new Error(`Invalid REDIS_URL: "${redisUrl}". Must start with redis:// or rediss://`);
    }
    // Validate namespace
    const namespace = process.env.BLOOM_EVENT_NAMESPACE;
    if (namespace && !/^[a-zA-Z0-9_-]+$/.test(namespace)) {
        throw new Error(`Invalid BLOOM_EVENT_NAMESPACE: "${namespace}". Must contain only letters, numbers, underscores, and hyphens`);
    }
    // Validate numeric values
    validateNumericEnv('BLOOM_EVENT_REDIS_RETRIES', 0, 10);
    validateNumericEnv('BLOOM_EVENT_REDIS_RETRY_DELAY', 100, 10000);
    validateNumericEnv('BLOOM_EVENT_REDIS_CONNECT_TIMEOUT', 1000, 60000);
    validateNumericEnv('BLOOM_EVENT_REDIS_COMMAND_TIMEOUT', 1000, 30000);
    validateNumericEnv('BLOOM_EVENT_MEMORY_MAX_LISTENERS', 10, 10000);
    validateNumericEnv('BLOOM_EVENT_MEMORY_HISTORY', 10, 1000);
    validateNumericEnv('BLOOM_EVENT_MEMORY_CHECK_INTERVAL', 5000, 300000); // 5s to 5min
    validateNumericEnv('BLOOM_EVENT_HISTORY_SIZE', 1, 1000);
    // Validate Redis key prefix
    const keyPrefix = process.env.BLOOM_EVENT_REDIS_PREFIX;
    if (keyPrefix && !/^[a-zA-Z0-9_-]+$/.test(keyPrefix)) {
        throw new Error(`Invalid BLOOM_EVENT_REDIS_PREFIX: "${keyPrefix}". Must contain only letters, numbers, underscores, and hyphens`);
    }
    // Production-specific validations
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
        validateProductionConfig();
    }
    // Validate NODE_ENV
    if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
        console.warn(`[Bloomneo AppKit] Unusual NODE_ENV: "${nodeEnv}". ` +
            `Expected: development, production, test, or staging`);
    }
}
/**
 * Validates Redis URL format
 * @llm-rule WHEN: Checking Redis connection string validity
 * @llm-rule AVOID: Using invalid Redis URLs - causes connection failures
 */
function isValidRedisUrl(url) {
    try {
        const parsed = new URL(url);
        return ['redis:', 'rediss:'].includes(parsed.protocol);
    }
    catch {
        return false;
    }
}
/**
 * Validates numeric environment variable within acceptable range
 * @llm-rule WHEN: Validating event configuration numeric values
 * @llm-rule AVOID: Using values outside safe ranges - causes performance or memory issues
 */
function validateNumericEnv(name, min, max) {
    const value = process.env[name];
    if (!value)
        return;
    const num = parseInt(value);
    if (isNaN(num) || num < min || num > max) {
        throw new Error(`Invalid ${name}: "${value}". Must be a number between ${min} and ${max}`);
    }
}
/**
 * Validates production event configuration
 * @llm-rule WHEN: Running in production environment
 * @llm-rule AVOID: Memory strategy in multi-server production - events won't work across servers
 */
function validateProductionConfig() {
    const strategy = detectEventStrategy();
    if (strategy === 'memory') {
        console.warn('[Bloomneo AppKit] Using memory event strategy in production. ' +
            'Events will only work within single server instance. ' +
            'Set REDIS_URL for distributed events across multiple servers.');
    }
    // Validate namespace is set in production
    const namespace = process.env.BLOOM_EVENT_NAMESPACE;
    if (!namespace) {
        console.warn('[Bloomneo AppKit] No event namespace configured in production. ' +
            'Set BLOOM_EVENT_NAMESPACE for proper event isolation.');
    }
}
/**
 * Gets event configuration summary for debugging and health checks
 * @llm-rule WHEN: Debugging event configuration or building health check endpoints
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
export function getConfigSummary() {
    const config = getSmartDefaults();
    return {
        strategy: config.strategy,
        namespace: config.namespace,
        historyEnabled: config.history.enabled,
        redisConnected: config.strategy === 'redis' && !!config.redis?.url,
        environment: config.environment.nodeEnv,
    };
}
/**
 * Validates that required event configuration is present for production
 * @llm-rule WHEN: App startup validation for production deployments
 * @llm-rule AVOID: Skipping validation - missing event config causes runtime issues
 */
export function validateProductionRequirements() {
    const config = getSmartDefaults();
    if (config.environment.isProduction) {
        if (config.strategy === 'memory') {
            console.warn('[Bloomneo AppKit] Using memory event strategy in production. ' +
                'Events will not work across multiple server instances. ' +
                'Set REDIS_URL for distributed events.');
        }
        if (config.strategy === 'redis' && !config.redis?.url) {
            throw new Error('Redis strategy selected but REDIS_URL not configured. ' +
                'Set REDIS_URL environment variable for Redis events.');
        }
    }
}
/**
 * Validates startup configuration and throws detailed errors
 * @llm-rule WHEN: App startup to ensure event configuration is valid before starting
 * @llm-rule AVOID: Skipping validation - catches config issues early
 * @llm-rule NOTE: Comprehensive validation for production readiness
 */
export function validateStartupConfiguration() {
    const warnings = [];
    const errors = [];
    try {
        const config = getSmartDefaults();
        const strategy = config.strategy;
        // Strategy-specific validation
        switch (strategy) {
            case 'redis':
                if (!config.redis?.url) {
                    errors.push('REDIS_URL is required for Redis strategy');
                }
                else if (!isValidRedisUrl(config.redis.url)) {
                    errors.push('REDIS_URL must start with redis:// or rediss://');
                }
                break;
            case 'memory':
                if (config.environment.isProduction) {
                    warnings.push('Memory strategy in production - events will not work across servers');
                }
                break;
        }
        // Namespace validation
        if (!config.namespace || config.namespace === 'default') {
            if (config.environment.isProduction) {
                warnings.push('Using default namespace in production - consider setting BLOOM_EVENT_NAMESPACE');
            }
        }
        // Environment-specific warnings
        if (config.environment.isProduction && strategy === 'memory') {
            warnings.push('No Redis configured for distributed events in production');
        }
        if (config.environment.isDevelopment && strategy === 'redis') {
            warnings.push('Using Redis in development - memory strategy is faster for local development');
        }
        return {
            strategy,
            warnings,
            errors,
            ready: errors.length === 0,
        };
    }
    catch (error) {
        errors.push(`Configuration validation failed: ${error.message}`);
        return {
            strategy: 'unknown',
            warnings,
            errors,
            ready: false,
        };
    }
}
/**
 * Performs comprehensive event system health check
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Running in critical path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed health status without exposing sensitive data
 */
export function performHealthCheck() {
    const issues = [];
    let status = 'healthy';
    try {
        const validation = validateStartupConfiguration();
        // Determine overall status
        if (validation.errors.length > 0) {
            status = 'error';
            issues.push(...validation.errors);
        }
        else if (validation.warnings.length > 0) {
            status = 'warning';
            issues.push(...validation.warnings);
        }
        const configured = validation.strategy !== 'memory' ||
            process.env.NODE_ENV !== 'production';
        return {
            status,
            strategy: validation.strategy,
            configured,
            issues,
            ready: validation.ready,
            timestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        return {
            status: 'error',
            strategy: 'unknown',
            configured: false,
            issues: [`Health check failed: ${error.message}`],
            ready: false,
            timestamp: new Date().toISOString(),
        };
    }
}
/**
 * Gets optimal event configuration for different environments
 * @llm-rule WHEN: Setting up environment-specific event behavior
 * @llm-rule AVOID: Manual environment handling - this provides optimal defaults
 */
export function getEnvironmentOptimizedConfig() {
    const config = getSmartDefaults();
    // Optimize for different environments
    if (config.environment.isDevelopment) {
        // Development: More history, frequent GC
        config.history.maxSize = 100;
        if (config.memory) {
            config.memory.checkInterval = 10000; // 10 seconds
            config.memory.enableGC = true;
        }
    }
    else if (config.environment.isProduction) {
        // Production: Less history, less frequent GC
        config.history.maxSize = 50;
        if (config.memory) {
            config.memory.checkInterval = 60000; // 1 minute
            config.memory.enableGC = true;
        }
    }
    else if (config.environment.isTest) {
        // Test: Minimal history, no GC
        config.history.maxSize = 10;
        if (config.memory) {
            config.memory.checkInterval = 1000; // 1 second
            config.memory.enableGC = false;
        }
    }
    return config;
}
/**
 * Checks if Redis is available and properly configured
 * @llm-rule WHEN: Conditional logic based on event capabilities
 * @llm-rule AVOID: Complex event detection - just use events normally, strategy handles it
 */
export function hasRedis() {
    const redisUrl = process.env.REDIS_URL;
    return !!(redisUrl && isValidRedisUrl(redisUrl));
}
/**
 * Gets recommended configuration for microservices
 * @llm-rule WHEN: Setting up events for microservices architecture
 * @llm-rule AVOID: Default config for microservices - needs specific tuning
 */
export function getMicroservicesConfig() {
    return {
        strategy: 'redis', // Always use Redis for microservices
        history: {
            enabled: true,
            maxSize: 25, // Less history per service
        },
        redis: {
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            maxRetries: 5, // More retries for reliability
            retryDelay: 2000, // Longer delays
            connectTimeout: 15000, // Longer timeout
            commandTimeout: 10000, // Longer command timeout
            keyPrefix: 'microservices:events',
        },
    };
}
//# sourceMappingURL=defaults.js.map