/**
 * Vitest tests for the queue module.
 * @file src/queue/queue.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { queueClass } from './index.js';

afterEach(async () => { await queueClass.clear(); });

describe('queueClass.get()', () => {
  it('returns a Queue instance', () => {
    const queue = queueClass.get();
    expect(queue).toBeDefined();
    expect(typeof queue).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(queueClass.get()).toBe(queueClass.get());
  });
});

describe('queue.add() + queue.process()', () => {
  it('enqueues a job and returns a string ID', async () => {
    const queue = queueClass.get();
    const id = await queue.add('test-job', { payload: 'hello' });
    expect(typeof id).toBe('string');
  });

  it('processes a job via registered handler', async () => {
    const queue = queueClass.get();
    const results: string[] = [];

    queue.process('greeting', async (data: any) => {
      results.push(data.name);
    });

    await queue.add('greeting', { name: 'world' });
    // Allow in-memory queue to process synchronously or via microtask
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(results).toContain('world');
  });
});

describe('queue.schedule()', () => {
  it('enqueues a delayed job and returns a string ID', async () => {
    const queue = queueClass.get();
    const id = await queue.schedule('delayed-job', { x: 1 }, 5000);
    expect(typeof id).toBe('string');
  });
});

describe('queue.getStats()', () => {
  it('returns queue stats object', async () => {
    const queue = queueClass.get();
    const stats = await queue.getStats();
    expect(typeof stats.waiting).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.completed).toBe('number');
    expect(typeof stats.failed).toBe('number');
  });
});

describe('queue.add() — JobOptions', () => {
  it('accepts attempts (not retries) in options', async () => {
    const queue = queueClass.get();
    // Should not throw with valid options
    const id = await queue.add('reliable-job', {}, { attempts: 3, priority: 1, delay: 0 });
    expect(typeof id).toBe('string');
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset', 'clear',
    'getActiveTransport', 'hasTransport', 'getConfig', 'getHealth',
  ];

  const INSTANCE_METHODS = [
    'add', 'process', 'schedule', 'pause', 'resume',
    'getStats', 'getJobs', 'retry', 'remove', 'clean', 'close',
  ];

  // Methods that do NOT exist — previously hallucinated
  const HALLUCINATED = ['enqueue', 'subscribe', 'cron'];

  for (const m of CLASS_METHODS) {
    it(`queueClass.${m} exists`, () => {
      expect(typeof (queueClass as any)[m]).toBe('function');
    });
  }

  const queue = queueClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`queue instance .${m} exists`, () => {
      expect(typeof (queue as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED) {
    it(`queue.${m} does NOT exist`, () => {
      expect(typeof (queue as any)[m]).not.toBe('function');
    });
  }

  it('JobOptions uses "attempts" not "retries"', async () => {
    // Verify the interface accepts attempts; TypeScript catches retries at compile time
    const q = queueClass.get();
    const id = await q.add('check-options', {}, { attempts: 5 });
    expect(typeof id).toBe('string');
  });
});
