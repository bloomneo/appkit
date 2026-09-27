/**
 * Vitest tests for the queue module.
 * @file src/queue/queue.test.ts
 */

import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { getSmartDefaults } from './defaults.js';

// Worker mode is off by default when NODE_ENV=test. The handler-processing
// test below needs the in-memory processing loop running, so force-enable
// it before the queue module loads its config.
beforeAll(() => { process.env.BLOOM_QUEUE_WORKER = 'true'; });

const { queueClass } = await import('./index.js');

afterEach(async () => { await queueClass.disconnectAll(); });

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

    // Memory transport re-polls every 1000ms. Poll up to 1500ms so we
    // deterministically wait for the next tick instead of racing a
    // fixed setTimeout.
    const deadline = Date.now() + 1500;
    while (!results.includes('world') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
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
    'get', 'reset', 'disconnectAll',
    'getActiveTransport', 'hasTransport', 'getConfig', 'getHealth',
  ];

  const INSTANCE_METHODS = [
    'add', 'process', 'schedule', 'pause', 'resume',
    'getStats', 'getJobs', 'retry', 'remove', 'clean', 'close',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = ['enqueue', 'subscribe', 'cron'];

  // Class-level methods that MUST NOT exist — drift trap for docs that
  // assume symmetry with the instance surface.
  const HALLUCINATED_CLASS = [
    'add', 'process', 'schedule', 'pause', 'resume',
    'retry', 'remove', 'clean', 'close', 'getStats', 'getJobs',
    'getValidatedDefaults',
    'clear',    // renamed to disconnectAll() — NAMING.md §70 teardown naming
  ];

  for (const m of CLASS_METHODS) {
    it(`queueClass.${m} exists`, () => {
      expect(typeof (queueClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`queueClass.${m} does NOT exist (call via queueClass.get().${m}() instead)`, () => {
      expect(typeof (queueClass as any)[m]).not.toBe('function');
    });
  }

  const queue = queueClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`queue instance .${m} exists`, () => {
      expect(typeof (queue as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
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

describe('shared env vars are validated only when used (regression — 4.2.1)', () => {
  // REDIS_URL and DATABASE_URL belong to no single module. Validating one the
  // queue will never open turns another module's config into an import-time
  // crash. Worse: getTransport() auto-selects 'database' whenever DATABASE_URL
  // is set, so rejecting Prisma's SQLite scheme made the queue unusable on
  // SQLite entirely — the same defect fixed in logger for 4.0.1.
  const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };

  it('accepts Prisma SQLite on the database transport', () => {
    withEnv({ DATABASE_URL: 'file:./dev.db', REDIS_URL: undefined, BLOOM_QUEUE_TRANSPORT: undefined }, () => {
      expect(() => getSmartDefaults()).not.toThrow();
      expect(getSmartDefaults().transport).toBe('database');
    });
  });

  it('ignores a malformed DATABASE_URL when the queue runs in memory', () => {
    withEnv({ DATABASE_URL: 'not-a-url', BLOOM_QUEUE_TRANSPORT: 'memory', REDIS_URL: undefined }, () => {
      expect(() => getSmartDefaults()).not.toThrow();
    });
  });

  it('still rejects a malformed DATABASE_URL when the queue uses it', () => {
    withEnv({ DATABASE_URL: 'not-a-url', BLOOM_QUEUE_TRANSPORT: 'database', REDIS_URL: undefined }, () => {
      expect(() => getSmartDefaults()).toThrow(/Invalid DATABASE_URL/);
    });
  });

  it('ignores REDIS_URL entirely — it never selects a queue transport (6.0)', () => {
    withEnv({ REDIS_URL: 'http://nope', BLOOM_QUEUE_TRANSPORT: undefined, DATABASE_URL: undefined }, () => {
      expect(() => getSmartDefaults()).not.toThrow();
      expect(getSmartDefaults().transport).toBe('memory');
    });
  });

  it('rejects BLOOM_QUEUE_TRANSPORT=redis with a pointer to the database transport', () => {
    withEnv({ BLOOM_QUEUE_TRANSPORT: 'redis', DATABASE_URL: undefined }, () => {
      expect(() => getSmartDefaults()).toThrow(/removed in 6\.0/);
    });
  });
});

describe('repeat() — recurring jobs (5.1)', () => {
  // midhuna hand-rolled setInterval for recurring work with no cron library.
  // setInterval dies with the process, so every deploy silently stops the
  // series. The continuation here travels in the job payload instead, so on a
  // durable transport it survives a restart.
  afterEach(async () => {
    await queueClass.disconnectAll();
  });

  it('rejects an interval below 1s', async () => {
    const q = queueClass.get();
    await expect(q.repeat('too-fast', {}, 999)).rejects.toThrow(/at least 1000ms/);
    await expect(q.repeat('nan', {}, Number.NaN)).rejects.toThrow(/at least 1000ms/);
  });

  it('registers a series and reports it', async () => {
    const q = queueClass.get();
    await q.repeat('nightly', { scope: 'all' }, 60_000);
    expect(q.getRepeating()).toContain('nightly');
  });

  it('cancelRepeat stops the series', async () => {
    const q = queueClass.get();
    await q.repeat('hourly', {}, 60_000);
    q.cancelRepeat('hourly');
    expect(q.getRepeating()).not.toContain('hourly');
  });

  it('schedules the NEXT occurrence before running the handler, not after', async () => {
    // Re-scheduling after the handler means a crash mid-handler silently ends
    // the series. This asserts the ordering directly: the successor must
    // already be queued at the moment the handler body runs.
    const q = queueClass.get();
    const order: string[] = [];
    const originalSchedule = q.schedule.bind(q);
    (q as any).schedule = async (...args: any[]) => {
      order.push('scheduled');
      return originalSchedule(...(args as [string, any, number]));
    };

    await q.repeat('tick', { n: 1 }, 1000, { startDelay: 1000 });
    order.length = 0; // drop the initial enqueue

    let sawScheduleBeforeHandler = false;
    q.process('tick', async () => {
      sawScheduleBeforeHandler = order.includes('scheduled');
      order.push('handled');
    });

    await new Promise((r) => setTimeout(r, 1400));
    expect(sawScheduleBeforeHandler).toBe(true);
    q.cancelRepeat('tick');
  });

  it('a handler that throws does not end the series', async () => {
    const q = queueClass.get();
    let runs = 0;
    await q.repeat('flaky', {}, 1000, { startDelay: 1000 });
    q.process('flaky', async () => {
      runs++;
      throw new Error('boom');
    });
    await new Promise((r) => setTimeout(r, 2400));
    q.cancelRepeat('flaky');
    // The successor was enqueued before the throw, so the chain continued.
    expect(runs).toBeGreaterThan(1);
  });

  it('a cancelled series stops enqueuing successors', async () => {
    const q = queueClass.get();
    await q.repeat('short-lived', {}, 1000, { startDelay: 1000 });
    q.process('short-lived', async () => { q.cancelRepeat('short-lived'); });
    await new Promise((r) => setTimeout(r, 2400));
    expect(q.getRepeating()).not.toContain('short-lived');
  });
});
