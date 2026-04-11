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

import { QueueClass } from './queue.js';
import { getSmartDefaults, type QueueConfig } from './defaults.js';

// Global queuing instance for performance (like auth module)
let globalQueuing: QueueClass | null = null;

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
function get(overrides: Partial<QueueConfig> = {}): Queue {
  // Lazy initialization - parse environment once (like auth)
  if (!globalQueuing) {
    const defaults = getSmartDefaults();
    const config: QueueConfig = { ...defaults, ...overrides };
    globalQueuing = new QueueClass(config);
  }

  return globalQueuing;
}

/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing queuing logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function reset(newConfig: Partial<QueueConfig> = {}): Queue {
  if (globalQueuing) {
    // Close existing instance gracefully
    globalQueuing.close();
  }
  
  const defaults = getSmartDefaults();
  const config: QueueConfig = { ...defaults, ...newConfig };
  globalQueuing = new QueueClass(config);
  return globalQueuing;
}

/**
 * Get active transport type for debugging
 * @llm-rule WHEN: Need to see which transport is running (memory, redis, database)
 * @llm-rule AVOID: Using for business logic - this is for debugging only
 */
function getActiveTransport(): string {
  if (!globalQueuing) {
    return 'none';
  }
  return globalQueuing.getActiveTransport();
}

/**
 * Check if specific transport is active
 * @llm-rule WHEN: Conditionally handling jobs based on transport capability
 * @llm-rule AVOID: Complex transport detection - just add jobs normally, transports auto-handle
 */
function hasTransport(name: string): boolean {
  if (!globalQueuing) {
    return false;
  }
  return globalQueuing.hasTransport(name);
}

/**
 * Get current configuration for debugging
 * @llm-rule WHEN: Debugging queuing setup or checking environment detection
 * @llm-rule AVOID: Using for runtime decisions - configuration is set at startup
 */
function getConfig(): QueueConfig | null {
  if (!globalQueuing) {
    return null;
  }
  return globalQueuing.getConfig();
}

/**
 * Clear all queues and close transports - essential for testing
 * @llm-rule WHEN: Testing queuing logic or app shutdown
 * @llm-rule AVOID: Using in production without graceful shutdown
 */
async function clear(): Promise<void> {
  if (globalQueuing) {
    await globalQueuing.close();
    globalQueuing = null;
  }
}

/**
 * Get health status of queuing system
 * @llm-rule WHEN: Health checks or monitoring dashboard
 * @llm-rule AVOID: Frequent polling - expensive operation for some transports
 */
function getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; transport: string; message?: string } {
  if (!globalQueuing) {
    return { status: 'unhealthy', transport: 'none', message: 'Queuing not initialized' };
  }
  
  return globalQueuing.getHealth();
}

/**
 * Single queuing export with minimal functionality (like auth module)
 */
export const queueClass = {
  // Core method (like auth.get())
  get,
  
  // Utility methods
  reset,
  clear,
  getActiveTransport,
  hasTransport,
  getConfig,
  getHealth,
} as const;

