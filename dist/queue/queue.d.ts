/**
 * Core queuing class with automatic transport management and job processing
 * @module @bloomneo/appkit/queue
 * @file src/queue/queue.ts
 *
 * @llm-rule WHEN: Building queue instances - called via queueClass.get(), not directly
 * @llm-rule AVOID: Creating QueueClass directly - always use queueClass.get() for proper setup
 * @llm-rule NOTE: Auto-detects and switches between Memory, Redis, Database transports
 */
import type { QueueConfig } from './defaults.js';
import type { JobData, JobOptions, JobHandler, Queue, QueueStats, JobInfo, JobStatus } from './index.js';
export interface Transport {
    add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void>;
    process(jobType: string, handler: JobHandler<JobData>): void;
    schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void>;
    pause(jobType?: string): Promise<void>;
    resume(jobType?: string): Promise<void>;
    getStats(jobType?: string): Promise<QueueStats>;
    getJobs(status: JobStatus, jobType?: string): Promise<JobInfo[]>;
    retry(jobId: string): Promise<void>;
    remove(jobId: string): Promise<void>;
    clean(status: JobStatus, grace?: number): Promise<void>;
    getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    };
    close(): Promise<void>;
}
/**
 * Core queuing class with automatic transport management
 */
export declare class QueueClass implements Queue {
    private config;
    private transport;
    private transportType;
    private isClosing;
    constructor(config: QueueConfig);
    /**
     * Initialize transport based on configuration
     * @llm-rule WHEN: QueueClass construction - sets up appropriate transport
     * @llm-rule AVOID: Manual transport selection - config determines transport type
     */
    private initializeTransport;
    /**
     * Add job to queue with automatic ID generation and validation
     * @llm-rule WHEN: Adding background jobs for processing
     * @llm-rule AVOID: Direct transport calls - this handles ID generation and validation
     */
    add<T = JobData>(jobType: string, data: T, options?: JobOptions): Promise<string>;
    /**
     * Register job processor for specific job type
     * @llm-rule WHEN: Setting up job handlers for background processing
     * @llm-rule AVOID: Multiple processors for same job type - causes conflicts
     */
    process<T = JobData>(jobType: string, handler: JobHandler<T>): void;
    /**
     * Schedule job for future execution
     * @llm-rule WHEN: Need to delay job execution (reminders, notifications, etc.)
     * @llm-rule AVOID: Using setTimeout - this persists across app restarts
     */
    schedule<T = JobData>(jobType: string, data: T, delay: number): Promise<string>;
    /**
     * Pause queue processing
     * @llm-rule WHEN: Maintenance mode or controlled shutdown
     * @llm-rule AVOID: Pausing without resume plan - jobs will accumulate
     */
    pause(jobType?: string): Promise<void>;
    /**
     * Resume queue processing
     * @llm-rule WHEN: Resuming after maintenance or pause
     * @llm-rule AVOID: Resuming without checking system health
     */
    resume(jobType?: string): Promise<void>;
    /**
     * Get queue statistics for monitoring
     * @llm-rule WHEN: Health checks, monitoring dashboards, debugging
     * @llm-rule AVOID: Frequent polling - can be expensive for some transports
     */
    getStats(jobType?: string): Promise<QueueStats>;
    /**
     * Get jobs by status for debugging and monitoring
     * @llm-rule WHEN: Debugging failed jobs or monitoring queue health
     * @llm-rule AVOID: Getting large result sets - use pagination for big queues
     */
    getJobs(status: JobStatus, jobType?: string): Promise<JobInfo[]>;
    /**
     * Retry failed job by ID
     * @llm-rule WHEN: Manual retry of failed jobs from admin interface
     * @llm-rule AVOID: Retrying jobs that failed due to code errors without fixing code
     */
    retry(jobId: string): Promise<void>;
    /**
     * Remove job from queue
     * @llm-rule WHEN: Canceling scheduled jobs or cleaning up specific jobs
     * @llm-rule AVOID: Removing active jobs - let them complete naturally
     */
    remove(jobId: string): Promise<void>;
    /**
     * Clean old jobs by status
     * @llm-rule WHEN: Periodic cleanup to prevent queue storage growth
     * @llm-rule AVOID: Aggressive cleanup - keep some completed jobs for debugging
     */
    clean(status: JobStatus, grace?: number): Promise<void>;
    /**
     * Gracefully close queue and cleanup resources
     * @llm-rule WHEN: App shutdown or testing cleanup
     * @llm-rule AVOID: Abrupt shutdown - can cause job loss
     */
    close(): Promise<void>;
    /**
     * Get active transport type for debugging
     * @llm-rule WHEN: Debugging transport selection or health checks
     * @llm-rule AVOID: Using for business logic - transport is implementation detail
     */
    getActiveTransport(): string;
    /**
     * Check if specific transport is active
     * @llm-rule WHEN: Feature detection based on transport capabilities
     * @llm-rule AVOID: Complex transport-specific logic - keep handlers generic
     */
    hasTransport(name: string): boolean;
    /**
     * Get current configuration for debugging
     * @llm-rule WHEN: Debugging configuration or health checks
     * @llm-rule AVOID: Using for runtime decisions - config is set at startup
     */
    getConfig(): QueueConfig;
    /**
     * Get health status of queue system
     * @llm-rule WHEN: Health checks or monitoring
     * @llm-rule AVOID: Frequent health checks - can impact performance
     */
    getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        transport: string;
        message?: string;
    };
    /**
     * Wrap job handler with error handling and retry logic
     */
    private wrapHandler;
    /**
     * Wait for active jobs to complete with timeout
     */
    private waitForActiveJobs;
    private validateJobType;
    private validateJobData;
    private validateHandler;
    private validateDelay;
    private validateJobId;
}
//# sourceMappingURL=queue.d.ts.map