/**
 * In-memory queue transport for development and testing
 * @module @bloomneo/appkit/queue
 * @file src/queue/transports/memory.ts
 *
 * @llm-rule WHEN: Development mode or when no Redis/Database available
 * @llm-rule AVOID: Production use - jobs lost on restart, no persistence
 * @llm-rule NOTE: Perfect for development and testing - fast, simple, no external dependencies
 */
import type { Transport } from '../queue.js';
import type { QueueConfig } from '../defaults.js';
import type { JobData, JobOptions, JobHandler, QueueStats, JobInfo, JobStatus } from '../index.js';
/**
 * In-memory transport for development and testing
 */
export declare class MemoryTransport implements Transport {
    private config;
    private jobs;
    private handlers;
    private paused;
    private processing;
    private schedulerTimer;
    private cleanupTimer;
    private processingLoop;
    /**
     * Creates memory transport with direct config access (like logging pattern)
     * @llm-rule WHEN: Auto-detected as fallback or explicitly configured for development
     * @llm-rule AVOID: Manual memory transport creation - use queuing.get() instead
     */
    constructor(config: QueueConfig);
    /**
     * Add job to memory queue
     * @llm-rule WHEN: Adding jobs for background processing
     * @llm-rule AVOID: Adding too many jobs - memory transport has limits
     */
    add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void>;
    /**
     * Register job processor
     * @llm-rule WHEN: Setting up job handlers for specific job types
     * @llm-rule AVOID: Multiple handlers for same type - overwrites previous handler
     */
    process<T = JobData>(jobType: string, handler: JobHandler<T>): void;
    /**
     * Schedule job for future execution
     * @llm-rule WHEN: Need delayed job execution (reminders, scheduled tasks)
     * @llm-rule AVOID: Very long delays - memory transport resets on restart
     */
    schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void>;
    /**
     * Pause queue processing
     * @llm-rule WHEN: Maintenance mode or controlled processing stop
     * @llm-rule AVOID: Pausing without resume - jobs accumulate in memory
     */
    pause(jobType?: string): Promise<void>;
    /**
     * Resume queue processing
     * @llm-rule WHEN: Resuming after maintenance pause
     * @llm-rule AVOID: Resuming without checking system capacity
     */
    resume(jobType?: string): Promise<void>;
    /**
     * Get queue statistics
     * @llm-rule WHEN: Monitoring queue health and performance
     * @llm-rule AVOID: Frequent polling - can be expensive with many jobs
     */
    getStats(jobType?: string): Promise<QueueStats>;
    /**
     * Get jobs by status
     * @llm-rule WHEN: Debugging failed jobs or monitoring specific job states
     * @llm-rule AVOID: Getting all jobs frequently - can impact memory performance
     */
    getJobs(status: JobStatus, jobType?: string): Promise<JobInfo[]>;
    /**
     * Retry failed job
     * @llm-rule WHEN: Manual retry of failed jobs
     * @llm-rule AVOID: Retrying jobs that will fail again without fixing root cause
     */
    retry(jobId: string): Promise<void>;
    /**
     * Remove job from queue
     * @llm-rule WHEN: Canceling scheduled jobs or cleanup
     * @llm-rule AVOID: Removing active jobs - can cause inconsistent state
     */
    remove(jobId: string): Promise<void>;
    /**
     * Clean old jobs by status
     * @llm-rule WHEN: Periodic cleanup to prevent memory growth
     * @llm-rule AVOID: Aggressive cleanup - keep some jobs for debugging
     */
    clean(status: JobStatus, grace?: number): Promise<void>;
    /**
     * Get transport health status
     * @llm-rule WHEN: Health checks and monitoring
     * @llm-rule AVOID: Complex health logic - memory transport is simple
     */
    getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    };
    /**
     * Close transport and cleanup resources
     * @llm-rule WHEN: App shutdown or testing cleanup
     * @llm-rule AVOID: Abrupt close - finish processing current jobs first
     */
    close(): Promise<void>;
    /**
     * Start background processing loop
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
     * Process waiting jobs up to concurrency limit
     */
    private processWaitingJobs;
    /**
     * Process individual job
     */
    private processJob;
    /**
     * Calculate retry delay with backoff
     */
    private calculateRetryDelay;
    /**
     * Setup periodic cleanup
     */
    private setupCleanup;
    /**
     * Perform automatic cleanup
     */
    private performCleanup;
    /**
     * Convert MemoryJob to JobInfo
     */
    private jobToInfo;
}
//# sourceMappingURL=memory.d.ts.map