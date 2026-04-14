/**
 * Core queuing class with automatic transport management and job processing
 * @module @bloomneo/appkit/queue
 * @file src/queue/queue.ts
 *
 * @llm-rule WHEN: Building queue instances - called via queueClass.get(), not directly
 * @llm-rule AVOID: Creating QueueClass directly - always use queueClass.get() for proper setup
 * @llm-rule NOTE: Auto-detects and switches between Memory, Redis, Database transports
 */
import { randomUUID } from 'crypto';
import { MemoryTransport } from './transports/memory.js';
import { RedisTransport } from './transports/redis.js';
import { DatabaseTransport } from './transports/database.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/queue/README.md';
/**
 * Core queuing class with automatic transport management
 */
export class QueueClass {
    config;
    transport;
    transportType;
    isClosing = false;
    constructor(config) {
        this.config = config;
        this.transportType = config.transport;
        this.transport = this.initializeTransport();
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }
    /**
     * Initialize transport based on configuration
     * @llm-rule WHEN: QueueClass construction - sets up appropriate transport
     * @llm-rule AVOID: Manual transport selection - config determines transport type
     */
    initializeTransport() {
        try {
            switch (this.config.transport) {
                case 'redis':
                    if (!this.config.redis.url) {
                        console.warn('[@bloomneo/appkit/queue] Redis transport selected but REDIS_URL not available, falling back to memory');
                        return new MemoryTransport(this.config);
                    }
                    return new RedisTransport(this.config);
                case 'database':
                    if (!this.config.database.url) {
                        console.warn('[@bloomneo/appkit/queue] Database transport selected but DATABASE_URL not available, falling back to memory');
                        return new MemoryTransport(this.config);
                    }
                    return new DatabaseTransport(this.config);
                case 'memory':
                default:
                    return new MemoryTransport(this.config);
            }
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/queue] Failed to initialize ${this.config.transport} transport:`, error.message);
            console.warn('[@bloomneo/appkit/queue] Falling back to memory transport');
            this.transportType = 'memory';
            return new MemoryTransport(this.config);
        }
    }
    /**
     * Add job to queue with automatic ID generation and validation
     * @llm-rule WHEN: Adding background jobs for processing
     * @llm-rule AVOID: Direct transport calls - this handles ID generation and validation
     */
    async add(jobType, data, options = {}) {
        this.validateJobType(jobType);
        this.validateJobData(data);
        const jobId = randomUUID();
        const jobOptions = {
            priority: options.priority ?? this.config.defaultPriority,
            delay: options.delay ?? 0,
            attempts: options.attempts ?? this.config.maxAttempts,
            backoff: options.backoff ?? this.config.retryBackoff,
            removeOnComplete: options.removeOnComplete ?? this.config.removeOnComplete,
            removeOnFail: options.removeOnFail ?? this.config.removeOnFail,
        };
        try {
            if (jobOptions.delay && jobOptions.delay > 0) {
                await this.transport.schedule(jobId, jobType, data, jobOptions.delay);
            }
            else {
                await this.transport.add(jobId, jobType, data, jobOptions);
            }
            return jobId;
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to add job: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Register job processor for specific job type
     * @llm-rule WHEN: Setting up job handlers for background processing
     * @llm-rule AVOID: Multiple processors for same job type - causes conflicts
     */
    process(jobType, handler) {
        this.validateJobType(jobType);
        this.validateHandler(handler);
        // Wrap handler with error handling and retry logic
        const wrappedHandler = this.wrapHandler(handler);
        try {
            this.transport.process(jobType, wrappedHandler);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to register processor for ${jobType}: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Schedule job for future execution
     * @llm-rule WHEN: Need to delay job execution (reminders, notifications, etc.)
     * @llm-rule AVOID: Using setTimeout - this persists across app restarts
     */
    async schedule(jobType, data, delay) {
        this.validateJobType(jobType);
        this.validateJobData(data);
        this.validateDelay(delay);
        const jobId = randomUUID();
        try {
            await this.transport.schedule(jobId, jobType, data, delay);
            return jobId;
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to schedule job: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Pause queue processing
     * @llm-rule WHEN: Maintenance mode or controlled shutdown
     * @llm-rule AVOID: Pausing without resume plan - jobs will accumulate
     */
    async pause(jobType) {
        try {
            await this.transport.pause(jobType);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to pause queue: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Resume queue processing
     * @llm-rule WHEN: Resuming after maintenance or pause
     * @llm-rule AVOID: Resuming without checking system health
     */
    async resume(jobType) {
        try {
            await this.transport.resume(jobType);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to resume queue: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Get queue statistics for monitoring
     * @llm-rule WHEN: Health checks, monitoring dashboards, debugging
     * @llm-rule AVOID: Frequent polling - can be expensive for some transports
     */
    async getStats(jobType) {
        try {
            return await this.transport.getStats(jobType);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to get stats: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Get jobs by status for debugging and monitoring
     * @llm-rule WHEN: Debugging failed jobs or monitoring queue health
     * @llm-rule AVOID: Getting large result sets - use pagination for big queues
     */
    async getJobs(status, jobType) {
        try {
            return await this.transport.getJobs(status, jobType);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to get jobs: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Retry failed job by ID
     * @llm-rule WHEN: Manual retry of failed jobs from admin interface
     * @llm-rule AVOID: Retrying jobs that failed due to code errors without fixing code
     */
    async retry(jobId) {
        this.validateJobId(jobId);
        try {
            await this.transport.retry(jobId);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to retry job ${jobId}: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Remove job from queue
     * @llm-rule WHEN: Canceling scheduled jobs or cleaning up specific jobs
     * @llm-rule AVOID: Removing active jobs - let them complete naturally
     */
    async remove(jobId) {
        this.validateJobId(jobId);
        try {
            await this.transport.remove(jobId);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to remove job ${jobId}: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Clean old jobs by status
     * @llm-rule WHEN: Periodic cleanup to prevent queue storage growth
     * @llm-rule AVOID: Aggressive cleanup - keep some completed jobs for debugging
     */
    async clean(status, grace = 24 * 60 * 60 * 1000) {
        try {
            await this.transport.clean(status, grace);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Failed to clean ${status} jobs: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Gracefully close queue and cleanup resources
     * @llm-rule WHEN: App shutdown or testing cleanup
     * @llm-rule AVOID: Abrupt shutdown - can cause job loss
     */
    async close() {
        if (this.isClosing) {
            return; // Already closing
        }
        this.isClosing = true;
        try {
            // Pause processing first
            await this.transport.pause();
            // Wait for current jobs to complete (with timeout)
            await this.waitForActiveJobs();
            // Close transport
            await this.transport.close();
        }
        catch (error) {
            console.error('[@bloomneo/appkit/queue] Error during graceful shutdown:', error.message);
        }
    }
    /**
     * Get active transport type for debugging
     * @llm-rule WHEN: Debugging transport selection or health checks
     * @llm-rule AVOID: Using for business logic - transport is implementation detail
     */
    getActiveTransport() {
        return this.transportType;
    }
    /**
     * Check if specific transport is active
     * @llm-rule WHEN: Feature detection based on transport capabilities
     * @llm-rule AVOID: Complex transport-specific logic - keep handlers generic
     */
    hasTransport(name) {
        return this.transportType === name;
    }
    /**
     * Get current configuration for debugging
     * @llm-rule WHEN: Debugging configuration or health checks
     * @llm-rule AVOID: Using for runtime decisions - config is set at startup
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get health status of queue system
     * @llm-rule WHEN: Health checks or monitoring
     * @llm-rule AVOID: Frequent health checks - can impact performance
     */
    getHealth() {
        try {
            const transportHealth = this.transport.getHealth();
            return {
                ...transportHealth,
                transport: this.transportType,
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                transport: this.transportType,
                message: `Health check failed: ${error.message}`,
            };
        }
    }
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
    /**
     * Wrap job handler with error handling and retry logic
     */
    wrapHandler(handler) {
        return async (data) => {
            try {
                const result = await handler(data);
                return result;
            }
            catch (error) {
                // Re-throw error for transport to handle retry logic
                throw error;
            }
        };
    }
    /**
     * Wait for active jobs to complete with timeout
     */
    async waitForActiveJobs() {
        const timeout = this.config.worker.gracefulShutdownTimeout;
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const stats = await this.transport.getStats();
                if (stats.active === 0) {
                    return; // No active jobs
                }
                // Wait a bit before checking again
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                // If we can't check stats, just wait the timeout
                break;
            }
        }
        console.warn(`[@bloomneo/appkit/queue] Graceful shutdown timeout (${timeout}ms) exceeded, forcing close`);
    }
    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const handleShutdown = async (signal) => {
            console.log(`[@bloomneo/appkit/queue] Received ${signal}, starting graceful shutdown...`);
            await this.close();
            process.exit(0);
        };
        process.once('SIGTERM', () => handleShutdown('SIGTERM'));
        process.once('SIGINT', () => handleShutdown('SIGINT'));
    }
    // ============================================================================
    // VALIDATION METHODS
    // ============================================================================
    validateJobType(jobType) {
        if (!jobType || typeof jobType !== 'string') {
            throw new Error(`[@bloomneo/appkit/queue] Job type must be a non-empty string. See: ${DOCS_URL}#adding-jobs`);
        }
        if (jobType.length > 100) {
            throw new Error(`[@bloomneo/appkit/queue] Job type must be 100 characters or less. See: ${DOCS_URL}#adding-jobs`);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(jobType)) {
            throw new Error(`[@bloomneo/appkit/queue] Job type can only contain letters, numbers, underscores, and hyphens. See: ${DOCS_URL}#adding-jobs`);
        }
    }
    validateJobData(data) {
        if (data === null || data === undefined) {
            throw new Error(`[@bloomneo/appkit/queue] Job data cannot be null or undefined. See: ${DOCS_URL}#adding-jobs`);
        }
        try {
            JSON.stringify(data);
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/queue] Job data must be JSON serializable. See: ${DOCS_URL}#adding-jobs`);
        }
    }
    validateHandler(handler) {
        if (typeof handler !== 'function') {
            throw new Error(`[@bloomneo/appkit/queue] Job handler must be a function. See: ${DOCS_URL}#processing-jobs`);
        }
    }
    validateDelay(delay) {
        if (typeof delay !== 'number' || delay < 0) {
            throw new Error(`[@bloomneo/appkit/queue] Delay must be a positive number (milliseconds). See: ${DOCS_URL}#scheduling-jobs`);
        }
        if (delay > 365 * 24 * 60 * 60 * 1000) {
            throw new Error(`[@bloomneo/appkit/queue] Delay cannot exceed 1 year. See: ${DOCS_URL}#scheduling-jobs`);
        }
    }
    validateJobId(jobId) {
        if (!jobId || typeof jobId !== 'string') {
            throw new Error(`[@bloomneo/appkit/queue] Job ID must be a non-empty string. See: ${DOCS_URL}#managing-jobs`);
        }
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(jobId)) {
            throw new Error(`[@bloomneo/appkit/queue] Job ID must be a valid UUID. See: ${DOCS_URL}#managing-jobs`);
        }
    }
}
//# sourceMappingURL=queue.js.map