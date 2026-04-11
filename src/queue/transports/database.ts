/**
 * Database queue transport using AppKit Prisma for persistent job storage
 * @module @bloomneo/appkit/queue
 * @file src/queue/transports/database.ts
 * 
 * @llm-rule WHEN: Need persistent queuing with existing database - leverages AppKit database
 * @llm-rule AVOID: When high-throughput needed - database polling has overhead
 * @llm-rule NOTE: Uses existing Prisma client from AppKit, perfect for simple persistent queuing
 */

import database  from '../../database/index.js'; // Leverage existing Prisma client
import type { Transport } from '../queue.js';
import type { QueueConfig } from '../defaults.js';
import type { JobData, JobOptions, JobHandler, QueueStats, JobInfo, JobStatus } from '../index.js';

interface DatabaseJob {
  id: string;
  queue: string;
  type: string;
  payload: any;
  result?: any;
  error?: any;
  status: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
  runAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database transport using AppKit Prisma for persistent storage
 */
export class DatabaseTransport implements Transport {
  private config: QueueConfig;
  private db: any;
  private handlers = new Map<string, JobHandler<any>>();
  private paused = new Set<string>();
  private processing = new Set<string>();
  
  // Timers for background processing
  private processingLoop: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  /**
   * Creates database transport using existing AppKit Prisma client
   * @llm-rule WHEN: Auto-detected from DATABASE_URL with existing AppKit database
   * @llm-rule AVOID: Manual database setup - leverages existing infrastructure
   */
  constructor(config: QueueConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize database transport
   * @llm-rule WHEN: Transport creation - ensures table exists and starts processing
   * @llm-rule AVOID: Calling manually - constructor handles initialization
   */
  private async initialize(): Promise<void> {
    try {
      // Get the database client
      this.db = await database.get();
      
      await this.ensureTableExists();
      
      if (this.config.worker.enabled) {
        this.startProcessing();
        this.setupCleanup();
        this.setupHealthCheck();
      }
    } catch (error) {
      console.error('Database transport initialization failed:', (error as Error).message);
    }
  }

  /**
   * Add job to database queue
   * @llm-rule WHEN: Adding jobs for persistent background processing
   * @llm-rule AVOID: Very high frequency - database has transaction overhead
   */
  async add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void> {
    try {
      await this.db.queueJob.create({
        data: {
          id,
          queue: jobType,
          type: jobType,
          payload: data,
          status: 'pending',
          attempts: 0,
          maxAttempts: options.attempts || this.config.maxAttempts,
          priority: options.priority || this.config.defaultPriority,
          runAt: new Date(),
        },
      });
    } catch (error) {
      throw new Error(`Failed to add job to database: ${(error as Error).message}`);
    }
  }

  /**
   * Register job processor
   * @llm-rule WHEN: Setting up job handlers for database-persisted jobs
   * @llm-rule AVOID: Multiple handlers for same type - causes processing conflicts
   */
  process<T = JobData>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, handler as JobHandler<any>);
  }

  /**
   * Schedule job for future execution
   * @llm-rule WHEN: Need persistent delayed job execution with database reliability
   * @llm-rule AVOID: Very frequent scheduling - database writes have overhead
   */
  async schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void> {
    try {
      const runAt = new Date(Date.now() + delay);
      
      await this.db.queueJob.create({
        data: {
          id,
          queue: jobType,
          type: jobType,
          payload: data,
          status: 'pending',
          attempts: 0,
          maxAttempts: this.config.maxAttempts,
          priority: this.config.defaultPriority,
          runAt,
        },
      });
    } catch (error) {
      throw new Error(`Failed to schedule job in database: ${(error as Error).message}`);
    }
  }

  /**
   * Pause queue processing
   * @llm-rule WHEN: Maintenance mode or controlled processing stop
   * @llm-rule AVOID: Database-wide pausing - affects other application parts
   */
  async pause(jobType?: string): Promise<void> {
    if (jobType) {
      this.paused.add(jobType);
    } else {
      // Pause all job types
      for (const type of this.handlers.keys()) {
        this.paused.add(type);
      }
    }
  }

  /**
   * Resume queue processing
   * @llm-rule WHEN: Resuming after maintenance pause
   * @llm-rule AVOID: Resuming without checking database health
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
   * Get queue statistics from database
   * @llm-rule WHEN: Monitoring queue health and job status distribution
   * @llm-rule AVOID: Frequent polling - database aggregation queries are expensive
   */
  async getStats(jobType?: string): Promise<QueueStats> {
    try {
      const where = jobType ? { queue: jobType } : {};
      
      const [
        pending,
        processing,
        completed,
        failed,
      ] = await Promise.all([
        this.db.queueJob.count({ where: { ...where, status: 'pending' } }),
        this.db.queueJob.count({ where: { ...where, status: 'processing' } }),
        this.db.queueJob.count({ where: { ...where, status: 'completed' } }),
        this.db.queueJob.count({ where: { ...where, status: 'failed' } }),
      ]);

      return {
        waiting: pending,
        active: processing,
        completed,
        failed,
        delayed: 0, // Database doesn't distinguish delayed vs pending
        paused: this.paused.size,
      };
      
    } catch (error) {
      throw new Error(`Failed to get database stats: ${(error as Error).message}`);
    }
  }

  /**
   * Get jobs by status from database
   * @llm-rule WHEN: Debugging failed jobs or monitoring job history
   * @llm-rule AVOID: Large result sets without pagination - database performance impact
   */
  async getJobs(status: JobStatus, jobType?: string, limit: number = 100): Promise<JobInfo[]> {
    try {
        // Map JobStatus to database status
        const dbStatus = this.mapStatusToDb(status);
        
        const where: any = { status: dbStatus };
        if (jobType) {
        where.queue = jobType;
        }
        
        const jobs = await this.db.queueJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        });

        return jobs.map((job: any) => this.dbJobToInfo(job));
        
    } catch (error) {
        throw new Error(`Failed to get database jobs: ${(error as Error).message}`);
    }
    }

  /**
   * Retry failed job in database
   * @llm-rule WHEN: Manual retry of failed jobs from admin interface
   * @llm-rule AVOID: Retrying without fixing underlying code issues
   */
  async retry(jobId: string): Promise<void> {
    try {
      const job = await this.db.queueJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status !== 'failed') {
        throw new Error(`Job ${jobId} is not in failed state`);
      }

      // Reset job for retry
      await this.db.queueJob.update({
        where: { id: jobId },
        data: {
          status: 'pending',
          attempts: 0,
          error: null,
          failedAt: null,
          runAt: new Date(),
        },
      });
      
    } catch (error) {
      throw new Error(`Failed to retry database job: ${(error as Error).message}`);
    }
  }

  /**
   * Remove job from database
   * @llm-rule WHEN: Canceling scheduled jobs or permanent cleanup
   * @llm-rule AVOID: Removing active jobs - can cause worker inconsistencies
   */
  async remove(jobId: string): Promise<void> {
    try {
      const job = await this.db.queueJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status === 'processing') {
        throw new Error(`Cannot remove active job ${jobId}`);
      }

      await this.db.queueJob.delete({
        where: { id: jobId },
      });
      
    } catch (error) {
      throw new Error(`Failed to remove database job: ${(error as Error).message}`);
    }
  }

  /**
   * Clean old jobs from database
   * @llm-rule WHEN: Periodic cleanup to prevent database growth
   * @llm-rule AVOID: Aggressive cleanup without considering audit requirements
   */
  async clean(status: JobStatus, grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - grace);
      const dbStatus = this.mapStatusToDb(status);
      
      await this.db.queueJob.deleteMany({
        where: {
          status: dbStatus,
          AND: [
            {
              OR: [
                { completedAt: { lt: cutoff } },
                { failedAt: { lt: cutoff } },
                { 
                  AND: [
                    { completedAt: null },
                    { failedAt: null },
                    { createdAt: { lt: cutoff } }
                  ]
                },
              ],
            },
          ],
        },
      });
      
    } catch (error) {
      throw new Error(`Failed to clean database jobs: ${(error as Error).message}`);
    }
  }

  /**
   * Get database transport health status
   * @llm-rule WHEN: Health checks and monitoring
   * @llm-rule AVOID: Complex health logic - database connection is main indicator
   */
  getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; message?: string } {
    try {
      // Simple check - if we can import db, Prisma connection should be healthy
      // In a real implementation, you might want to do a simple query
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy', message: 'Database connection issues' };
    }
  }

  /**
   * Close database transport and cleanup resources
   * @llm-rule WHEN: App shutdown or testing cleanup
   * @llm-rule AVOID: Closing shared database connection - other parts of app use it
   */
  async close(): Promise<void> {
    // Stop processing loops
    if (this.processingLoop) {
      clearTimeout(this.processingLoop);
      this.processingLoop = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Wait for current jobs to complete
    const timeout = this.config.worker.gracefulShutdownTimeout;
    const startTime = Date.now();

    while (this.processing.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Note: We don't close the database connection as it's shared with the rest of the app
    this.handlers.clear();
    this.paused.clear();
    this.processing.clear();
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Start background job processing
   */
  private startProcessing(): void {
    this.processJobs();
  }

  /**
   * Main job processing loop
   */
  private async processJobs(): Promise<void> {
    try {
      await this.processWaitingJobs();
    } catch (error) {
      console.error('Database processing error:', (error as Error).message);
    }

    // Schedule next processing cycle
    this.processingLoop = setTimeout(() => this.processJobs(), this.config.database.pollInterval);
  }

  /**
   * Process waiting jobs up to concurrency limit
   */
  private async processWaitingJobs(): Promise<void> {
    const concurrency = this.config.concurrency;
    const currentActive = this.processing.size;

    if (currentActive >= concurrency) {
      return;
    }

    try {
      // Get ready jobs ordered by priority and creation time
      const jobs = await this.db.queueJob.findMany({
        where: {
          status: 'pending',
          runAt: { lte: new Date() },
          queue: { in: Array.from(this.handlers.keys()) },
          NOT: { queue: { in: Array.from(this.paused) } },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        take: concurrency - currentActive,
      });

      // Process each job
      for (const job of jobs) {
        const handler = this.handlers.get(job.queue);
        if (handler) {
          this.processJob(job, handler).catch(error => {
            console.error(`Error processing database job ${job.id}:`, error);
          });
        }
      }
      
    } catch (error) {
      console.error('Error fetching waiting jobs:', (error as Error).message);
    }
  }

  /**
   * Process individual job with database state management
   */
  private async processJob(job: DatabaseJob, handler: JobHandler): Promise<void> {
    // Mark as processing
    this.processing.add(job.id);
    
    try {
      // Atomically claim the job (prevents race conditions)
      const claimed = await this.claimJob(job);
      if (!claimed) {
        return; // Job was claimed by another worker
      }
      
      // Execute handler
      const result = await handler(job.payload);
      
      // Job completed successfully
      await this.completeJob(job, result);
      
    } catch (error) {
      // Job failed
      await this.failJob(job, error as Error);
      
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Atomically claim job for processing
   */
  private async claimJob(job: DatabaseJob): Promise<boolean> {
    try {
      const result = await this.db.queueJob.updateMany({
        where: {
          id: job.id,
          status: 'pending', // Only claim if still pending
        },
        data: {
          status: 'processing',
          processedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      
      return result.count > 0;
    } catch (error) {
      console.error(`Error claiming job ${job.id}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Complete job successfully
   */
  private async completeJob(job: DatabaseJob, result: any): Promise<void> {
    try {
      await this.db.queueJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          result: result !== undefined ? result : null,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error completing job ${job.id}:`, (error as Error).message);
    }
  }

  /**
   * Fail job with retry logic
   */
  private async failJob(job: DatabaseJob, error: Error): Promise<void> {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };

      if (job.attempts < job.maxAttempts) {
        // Retry with backoff
        const retryDelay = this.calculateRetryDelay(job);
        
        await this.db.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'pending',
            error: errorData,
            runAt: retryDelay,
          },
        });
      } else {
        // Max attempts reached
        await this.db.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            error: errorData,
            failedAt: new Date(),
          },
        });
      }
    } catch (dbError) {
      console.error(`Error failing job ${job.id}:`, (dbError as Error).message);
    }
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(job: DatabaseJob): Date {
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
    this.cleanupTimer = setInterval(async () => {
      try {
        // Clean completed jobs older than 1 hour
        await this.clean('completed', 60 * 60 * 1000);
        
        // Clean failed jobs older than 24 hours
        await this.clean('failed', 24 * 60 * 60 * 1000);
        
      } catch (error) {
        console.error('Database cleanup error:', (error as Error).message);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Setup periodic health checks
   */
  private setupHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        // Simple health check - count pending jobs
        await this.db.queueJob.count({ where: { status: 'pending' } });
      } catch (error) {
        console.error('Database health check failed:', (error as Error).message);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Ensure queue jobs table exists
   */
  private async ensureTableExists(): Promise<void> {
    // Note: This assumes the QueueJob model is already in the Prisma schema
    // and migrations have been run. In a real implementation, you might want
    // to check if the table exists and provide helpful error messages.
    try {
      await this.db.queueJob.count();
    } catch (error) {
      throw new Error(
        'QueueJob table not found. Please ensure the queue_jobs table exists in your database schema. ' +
        'Add the QueueJob model to your Prisma schema and run migrations.'
      );
    }
  }

  // ============================================================================
  // PRIVATE UTILITY METHODS
  // ============================================================================

  /**
   * Map JobStatus to database status
   */
  private mapStatusToDb(status: JobStatus): string {
    const statusMap: Record<JobStatus, string> = {
      waiting: 'pending',
      active: 'processing',
      completed: 'completed',
      failed: 'failed',
      delayed: 'pending', // Database doesn't distinguish delayed
      paused: 'pending',  // Database doesn't distinguish paused
    };
    
    return statusMap[status] || status;
  }

  /**
   * Convert database job to JobInfo
   */
  private dbJobToInfo(job: any): JobInfo {
    // Map database status back to JobStatus
    const statusMap: Record<string, JobStatus> = {
      pending: 'waiting',
      processing: 'active',
      completed: 'completed',
      failed: 'failed',
    };

    return {
      id: job.id,
      type: job.queue,
      data: job.payload,
      status: statusMap[job.status] || 'waiting' as JobStatus,
      progress: undefined, // Database model doesn't track progress
      attempts: job.attempts,
      maxAttempts: job.maxAttempts || this.config.maxAttempts,
      error: job.error,
      createdAt: job.createdAt,
      processedAt: job.processedAt || undefined,
      completedAt: job.completedAt || undefined,
      failedAt: job.failedAt || undefined,
    };
  }
}