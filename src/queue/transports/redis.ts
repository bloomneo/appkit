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
import Redis from 'ioredis';

interface RedisJob {
  id: string;
  type: string;
  data: JobData;
  options: JobOptions;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: any;
  result?: any;
  progress?: number;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  failedAt?: string;
  runAt: string;
}

/**
 * Redis transport for production distributed queuing
 */
export class RedisTransport implements Transport {
  private config: QueueConfig;
  private client: any = null;
  private subscriber: any = null;
  private connected = false;
  private handlers = new Map<string, JobHandler<any>>();
  private paused = new Set<string>();
  private processing = new Set<string>();
  
  // Timers for background processing
  private processingLoop: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Creates Redis transport with automatic connection management
   * @llm-rule WHEN: Auto-detected from REDIS_URL environment variable
   * @llm-rule AVOID: Manual Redis setup - environment detection handles this
   */
  constructor(config: QueueConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize Redis connection and setup
   * @llm-rule WHEN: Transport creation - establishes Redis connection
   * @llm-rule AVOID: Calling manually - constructor handles initialization
   */
  private async initialize(): Promise<void> {
    try {
      await this.connect();
      await this.setupRedisStructures();
      
      if (this.config.worker.enabled) {
        this.startProcessing();
        this.setupCleanup();
        this.setupHealthCheck();
      }
    } catch (error) {
      console.error('Redis transport initialization failed:', (error as Error).message);
    }
  }

  /**
   * Add job to Redis queue
   * @llm-rule WHEN: Adding jobs for distributed background processing
   * @llm-rule AVOID: Very large job data - Redis has memory limits
   */
  async add(id: string, jobType: string, data: JobData, options: JobOptions): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const job: RedisJob = {
      id,
      type: jobType,
      data,
      options,
      status: 'waiting',
      attempts: 0,
      maxAttempts: options.attempts || this.config.maxAttempts,
      createdAt: new Date().toISOString(),
      runAt: new Date().toISOString(),
    };

    const jobKey = this.getJobKey(id);
    const queueKey = this.getQueueKey(jobType, 'waiting');
    const priority = options.priority || this.config.defaultPriority;

    try {
      // Use Redis transaction for atomicity
      const multi = this.client.multi();
      
      // Store job data
      multi.hset(jobKey, 'data', JSON.stringify(job));
      
      // Add to priority queue (sorted set)
      multi.zadd(queueKey, priority, id);
      
      // Add to global job set for tracking
      multi.sadd(this.getGlobalKey('jobs'), id);
      
      // Execute transaction
      await multi.exec();
      
      // Notify workers of new job
      await this.client.publish(this.getNotificationKey(jobType), id);
      
    } catch (error) {
      throw new Error(`Failed to add job to Redis: ${(error as Error).message}`);
    }
  }

  /**
   * Register job processor
   * @llm-rule WHEN: Setting up distributed job handlers
   * @llm-rule AVOID: Multiple handlers for same type in same process - causes conflicts
   */
  process<T = JobData>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, handler as JobHandler<any>);
    
    // Subscribe to job notifications for this type
    if (this.connected && this.config.worker.enabled) {
      this.subscribeToJobType(jobType);
    }
  }

  /**
   * Schedule job for future execution in Redis
   * @llm-rule WHEN: Need persistent delayed job execution across restarts
   * @llm-rule AVOID: Very distant future dates - Redis memory considerations
   */
  async schedule(id: string, jobType: string, data: JobData, delay: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const runAt = new Date(Date.now() + delay);
    const job: RedisJob = {
      id,
      type: jobType,
      data,
      options: { attempts: this.config.maxAttempts },
      status: 'delayed',
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: new Date().toISOString(),
      runAt: runAt.toISOString(),
    };

    const jobKey = this.getJobKey(id);
    const delayedKey = this.getGlobalKey('delayed');

    try {
      const multi = this.client.multi();
      
      // Store job data
      multi.hset(jobKey, 'data', JSON.stringify(job));
      
      // Add to delayed jobs sorted set (score = timestamp)
      multi.zadd(delayedKey, runAt.getTime(), id);
      
      // Add to global job set
      multi.sadd(this.getGlobalKey('jobs'), id);
      
      await multi.exec();
      
    } catch (error) {
      throw new Error(`Failed to schedule job in Redis: ${(error as Error).message}`);
    }
  }

  /**
   * Pause queue processing
   * @llm-rule WHEN: Maintenance mode or controlled processing stop
   * @llm-rule AVOID: Pausing without coordination across workers
   */
  async pause(jobType?: string): Promise<void> {
    if (jobType) {
      this.paused.add(jobType);
      // Store pause state in Redis for coordination
      await this.client.sadd(this.getGlobalKey('paused'), jobType);
    } else {
      // Pause all by setting global pause flag
      await this.client.set(this.getGlobalKey('paused:all'), '1');
    }
  }

  /**
   * Resume queue processing
   * @llm-rule WHEN: Resuming after maintenance pause
   * @llm-rule AVOID: Resuming without checking system health
   */
  async resume(jobType?: string): Promise<void> {
    if (jobType) {
      this.paused.delete(jobType);
      await this.client.srem(this.getGlobalKey('paused'), jobType);
    } else {
      // Resume all
      this.paused.clear();
      await this.client.del(this.getGlobalKey('paused:all'));
    }
  }

  /**
   * Get queue statistics from Redis
   * @llm-rule WHEN: Monitoring distributed queue health
   * @llm-rule AVOID: Frequent polling - Redis operations have network cost
   */
  async getStats(jobType?: string): Promise<QueueStats> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const multi = this.client.multi();
      
      if (jobType) {
        // Stats for specific job type
        multi.zcard(this.getQueueKey(jobType, 'waiting'));
        multi.zcard(this.getQueueKey(jobType, 'active'));
        multi.zcard(this.getQueueKey(jobType, 'completed'));
        multi.zcard(this.getQueueKey(jobType, 'failed'));
      } else {
        // Global stats across all job types
        multi.zcard(this.getGlobalKey('waiting'));
        multi.zcard(this.getGlobalKey('active'));
        multi.zcard(this.getGlobalKey('completed'));
        multi.zcard(this.getGlobalKey('failed'));
      }
      
      multi.zcard(this.getGlobalKey('delayed'));
      multi.scard(this.getGlobalKey('paused'));
      
      const results = await multi.exec();
      
      return {
        waiting: results[0][1] || 0,
        active: results[1][1] || 0,
        completed: results[2][1] || 0,
        failed: results[3][1] || 0,
        delayed: results[4][1] || 0,
        paused: results[5][1] || 0,
      };
      
    } catch (error) {
      throw new Error(`Failed to get Redis stats: ${(error as Error).message}`);
    }
  }

  /**
   * Get jobs by status from Redis
   * @llm-rule WHEN: Debugging distributed queue issues
   * @llm-rule AVOID: Getting large result sets - use pagination for production
   */
  async getJobs(status: JobStatus, jobType?: string, limit: number = 100): Promise<JobInfo[]> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const queueKey = jobType 
        ? this.getQueueKey(jobType, status)
        : this.getGlobalKey(status);
      
      // Get job IDs from sorted set (newest first)
      const jobIds = await this.client.zrevrange(queueKey, 0, limit - 1);
      
      if (jobIds.length === 0) {
        return [];
      }
      
      // Get job data for all IDs
      const jobs: JobInfo[] = [];
      for (const id of jobIds) {
        const jobData = await this.getJobData(id);
        if (jobData) {
          jobs.push(this.redisJobToInfo(jobData));
        }
      }
      
      return jobs;
      
    } catch (error) {
      throw new Error(`Failed to get Redis jobs: ${(error as Error).message}`);
    }
  }

  /**
   * Retry failed job in Redis
   * @llm-rule WHEN: Manual retry of failed distributed jobs
   * @llm-rule AVOID: Retrying without fixing underlying issues
   */
  async retry(jobId: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const job = await this.getJobData(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status !== 'failed') {
        throw new Error(`Job ${jobId} is not in failed state`);
      }

      // Reset job for retry
      job.status = 'waiting';
      job.attempts = 0;
      job.error = undefined;
      job.failedAt = undefined;
      job.runAt = new Date().toISOString();

      const multi = this.client.multi();
      
      // Update job data
      multi.hset(this.getJobKey(jobId), 'data', JSON.stringify(job));
      
      // Move from failed to waiting queue
      multi.zrem(this.getQueueKey(job.type, 'failed'), jobId);
      multi.zadd(this.getQueueKey(job.type, 'waiting'), job.options.priority || 0, jobId);
      
      await multi.exec();
      
      // Notify workers
      await this.client.publish(this.getNotificationKey(job.type), jobId);
      
    } catch (error) {
      throw new Error(`Failed to retry Redis job: ${(error as Error).message}`);
    }
  }

  /**
   * Remove job from Redis
   * @llm-rule WHEN: Canceling scheduled jobs or cleanup
   * @llm-rule AVOID: Removing active jobs - can cause worker inconsistencies
   */
  async remove(jobId: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const job = await this.getJobData(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status === 'active') {
        throw new Error(`Cannot remove active job ${jobId}`);
      }

      const multi = this.client.multi();
      
      // Remove job data
      multi.del(this.getJobKey(jobId));
      
      // Remove from all possible queues
      multi.zrem(this.getQueueKey(job.type, job.status), jobId);
      multi.zrem(this.getGlobalKey('delayed'), jobId);
      multi.srem(this.getGlobalKey('jobs'), jobId);
      
      await multi.exec();
      
    } catch (error) {
      throw new Error(`Failed to remove Redis job: ${(error as Error).message}`);
    }
  }

  /**
   * Clean old jobs from Redis
   * @llm-rule WHEN: Periodic cleanup to prevent Redis memory growth
   * @llm-rule AVOID: Aggressive cleanup without considering debugging needs
   */
  async clean(status: JobStatus, grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const cutoff = Date.now() - grace;
      const queueKey = this.getGlobalKey(status);
      
      // Get old job IDs
      const oldJobIds = await this.client.zrangebyscore(queueKey, 0, cutoff);
      
      if (oldJobIds.length === 0) {
        return;
      }
      
      const multi = this.client.multi();
      
      // Remove old jobs
      for (const jobId of oldJobIds) {
        multi.del(this.getJobKey(jobId));
        multi.zrem(queueKey, jobId);
        multi.srem(this.getGlobalKey('jobs'), jobId);
      }
      
      await multi.exec();
      
    } catch (error) {
      throw new Error(`Failed to clean Redis jobs: ${(error as Error).message}`);
    }
  }

  /**
   * Get Redis transport health status
   * @llm-rule WHEN: Health checks and monitoring
   * @llm-rule AVOID: Complex health logic - Redis connection is main indicator
   */
  getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; message?: string } {
    if (!this.connected) {
      return { status: 'unhealthy', message: 'Redis not connected' };
    }

    try {
      // Check if Redis is responsive (this will throw if connection issues)
      this.client.ping();
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'degraded', message: 'Redis connection issues' };
    }
  }

  /**
   * Close Redis transport and cleanup connections
   * @llm-rule WHEN: App shutdown or testing cleanup
   * @llm-rule AVOID: Abrupt close - finish processing current jobs first
   */
  async close(): Promise<void> {
    // Stop processing loops
    if (this.processingLoop) {
      clearTimeout(this.processingLoop);
      this.processingLoop = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Wait for current jobs to complete
    const timeout = this.config.worker.gracefulShutdownTimeout;
    const startTime = Date.now();

    while (this.processing.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Close Redis connections
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.client) {
        await this.client.quit();
      }
    } catch (error) {
      console.error('Error closing Redis connections:', (error as Error).message);
    }

    this.connected = false;
    this.handlers.clear();
    this.paused.clear();
    this.processing.clear();
  }

  // ============================================================================
  // PRIVATE REDIS CONNECTION METHODS
  // ============================================================================

  /**
   * Connect to Redis with automatic retries
   */
  private async connect(): Promise<void> {
    try {
      // Dynamic import of Redis client - handle both CommonJS and ES modules
      const ioredis = await import('ioredis');
      const Redis = ioredis.default || ioredis;
      
      const redisOptions = {
        connectTimeout: 10000,
        retryDelayOnFailover: this.config.redis.retryDelayOnFailover,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
        keyPrefix: this.config.redis.keyPrefix + ':',
      };

      // Use type assertion to bypass TypeScript constructor checking
      this.client = new (Redis as any)(this.config.redis.url!, redisOptions);
      this.subscriber = new (Redis as any)(this.config.redis.url!, redisOptions);

      // Wait for connection
      await this.client.ping();
      await this.subscriber.ping();
      
      this.connected = true;
      console.log('Redis transport connected successfully');
      
    } catch (error) {
      this.connected = false;
      throw new Error(`Redis connection failed: ${(error as Error).message}`);
    }
  }
  /**
   * Setup Redis data structures and indexes
   */
  private async setupRedisStructures(): Promise<void> {
    // Redis structures are created on demand
    // No explicit setup needed for basic operations
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
      // Promote delayed jobs that are ready
      await this.promoteDelayedJobs();

      // Process waiting jobs
      await this.processWaitingJobs();
      
    } catch (error) {
      console.error('Redis processing error:', (error as Error).message);
    }

    // Schedule next processing cycle
    this.processingLoop = setTimeout(() => this.processJobs(), 2000);
  }

  /**
   * Promote delayed jobs that are ready to run
   */
  private async promoteDelayedJobs(): Promise<void> {
    if (!this.connected) return;

    try {
      const now = Date.now();
      const delayedKey = this.getGlobalKey('delayed');
      
      // Get ready jobs (score <= now)
      const readyJobIds = await this.client.zrangebyscore(delayedKey, 0, now);
      
      for (const jobId of readyJobIds) {
        const job = await this.getJobData(jobId);
        if (job && job.status === 'delayed') {
          await this.promoteJob(job);
        }
      }
      
    } catch (error) {
      console.error('Error promoting delayed jobs:', (error as Error).message);
    }
  }

  /**
   * Promote single delayed job to waiting
   */
  private async promoteJob(job: RedisJob): Promise<void> {
    const multi = this.client.multi();
    
    // Update job status
    job.status = 'waiting';
    multi.hset(this.getJobKey(job.id), 'data', JSON.stringify(job));
    
    // Move from delayed to waiting queue
    multi.zrem(this.getGlobalKey('delayed'), job.id);
    multi.zadd(this.getQueueKey(job.type, 'waiting'), job.options.priority || 0, job.id);
    
    await multi.exec();
    
    // Notify workers
    await this.client.publish(this.getNotificationKey(job.type), job.id);
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

    // Process jobs for each registered handler
    for (const [jobType, handler] of this.handlers) {
      if (this.paused.has(jobType)) continue;
      
      const available = concurrency - this.processing.size;
      if (available <= 0) break;
      
      await this.processJobType(jobType, handler, available);
    }
  }

  /**
   * Process jobs for specific job type
   */
  private async processJobType(jobType: string, handler: JobHandler, limit: number): Promise<void> {
    try {
      const queueKey = this.getQueueKey(jobType, 'waiting');
      
      // Get highest priority jobs
      const jobIds = await this.client.zrevrange(queueKey, 0, limit - 1);
      
      for (const jobId of jobIds) {
        if (this.processing.size >= this.config.concurrency) break;
        
        const job = await this.getJobData(jobId);
        if (job && job.status === 'waiting') {
          this.processJob(job, handler).catch(error => {
            console.error(`Error processing Redis job ${jobId}:`, error);
          });
        }
      }
      
    } catch (error) {
      console.error(`Error processing job type ${jobType}:`, (error as Error).message);
    }
  }

  /**
   * Process individual job with Redis state management
   */
  private async processJob(job: RedisJob, handler: JobHandler): Promise<void> {
    // Mark as processing
    this.processing.add(job.id);
    
    try {
      // Move job to active queue
      await this.moveJobToActive(job);
      
      // Execute handler
      const result = await handler(job.data);
      
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
   * Move job to active queue
   */
  private async moveJobToActive(job: RedisJob): Promise<void> {
    job.status = 'active';
    job.processedAt = new Date().toISOString();
    job.attempts++;

    const multi = this.client.multi();
    
    // Update job data
    multi.hset(this.getJobKey(job.id), 'data', JSON.stringify(job));
    
    // Move from waiting to active
    multi.zrem(this.getQueueKey(job.type, 'waiting'), job.id);
    multi.zadd(this.getQueueKey(job.type, 'active'), Date.now(), job.id);
    
    await multi.exec();
  }

  /**
   * Complete job successfully
   */
  private async completeJob(job: RedisJob, result: any): Promise<void> {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    if (result !== undefined) {
      job.result = result;
    }

    const multi = this.client.multi();
    
    // Update job data
    multi.hset(this.getJobKey(job.id), 'data', JSON.stringify(job));
    
    // Move from active to completed
    multi.zrem(this.getQueueKey(job.type, 'active'), job.id);
    multi.zadd(this.getQueueKey(job.type, 'completed'), Date.now(), job.id);
    
    await multi.exec();
  }

  /**
   * Fail job with retry logic
   */
  private async failJob(job: RedisJob, error: Error): Promise<void> {
    job.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };

    if (job.attempts < job.maxAttempts) {
      // Retry with backoff
      job.status = 'waiting';
      job.runAt = this.calculateRetryDelay(job).toISOString();
      
      const multi = this.client.multi();
      multi.hset(this.getJobKey(job.id), 'data', JSON.stringify(job));
      multi.zrem(this.getQueueKey(job.type, 'active'), job.id);
      multi.zadd(this.getQueueKey(job.type, 'waiting'), job.options.priority || 0, job.id);
      await multi.exec();
      
    } else {
      // Max attempts reached
      job.status = 'failed';
      job.failedAt = new Date().toISOString();
      
      const multi = this.client.multi();
      multi.hset(this.getJobKey(job.id), 'data', JSON.stringify(job));
      multi.zrem(this.getQueueKey(job.type, 'active'), job.id);
      multi.zadd(this.getQueueKey(job.type, 'failed'), Date.now(), job.id);
      await multi.exec();
    }
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(job: RedisJob): Date {
    const baseDelay = this.config.retryDelay;
    let delay = baseDelay;

    if (this.config.retryBackoff === 'exponential') {
      delay = baseDelay * Math.pow(2, job.attempts - 1);
    }

    // Add jitter
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    delay += jitter;

    return new Date(Date.now() + delay);
  }

  /**
   * Subscribe to job notifications for a job type
   */
  private subscribeToJobType(jobType: string): void {
    if (!this.subscriber) return;
    
    const channel = this.getNotificationKey(jobType);
    this.subscriber.subscribe(channel);
  }

  /**
   * Setup periodic health checks
   */
  private setupHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.client.ping();
      } catch (error) {
        console.error('Redis health check failed:', (error as Error).message);
        this.connected = false;
      }
    }, 30000);
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
        console.error('Redis cleanup error:', (error as Error).message);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  // ============================================================================
  // PRIVATE UTILITY METHODS
  // ============================================================================

  /**
   * Get Redis key for job data
   */
  private getJobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  /**
   * Get Redis key for specific queue
   */
  private getQueueKey(jobType: string, status: string): string {
    return `queue:${jobType}:${status}`;
  }

  /**
   * Get Redis key for global queues
   */
  private getGlobalKey(suffix: string): string {
    return `global:${suffix}`;
  }

  /**
   * Get Redis key for job notifications
   */
  private getNotificationKey(jobType: string): string {
    return `notify:${jobType}`;
  }

  /**
   * Get job data from Redis
   */
  private async getJobData(jobId: string): Promise<RedisJob | null> {
    try {
      const data = await this.client.hget(this.getJobKey(jobId), 'data');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting job data for ${jobId}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Convert RedisJob to JobInfo
   */
  private redisJobToInfo(job: RedisJob): JobInfo {
    return {
      id: job.id,
      type: job.type,
      data: job.data,
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
      createdAt: new Date(job.createdAt),
      processedAt: job.processedAt ? new Date(job.processedAt) : undefined,
      completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
      failedAt: job.failedAt ? new Date(job.failedAt) : undefined,
    };
  }
}