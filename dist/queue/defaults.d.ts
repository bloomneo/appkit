/**
 * Smart defaults and environment validation for job queue management
 * @module @bloomneo/appkit/queue
 * @file src/queue/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to parse VOILA_QUEUE_* environment variables and detect transports
 * @llm-rule AVOID: Calling multiple times - expensive validation, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance like auth/logging modules
 */
export interface QueueConfig {
    transport: 'memory' | 'redis' | 'database';
    concurrency: number;
    maxAttempts: number;
    retryDelay: number;
    retryBackoff: 'fixed' | 'exponential';
    defaultPriority: number;
    removeOnComplete: number;
    removeOnFail: number;
    memory: {
        maxJobs: number;
        cleanupInterval: number;
    };
    redis: {
        url: string | null;
        keyPrefix: string;
        maxRetriesPerRequest: number;
        retryDelayOnFailover: number;
    };
    database: {
        url: string | null;
        tableName: string;
        batchSize: number;
        pollInterval: number;
    };
    worker: {
        enabled: boolean;
        gracefulShutdownTimeout: number;
        stalledInterval: number;
        maxStalledCount: number;
    };
    service: {
        name: string;
        version: string;
        environment: string;
    };
}
/**
 * Get smart defaults using direct VOILA_QUEUE_* environment access
 * @llm-rule WHEN: App startup to get production-ready queue configuration
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export declare function getSmartDefaults(): QueueConfig;
/**
 * Validate environment variables (like auth module validation)
 * @llm-rule WHEN: App startup to catch configuration errors early
 * @llm-rule AVOID: Skipping validation - invalid config causes silent failures
 */
export declare function validateEnvironment(): void;
/**
 * Gets smart defaults with validation
 * @llm-rule WHEN: App startup to get production-ready queue configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 */
export declare function getValidatedDefaults(): QueueConfig;
//# sourceMappingURL=defaults.d.ts.map