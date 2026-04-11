/**
 * Ultra-simple job queuing that just works with automatic transport detection
 * @module @bloomneo/appkit/queue
 * @file src/queue/index.ts
 *
 * @llm-rule WHEN: Building apps that need background job processing
 * @llm-rule AVOID: Complex queue setups with multiple libraries - this handles everything automatically
 * @llm-rule NOTE: Uses queueClass.get() pattern like other modules - get() → queue.add() → queue.process() → done
 * @llm-rule NOTE: Auto-detects transports: Memory (dev) → Redis (REDIS_URL) → Database (DATABASE_URL)
 * @llm-rule NOTE: Common pattern - queueClass.get() → queue.add() → queue.process() → automatic retry + dead letter queue
 */
import { type QueueConfig } from './defaults.js';
export interface JobData {
    [key: string]: any;
}
export interface JobOptions {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: 'fixed' | 'exponential';
    removeOnComplete?: number;
    removeOnFail?: number;
}
export interface JobHandler<T = JobData> {
    (data: T): Promise<any> | any;
}
export interface Queue {
    add<T = JobData>(jobType: string, data: T, options?: JobOptions): Promise<string>;
    process<T = JobData>(jobType: string, handler: JobHandler<T>): void;
    schedule<T = JobData>(jobType: string, data: T, delay: number): Promise<string>;
    pause(jobType?: string): Promise<void>;
    resume(jobType?: string): Promise<void>;
    getStats(jobType?: string): Promise<QueueStats>;
    getJobs(status: JobStatus, jobType?: string): Promise<JobInfo[]>;
    retry(jobId: string): Promise<void>;
    remove(jobId: string): Promise<void>;
    clean(status: JobStatus, grace?: number): Promise<void>;
    close(): Promise<void>;
}
export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}
export interface JobInfo {
    id: string;
    type: string;
    data: JobData;
    status: JobStatus;
    progress?: number;
    attempts: number;
    maxAttempts: number;
    error?: any;
    createdAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
}
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
/**
 * Get queuing instance - the only function you need to learn
 * Transport auto-detection: Memory → Redis → Database based on environment
 * @llm-rule WHEN: Starting any background job operation - this is your main entry point
 * @llm-rule AVOID: Creating QueueClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → queue.add() → queue.process() → automatic handling
 */
declare function get(overrides?: Partial<QueueConfig>): Queue;
/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing queuing logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<QueueConfig>): Queue;
/**
 * Get active transport type for debugging
 * @llm-rule WHEN: Need to see which transport is running (memory, redis, database)
 * @llm-rule AVOID: Using for business logic - this is for debugging only
 */
declare function getActiveTransport(): string;
/**
 * Check if specific transport is active
 * @llm-rule WHEN: Conditionally handling jobs based on transport capability
 * @llm-rule AVOID: Complex transport detection - just add jobs normally, transports auto-handle
 */
declare function hasTransport(name: string): boolean;
/**
 * Get current configuration for debugging
 * @llm-rule WHEN: Debugging queuing setup or checking environment detection
 * @llm-rule AVOID: Using for runtime decisions - configuration is set at startup
 */
declare function getConfig(): QueueConfig | null;
/**
 * Clear all queues and close transports - essential for testing
 * @llm-rule WHEN: Testing queuing logic or app shutdown
 * @llm-rule AVOID: Using in production without graceful shutdown
 */
declare function clear(): Promise<void>;
/**
 * Get health status of queuing system
 * @llm-rule WHEN: Health checks or monitoring dashboard
 * @llm-rule AVOID: Frequent polling - expensive operation for some transports
 */
declare function getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    transport: string;
    message?: string;
};
/**
 * Single queuing export with minimal functionality (like auth module)
 */
export declare const queueClass: {
    readonly get: typeof get;
    readonly reset: typeof reset;
    readonly clear: typeof clear;
    readonly getActiveTransport: typeof getActiveTransport;
    readonly hasTransport: typeof hasTransport;
    readonly getConfig: typeof getConfig;
    readonly getHealth: typeof getHealth;
};
export {};
//# sourceMappingURL=index.d.ts.map