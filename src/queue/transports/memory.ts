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

interface MemoryJob {
  id: string;
  type: string;
  data: JobData;
  options: JobOptions;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: any;
  progress?: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  runAt: Date;
}

/**
 * In-memory transport for development and testing
 */
export class MemoryTransport implements Transport {
  private config: QueueConfig;
  private jobs = new Map<string, MemoryJob>();
  private handlers = new Map<string, JobHandler<any>>();
  private paused = new Set<string>();
  private processing = new Set<string>();
  
  // Timers for scheduling and cleanup
  private schedulerTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private processingLoop: NodeJS.Timeout | null = null;

  /**
   * Creates memory transport with direct config access (like logging pattern)
   * @llm-rule WHEN: Auto-detected as fallback or explicitly configured for development
   * @llm-rule AVOID: Manual memory transport creation - use queuing.get() instead
   */
  constructor(config: QueueConfig) {
    this.config = config;
    
    // Start processing loops if worker enabled
    if (config.worker.enabled) {
      this.startProcessing();
      this.setupCleanup();
    }
  }

  /**
   * Add job to memory queue
   * @llm-rule WHEN: Adding jobs for background processing
   * @llm-rule AVOID: Adding too many jobs - memory transport has limits
   */
  async add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void> {
    // Check memory limits
    if (this.jobs.size >= this.config.memory.maxJobs) {
      throw new Error(`Memory queue full (${this.config.memory.maxJobs} jobs)`);
    }

    const job: MemoryJob = {
      id,
      type: jobType,
      data,
      options,
      status: 'waiting',
      attempts: 0,
      maxAttempts: options.attempts || this.config.maxAttempts,
      createdAt: new Date(),
      runAt: new Date(),
    };

    this.jobs.set(id, job);
  }

  /**
   * Register job processor
   * @llm-rule WHEN: Setting up job handlers for specific job types
   * @llm-rule AVOID: Multiple handlers for same type - overwrites previous handler
   */
  process<T = JobData>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, handler as JobHandler<any>);
  }

  /**
   * Schedule job for future execution
   * @llm-rule WHEN: Need delayed job execution (reminders, scheduled tasks)
   * @llm-rule AVOID: Very long delays - memory transport resets on restart
   */
  async schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void> {
    // Check memory limits
    if (this.jobs.size >= this.config.memory.maxJobs) {
      throw new Error(`Memory queue full (${this.config.memory.maxJobs} jobs)`);
    }

    const job: MemoryJob = {
      id,
      type: jobType,
      data,
      options: { attempts: this.config.maxAttempts },
      status: 'delayed',
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: new Date(),
      runAt: new Date(Date.now() + delay),
    };

    this.jobs.set(id, job);
  }

  /**
   * Pause queue processing
   * @llm-rule WHEN: Maintenance mode or controlled processing stop
   * @llm-rule AVOID: Pausing without resume - jobs accumulate in memory
   */
  async pause(jobType?: string): Promise<void> {
    if (jobType) {
      this.paused.add(jobType);
    } else {
      // Pause all by clearing handlers temporarily
      for (const type of this.handlers.keys()) {
        this.paused.add(type);
      }
    }
  }

  /**
   * Resume queue processing
   * @llm-rule WHEN: Resuming after maintenance pause
   * @llm-rule AVOID: Resuming without checking system capacity
   */
  async resume(jobType?: string): Promise<void> {
    if (jobType) {
      this.paused.delete(jobType);
    } else {
      // Resume all
      this.paused.clear();
    }
  }

  /**
   * Get queue statistics
   * @llm-rule WHEN: Monitoring queue health and performance
   * @llm-rule AVOID: Frequent polling - can be expensive with many jobs
   */
  async getStats(jobType?: string): Promise<QueueStats> {
    const filteredJobs = Array.from(this.jobs.values()).filter(
      job => !jobType || job.type === jobType
    );

    return {
      waiting: filteredJobs.filter(job => job.status === 'waiting').length,
      active: filteredJobs.filter(job => job.status === 'active').length,
      completed: filteredJobs.filter(job => job.status === 'completed').length,
      failed: filteredJobs.filter(job => job.status === 'failed').length,
      delayed: filteredJobs.filter(job => job.status === 'delayed').length,
      paused: this.paused.size,
    };
  }

  /**
   * Get jobs by status
   * @llm-rule WHEN: Debugging failed jobs or monitoring specific job states
   * @llm-rule AVOID: Getting all jobs frequently - can impact memory performance
   */
  async getJobs(status: JobStatus, jobType?: string): Promise<JobInfo[]> {
    return Array.from(this.jobs.values())
      .filter(job => {
        const statusMatch = job.status === status;
        const typeMatch = !jobType || job.type === jobType;
        return statusMatch && typeMatch;
      })
      .map(job => this.jobToInfo(job))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  /**
   * Retry failed job
   * @llm-rule WHEN: Manual retry of failed jobs
   * @llm-rule AVOID: Retrying jobs that will fail again without fixing root cause
   */
  async retry(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    // Reset for retry
    job.status = 'waiting';
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    job.runAt = new Date();
  }

  /**
   * Remove job from queue
   * @llm-rule WHEN: Canceling scheduled jobs or cleanup
   * @llm-rule AVOID: Removing active jobs - can cause inconsistent state
   */
  async remove(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'active') {
      throw new Error(`Cannot remove active job ${jobId}`);
    }

    this.jobs.delete(jobId);
  }

  /**
   * Clean old jobs by status
   * @llm-rule WHEN: Periodic cleanup to prevent memory growth
   * @llm-rule AVOID: Aggressive cleanup - keep some jobs for debugging
   */
  async clean(status: JobStatus, grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = new Date(Date.now() - grace);
    const toDelete: string[] = [];

    for (const [id, job] of this.jobs) {
      if (job.status === status) {
        const jobDate = job.completedAt || job.failedAt || job.createdAt;
        if (jobDate < cutoff) {
          toDelete.push(id);
        }
      }
    }

    for (const id of toDelete) {
      this.jobs.delete(id);
    }
  }

  /**
   * Get transport health status
   * @llm-rule WHEN: Health checks and monitoring
   * @llm-rule AVOID: Complex health logic - memory transport is simple
   */
  getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; message?: string } {
    const jobCount = this.jobs.size;
    const maxJobs = this.config.memory.maxJobs;

    if (jobCount >= maxJobs) {
      return { status: 'unhealthy', message: 'Memory queue full' };
    }

    if (jobCount >= maxJobs * 0.8) {
      return { status: 'degraded', message: 'Memory queue nearly full' };
    }

    return { status: 'healthy' };
  }

  /**
   * Close transport and cleanup resources
   * @llm-rule WHEN: App shutdown or testing cleanup
   * @llm-rule AVOID: Abrupt close - finish processing current jobs first
   */
  async close(): Promise<void> {
    // Stop all timers
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.processingLoop) {
      clearTimeout(this.processingLoop);
      this.processingLoop = null;
    }

    // Wait for current jobs to complete (with timeout)
    const timeout = this.config.worker.gracefulShutdownTimeout;
    const startTime = Date.now();

    while (this.processing.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear all data
    this.jobs.clear();
    this.handlers.clear();
    this.paused.clear();
    this.processing.clear();
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Start background processing loop
   */
  private startProcessing(): void {
    this.processJobs();
  }

  /**
   * Main job processing loop
   */
  private async processJobs(): Promise<void> {
    try {
      // Move delayed jobs to waiting if ready
      this.promoteDelayedJobs();

      // Process waiting jobs
      await this.processWaitingJobs();
    } catch (error) {
      console.error('Memory transport processing error:', (error as Error).message);
    }

    // Schedule next processing cycle
    this.processingLoop = setTimeout(() => this.processJobs(), 1000);
  }

  /**
   * Promote delayed jobs that are ready to run
   */
  private promoteDelayedJobs(): void {
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (job.status === 'delayed' && job.runAt <= now) {
        job.status = 'waiting';
      }
    }
  }

  /**
   * Process waiting jobs up to concurrency limit
   */
  private async processWaitingJobs(): Promise<void> {
    const concurrency = this.config.concurrency;
    const currentActive = this.processing.size;

    if (currentActive >= concurrency) {
      return; // At capacity
    }

    // Get waiting jobs sorted by priority
    const waitingJobs = Array.from(this.jobs.values())
      .filter(job => {
        const isWaiting = job.status === 'waiting';
        const hasHandler = this.handlers.has(job.type);
        const notPaused = !this.paused.has(job.type);
        return isWaiting && hasHandler && notPaused;
      })
      .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    // Process jobs up to concurrency limit
    const toProcess = waitingJobs.slice(0, concurrency - currentActive);

    for (const job of toProcess) {
      this.processJob(job).catch(error => {
        console.error(`Error processing job ${job.id}:`, error);
      });
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: MemoryJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      return; // No handler available
    }

    // Mark as processing
    this.processing.add(job.id);
    job.status = 'active';
    job.processedAt = new Date();
    job.attempts++;

    try {
      // Execute job handler
      const result = await handler(job.data);

      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date();

      // Store result if needed
      if (result !== undefined) {
        (job as any).result = result;
      }

    } catch (error) {
      // Job failed
      job.error = {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name,
      };

      if (job.attempts < job.maxAttempts) {
        // Retry with backoff
        job.status = 'waiting';
        job.runAt = this.calculateRetryDelay(job);
      } else {
        // Max attempts reached
        job.status = 'failed';
        job.failedAt = new Date();
      }
    } finally {
      // Remove from processing set
      this.processing.delete(job.id);
    }
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(job: MemoryJob): Date {
    const baseDelay = this.config.retryDelay;
    let delay = baseDelay;

    if (this.config.retryBackoff === 'exponential') {
      delay = baseDelay * Math.pow(2, job.attempts - 1);
    }

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    delay += jitter;

    return new Date(Date.now() + delay);
  }

  /**
   * Setup periodic cleanup
   */
  private setupCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('Memory transport cleanup error:', error);
      });
    }, this.config.memory.cleanupInterval);
  }

  /**
   * Perform automatic cleanup
   */
  private async performCleanup(): Promise<void> {
    // Clean completed jobs older than 1 hour
    await this.clean('completed', 60 * 60 * 1000);

    // Clean failed jobs older than 24 hours
    await this.clean('failed', 24 * 60 * 60 * 1000);
  }

  /**
   * Convert MemoryJob to JobInfo
   */
  private jobToInfo(job: MemoryJob): JobInfo {
    return {
      id: job.id,
      type: job.type,
      data: job.data,
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
      createdAt: job.createdAt,
      processedAt: job.processedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    };
  }
}