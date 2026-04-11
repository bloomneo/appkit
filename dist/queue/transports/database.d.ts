/**
 * Database queue transport using AppKit Prisma for persistent job storage
 * @module @bloomneo/appkit/queue
 * @file src/queue/transports/database.ts
 *
 * @llm-rule WHEN: Need persistent queuing with existing database - leverages AppKit database
 * @llm-rule AVOID: When high-throughput needed - database polling has overhead
 * @llm-rule NOTE: Uses existing Prisma client from AppKit, perfect for simple persistent queuing
 */
import type { Transport } from '../queue.js';
import type { QueueConfig } from '../defaults.js';
import type { JobData, JobOptions, JobHandler, QueueStats, JobInfo, JobStatus } from '../index.js';
/**
 * Database transport using AppKit Prisma for persistent storage
 */
export declare class DatabaseTransport implements Transport {
    private config;
    private db;
    private handlers;
    private paused;
    private processing;
    private processingLoop;
    private cleanupTimer;
    private healthCheckTimer;
    /**
     * Creates database transport using existing AppKit Prisma client
     * @llm-rule WHEN: Auto-detected from DATABASE_URL with existing AppKit database
     * @llm-rule AVOID: Manual database setup - leverages existing infrastructure
     */
    constructor(config: QueueConfig);
    /**
     * Initialize database transport
     * @llm-rule WHEN: Transport creation - ensures table exists and starts processing
     * @llm-rule AVOID: Calling manually - constructor handles initialization
     */
    private initialize;
    /**
     * Add job to database queue
     * @llm-rule WHEN: Adding jobs for persistent background processing
     * @llm-rule AVOID: Very high frequency - database has transaction overhead
     */
    add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void>;
    /**
     * Register job processor
     * @llm-rule WHEN: Setting up job handlers for database-persisted jobs
     * @llm-rule AVOID: Multiple handlers for same type - causes processing conflicts
     */
    process<T = JobData>(jobType: string, handler: JobHandler<T>): void;
    /**
     * Schedule job for future execution
     * @llm-rule WHEN: Need persistent delayed job execution with database reliability
     * @llm-rule AVOID: Very frequent scheduling - database writes have overhead
     */
    schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void>;
    /**
     * Pause queue processing
     * @llm-rule WHEN: Maintenance mode or controlled processing stop
     * @llm-rule AVOID: Database-wide pausing - affects other application parts
     */
    pause(jobType?: string): Promise<void>;
    /**
     * Resume queue processing
     * @llm-rule WHEN: Resuming after maintenance pause
     * @llm-rule AVOID: Resuming without checking database health
     */
    resume(jobType?: string): Promise<void>;
    /**
     * Get queue statistics from database
     * @llm-rule WHEN: Monitoring queue health and job status distribution
     * @llm-rule AVOID: Frequent polling - database aggregation queries are expensive
     */
    getStats(jobType?: string): Promise<QueueStats>;
    /**
     * Get jobs by status from database
     * @llm-rule WHEN: Debugging failed jobs or monitoring job history
     * @llm-rule AVOID: Large result sets without pagination - database performance impact
     */
    getJobs(status: JobStatus, jobType?: string, limit?: number): Promise<JobInfo[]>;
    /**
     * Retry failed job in database
     * @llm-rule WHEN: Manual retry of failed jobs from admin interface
     * @llm-rule AVOID: Retrying without fixing underlying code issues
     */
    retry(jobId: string): Promise<void>;
    /**
     * Remove job from database
     * @llm-rule WHEN: Canceling scheduled jobs or permanent cleanup
     * @llm-rule AVOID: Removing active jobs - can cause worker inconsistencies
     */
    remove(jobId: string): Promise<void>;
    /**
     * Clean old jobs from database
     * @llm-rule WHEN: Periodic cleanup to prevent database growth
     * @llm-rule AVOID: Aggressive cleanup without considering audit requirements
     */
    clean(status: JobStatus, grace?: number): Promise<void>;
    /**
     * Get database transport health status
     * @llm-rule WHEN: Health checks and monitoring
     * @llm-rule AVOID: Complex health logic - database connection is main indicator
     */
    getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    };
    /**
     * Close database transport and cleanup resources
     * @llm-rule WHEN: App shutdown or testing cleanup
     * @llm-rule AVOID: Closing shared database connection - other parts of app use it
     */
    close(): Promise<void>;
    /**
     * Start background job processing
     */
    private startProcessing;
    /**
     * Main job processing loop
     */
    private processJobs;
    /**
     * Process waiting jobs up to concurrency limit
     */
    private processWaitingJobs;
    /**
     * Process individual job with database state management
     */
    private processJob;
    /**
     * Atomically claim job for processing
     */
    private claimJob;
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
     * Setup periodic cleanup
     */
    private setupCleanup;
    /**
     * Setup periodic health checks
     */
    private setupHealthCheck;
    /**
     * Ensure queue jobs table exists
     */
    private ensureTableExists;
    /**
     * Map JobStatus to database status
     */
    private mapStatusToDb;
    /**
     * Convert database job to JobInfo
     */
    private dbJobToInfo;
}
//# sourceMappingURL=database.d.ts.map