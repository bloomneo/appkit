/**
 * Smart defaults and environment validation for job queue management
 * @module @bloomneo/appkit/queue
 * @file src/queue/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to parse BLOOM_QUEUE_* environment variables and detect transports
 * @llm-rule AVOID: Calling multiple times - expensive validation, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance like auth/logging modules
 */
/**
 * Get smart defaults using direct BLOOM_QUEUE_* environment access
 * @llm-rule WHEN: App startup to get production-ready queue configuration
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export function getSmartDefaults() {
    // Direct environment access with smart defaults (like auth module)
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const isDevelopment = nodeEnv === 'development';
    const isTest = nodeEnv === 'test';
    // Auto-detect transport
    const transport = getTransport();
    // Auto-detect worker mode
    const workerEnabled = getWorkerEnabled(isDevelopment);
    return {
        transport,
        // Core settings - direct env access
        concurrency: parseInt(process.env.BLOOM_QUEUE_CONCURRENCY || (isProduction ? '10' : '5')),
        maxAttempts: parseInt(process.env.BLOOM_QUEUE_MAX_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.BLOOM_QUEUE_RETRY_DELAY || '5000'),
        retryBackoff: process.env.BLOOM_QUEUE_RETRY_BACKOFF || 'exponential',
        // Job management - direct env access
        defaultPriority: parseInt(process.env.BLOOM_QUEUE_DEFAULT_PRIORITY || '0'),
        removeOnComplete: parseInt(process.env.BLOOM_QUEUE_REMOVE_COMPLETE || (isProduction ? '100' : '10')),
        removeOnFail: parseInt(process.env.BLOOM_QUEUE_REMOVE_FAILED || (isProduction ? '500' : '50')),
        // Memory transport config - direct env access
        memory: {
            maxJobs: parseInt(process.env.BLOOM_QUEUE_MEMORY_MAX_JOBS || (isDevelopment ? '1000' : '100')),
            cleanupInterval: parseInt(process.env.BLOOM_QUEUE_MEMORY_CLEANUP || '30000'),
        },
        // Redis transport config - direct env access
        redis: {
            url: process.env.REDIS_URL || null,
            keyPrefix: process.env.BLOOM_QUEUE_REDIS_PREFIX || 'queue',
            maxRetriesPerRequest: parseInt(process.env.BLOOM_QUEUE_REDIS_RETRIES || '3'),
            retryDelayOnFailover: parseInt(process.env.BLOOM_QUEUE_REDIS_FAILOVER_DELAY || '100'),
        },
        // Database transport config - direct env access
        database: {
            url: process.env.DATABASE_URL || null,
            tableName: process.env.BLOOM_QUEUE_DB_TABLE || 'queue_jobs',
            batchSize: parseInt(process.env.BLOOM_QUEUE_DB_BATCH || '50'),
            pollInterval: parseInt(process.env.BLOOM_QUEUE_DB_POLL || (isProduction ? '5000' : '2000')),
        },
        // Worker config - direct env access
        worker: {
            enabled: workerEnabled,
            gracefulShutdownTimeout: parseInt(process.env.BLOOM_QUEUE_SHUTDOWN_TIMEOUT || '30000'),
            stalledInterval: parseInt(process.env.BLOOM_QUEUE_STALLED_INTERVAL || '30000'),
            maxStalledCount: parseInt(process.env.BLOOM_QUEUE_MAX_STALLED || '1'),
        },
        // Service identification - direct env access
        service: {
            name: process.env.BLOOM_SERVICE_NAME || process.env.npm_package_name || 'app',
            version: process.env.BLOOM_SERVICE_VERSION || process.env.npm_package_version || '1.0.0',
            environment: nodeEnv,
        },
    };
}
/**
 * Auto-detect optimal transport based on available environment variables
 * @llm-rule WHEN: Need to determine which transport to use automatically
 * @llm-rule AVOID: Manual transport selection - auto-detection handles most cases correctly
 */
function getTransport() {
    // Manual override wins (like auth module pattern)
    const manual = process.env.BLOOM_QUEUE_TRANSPORT?.toLowerCase();
    if (manual === 'memory' || manual === 'redis' || manual === 'database') {
        return manual;
    }
    // Auto-detection logic (production-first)
    if (process.env.REDIS_URL) {
        return 'redis'; // Best for production - persistent, distributed
    }
    if (process.env.DATABASE_URL) {
        return 'database'; // Good for simple setups - persistent, familiar
    }
    return 'memory'; // Development fallback - simple, no setup
}
/**
 * Auto-detect if worker mode should be enabled
 * @llm-rule WHEN: Need to determine if this instance should process jobs
 * @llm-rule AVOID: Always enabling workers - can cause resource conflicts
 */
function getWorkerEnabled(isDevelopment) {
    // Explicit worker mode setting
    const workerEnv = process.env.BLOOM_QUEUE_WORKER;
    if (workerEnv !== undefined) {
        return workerEnv.toLowerCase() === 'true';
    }
    // Auto-detection based on environment
    if (isDevelopment) {
        return true; // Development: process jobs in same process
    }
    // Production: only enable if explicitly set or in worker-specific deployments
    const isWorkerDeployment = process.env.DYNO?.includes('worker') || // Heroku
        process.env.CONTAINER_NAME?.includes('worker') || // Docker
        process.env.SERVICE_NAME?.includes('worker'); // K8s
    return isWorkerDeployment || false;
}
/**
 * Validate environment variables (like auth module validation)
 * @llm-rule WHEN: App startup to catch configuration errors early
 * @llm-rule AVOID: Skipping validation - invalid config causes silent failures
 */
export function validateEnvironment() {
    // Validate concurrency
    const concurrency = process.env.BLOOM_QUEUE_CONCURRENCY;
    if (concurrency && (isNaN(parseInt(concurrency)) || parseInt(concurrency) < 1 || parseInt(concurrency) > 100)) {
        throw new Error(`Invalid BLOOM_QUEUE_CONCURRENCY: "${concurrency}". Must be number between 1 and 100`);
    }
    // Validate max attempts
    const maxAttempts = process.env.BLOOM_QUEUE_MAX_ATTEMPTS;
    if (maxAttempts && (isNaN(parseInt(maxAttempts)) || parseInt(maxAttempts) < 1 || parseInt(maxAttempts) > 10)) {
        throw new Error(`Invalid BLOOM_QUEUE_MAX_ATTEMPTS: "${maxAttempts}". Must be number between 1 and 10`);
    }
    // Validate retry backoff
    const backoff = process.env.BLOOM_QUEUE_RETRY_BACKOFF;
    if (backoff && !['fixed', 'exponential'].includes(backoff)) {
        throw new Error(`Invalid BLOOM_QUEUE_RETRY_BACKOFF: "${backoff}". Must be: fixed, exponential`);
    }
    // Validate transport selection
    const transport = process.env.BLOOM_QUEUE_TRANSPORT;
    if (transport && !['memory', 'redis', 'database'].includes(transport)) {
        throw new Error(`Invalid BLOOM_QUEUE_TRANSPORT: "${transport}". Must be: memory, redis, database`);
    }
    // Validate Redis URL if provided
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && !isValidRedisUrl(redisUrl)) {
        throw new Error(`Invalid REDIS_URL: "${redisUrl}". Must be valid Redis connection string`);
    }
    // Validate Database URL if provided
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !isValidDatabaseUrl(dbUrl)) {
        throw new Error(`Invalid DATABASE_URL: "${dbUrl}". Must be valid database connection string`);
    }
    // Validate worker setting
    const worker = process.env.BLOOM_QUEUE_WORKER;
    if (worker && !['true', 'false'].includes(worker.toLowerCase())) {
        throw new Error(`Invalid BLOOM_QUEUE_WORKER: "${worker}". Must be: true, false`);
    }
    // Validate numeric values
    validateNumericEnv('BLOOM_QUEUE_RETRY_DELAY', 1000, 300000); // 1s to 5min
    validateNumericEnv('BLOOM_QUEUE_MEMORY_MAX_JOBS', 100, 100000); // 100 to 100k
    validateNumericEnv('BLOOM_QUEUE_DB_POLL', 1000, 60000); // 1s to 1min
    validateNumericEnv('BLOOM_QUEUE_SHUTDOWN_TIMEOUT', 5000, 120000); // 5s to 2min
}
/**
 * Validate numeric environment variable
 */
function validateNumericEnv(name, min, max) {
    const value = process.env[name];
    if (!value)
        return;
    const num = parseInt(value);
    if (isNaN(num) || num < min || num > max) {
        throw new Error(`Invalid ${name}: "${value}". Must be number between ${min} and ${max}`);
    }
}
/**
 * Validate Redis URL format
 */
function isValidRedisUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
    }
    catch {
        return false;
    }
}
/**
 * Validate database URL format (like logging module)
 */
function isValidDatabaseUrl(url) {
    try {
        const parsed = new URL(url);
        const validProtocols = ['postgres:', 'postgresql:', 'mysql:', 'sqlite:'];
        return validProtocols.includes(parsed.protocol);
    }
    catch {
        return false;
    }
}
/**
 * Gets smart defaults with validation
 * @llm-rule WHEN: App startup to get production-ready queue configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 */
export function getValidatedDefaults() {
    validateEnvironment();
    return getSmartDefaults();
}
//# sourceMappingURL=defaults.js.map