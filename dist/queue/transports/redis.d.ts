/**
 * Redis queue transport for production distributed queuing
 * @module @bloomneo/appkit/queue
 * @file src/queue/transports/redis.ts
 *
 * @llm-rule WHEN: Production environment with REDIS_URL - best for distributed systems
 * @llm-rule AVOID: Development without Redis server - use memory transport instead
 * @llm-rule NOTE: Persistent, distributed, high-performance with Redis data structures
 */
import type { Transport } from '../queue.js';
import type { QueueConfig } from '../defaults.js';
import type { JobData, JobOptions, JobHandler, QueueStats, JobInfo, JobStatus } from '../index.js';
/**
 * Redis transport for production distributed queuing
 */
export declare class RedisTransport implements Transport {
    private config;
    private client;
    private subscriber;
    private connected;
    private handlers;
    private paused;
    private processing;
    private processingLoop;
    private healthCheckTimer;
    private cleanupTimer;
    /**
     * Creates Redis transport with automatic connection management
     * @llm-rule WHEN: Auto-detected from REDIS_URL environment variable
     * @llm-rule AVOID: Manual Redis setup - environment detection handles this
     */
    constructor(config: QueueConfig);
    /**
     * Initialize Redis connection and setup
     * @llm-rule WHEN: Transport creation - establishes Redis connection
     * @llm-rule AVOID: Calling manually - constructor handles initialization
     */
    private initialize;
    /**
     * Add job to Redis queue
     * @llm-rule WHEN: Adding jobs for distributed background processing
     * @llm-rule AVOID: Very large job data - Redis has memory limits
     */
    add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void>;
    /**
     * Register job processor
     * @llm-rule WHEN: Setting up distributed job handlers
     * @llm-rule AVOID: Multiple handlers for same type in same process - causes conflicts
     */
    process<T = JobData>(jobType: string, handler: JobHandler<T>): void;
    /**
     * Schedule job for future execution in Redis
     * @llm-rule WHEN: Need persistent delayed job execution across restarts
     * @llm-rule AVOID: Very distant future dates - Redis memory considerations
     */
    schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void>;
    /**
     * Pause queue processing
     * @llm-rule WHEN: Maintenance mode or controlled processing stop
     * @llm-rule AVOID: Pausing without coordination across workers
     */
    pause(jobType?: string): Promise<void>;
    /**
     * Resume queue processing
     * @llm-rule WHEN: Resuming after maintenance pause
     * @llm-rule AVOID: Resuming without checking system health
     */
    resume(jobType?: string): Promise<void>;
    /**
     * Get queue statistics from Redis
     * @llm-rule WHEN: Monitoring distributed queue health
     * @llm-rule AVOID: Frequent polling - Redis operations have network cost
     */
    getStats(jobType?: string): Promise<QueueStats>;
    /**
     * Get jobs by status from Redis
     * @llm-rule WHEN: Debugging distributed queue issues
     * @llm-rule AVOID: Getting large result sets - use pagination for production
     */
    getJobs(status: JobStatus, jobType?: string, limit?: number): Promise<JobInfo[]>;
    /**
     * Retry failed job in Redis
     * @llm-rule WHEN: Manual retry of failed distributed jobs
     * @llm-rule AVOID: Retrying without fixing underlying issues
     */
    retry(jobId: string): Promise<void>;
    /**
     * Remove job from Redis
     * @llm-rule WHEN: Canceling scheduled jobs or cleanup
     * @llm-rule AVOID: Removing active jobs - can cause worker inconsistencies
     */
    remove(jobId: string): Promise<void>;
    /**
     * Clean old jobs from Redis
     * @llm-rule WHEN: Periodic cleanup to prevent Redis memory growth
     * @llm-rule AVOID: Aggressive cleanup without considering debugging needs
     */
    clean(status: JobStatus, grace?: number): Promise<void>;
    /**
     * Get Redis transport health status
     * @llm-rule WHEN: Health checks and monitoring
     * @llm-rule AVOID: Complex health logic - Redis connection is main indicator
     */
    getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    };
    /**
     * Close Redis transport and cleanup connections
     * @llm-rule WHEN: App shutdown or testing cleanup
     * @llm-rule AVOID: Abrupt close - finish processing current jobs first
     */
    close(): Promise<void>;
    /**
     * Connect to Redis with automatic retries
     */
    private connect;
    /**
     * Setup Redis data structures and indexes
     */
    private setupRedisStructures;
    /**
     * Start background job processing
     */
    private startProcessing;
    /**
     * Main job processing loop
     */
    private processJobs;
    /**
     * Promote delayed jobs that are ready to run
     */
    private promoteDelayedJobs;
    /**
     * Promote single delayed job to waiting
     */
    private promoteJob;
    /**
     * Process waiting jobs up to concurrency limit
     */
    private processWaitingJobs;
    /**
     * Process jobs for specific job type
     */
    private processJobType;
    /**
     * Process individual job with Redis state management
     */
    private processJob;
    /**
     * Move job to active queue
     */
    private moveJobToActive;
    /**
     * Complete job successfully
     */
    private completeJob;
    /**
     * Fail job with retry logic
     */
    private failJob;
    /**
     * Calculate retry delay with backoff
     */
    private calculateRetryDelay;
    /**
     * Subscribe to job notifications for a job type
     */
    private subscribeToJobType;
    /**
     * Setup periodic health checks
     */
    private setupHealthCheck;
    /**
     * Setup periodic cleanup
     */
    private setupCleanup;
    /**
     * Get Redis key for job data
     */
    private getJobKey;
    /**
     * Get Redis key for specific queue
     */
    private getQueueKey;
    /**
     * Get Redis key for global queues
     */
    private getGlobalKey;
    /**
     * Get Redis key for job notifications
     */
    private getNotificationKey;
    /**
     * Get job data from Redis
     */
    private getJobData;
    /**
     * Convert RedisJob to JobInfo
     */
    private redisJobToInfo;
}
//# sourceMappingURL=redis.d.ts.map