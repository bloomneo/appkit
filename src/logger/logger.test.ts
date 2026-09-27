/**
 * Vitest tests for the logger module.
 * @file src/logger/logger.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loggerClass } from './index.js';
import { validateEnvironment, getSmartDefaults } from './defaults.js';
import { filterEssentialMeta } from './transports/meta.js';

beforeEach(async () => { await loggerClass.disconnectAll(); });

describe('loggerClass.get()', () => {
  it('returns a Logger instance', () => {
    const logger = loggerClass.get();
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('returns the same instance for the same component (singleton)', () => {
    const a = loggerClass.get('users');
    const b = loggerClass.get('users');
    expect(a).toBe(b);
  });

  it('returns different instances for different components', () => {
    const a = loggerClass.get('users');
    const b = loggerClass.get('orders');
    expect(a).not.toBe(b);
  });
});

describe('Logger level methods exist and are callable', () => {
  const logger = loggerClass.get('test');

  const levels = ['info', 'warn', 'error', 'debug', 'fatal'] as const;

  for (const level of levels) {
    it(`logger.${level}() is a function and does not throw`, () => {
      expect(typeof (logger as any)[level]).toBe('function');
      expect(() => (logger as any)[level](`${level} test`, { x: 1 })).not.toThrow();
    });
  }
});

describe('logger.child()', () => {
  it('returns a Logger with the bindings merged in', () => {
    const logger = loggerClass.get('test');
    const child = logger.child({ requestId: 'abc' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.fatal).toBe('function');
  });
});

describe('loggerClass utility methods', () => {
  it('getActiveTransports() returns an array', () => {
    loggerClass.get(); // initialise
    expect(Array.isArray(loggerClass.getActiveTransports())).toBe(true);
  });

  it('hasTransport() returns a boolean', () => {
    loggerClass.get();
    expect(typeof loggerClass.hasTransport('console')).toBe('boolean');
  });

  it('getConfig() returns non-null after initialisation', () => {
    loggerClass.get();
    expect(loggerClass.getConfig()).not.toBeNull();
  });
});

describe('Public API surface — drift check', () => {
  const INSTANCE_METHODS = [
    'info', 'warn', 'error', 'debug', 'fatal', 'child', 'flush', 'close',
    'setLevel', 'getLevel', 'isLevelEnabled',
  ];
  const CLASS_METHODS    = ['get', 'disconnectAll', 'getActiveTransports', 'hasTransport', 'getConfig'];

  // Methods that do NOT exist — drift trap.
  const HALLUCINATED_INSTANCE = ['trace', 'silly', 'verbose'];

  // Class-level methods that MUST NOT exist — drift trap for docs that
  // assume symmetry with the instance surface.
  const HALLUCINATED_CLASS = [
    'setLevel', 'getLevel', 'isLevelEnabled', 'flush', 'close',
    'clear',   // renamed to disconnectAll() in 4.0.0 — one teardown verb across package
  ];

  const logger = loggerClass.get('drift');
  for (const m of INSTANCE_METHODS) {
    it(`logger.${m} exists and is a function`, () => {
      expect(typeof (logger as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
    it(`logger.${m} does NOT exist`, () => {
      expect(typeof (logger as any)[m]).not.toBe('function');
    });
  }

  for (const m of CLASS_METHODS) {
    it(`loggerClass.${m} exists and is a function`, () => {
      expect(typeof (loggerClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`loggerClass.${m} does NOT exist (call via loggerClass.get().${m}() instead)`, () => {
      expect(typeof (loggerClass as any)[m]).not.toBe('function');
    });
  }
});

describe('the logger never reads DATABASE_URL (6.0 — database transport removed)', () => {
  // 4.0.1 fixed a bug where merely setting DATABASE_URL to a value the logger
  // did not recognise threw at import time. 6.0 removed the database, http and
  // webhook transports, so no logger env var depends on DATABASE_URL at all.
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

  it('ignores a malformed DATABASE_URL even with the old BLOOM_LOGGER_DATABASE flag set', () => {
    withEnv({ DATABASE_URL: 'this-is-not-a-url', BLOOM_LOGGER_DATABASE: 'true' }, () => {
      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  it('only exposes console and file transport flags', () => {
    withEnv({ BLOOM_LOGGER_HTTP_URL: 'https://example.com/logs', BLOOM_LOGGER_WEBHOOK_URL: 'https://example.com/hook' }, () => {
      expect(Object.keys(getSmartDefaults().transports).sort()).toEqual(['console', 'file']);
    });
  });
});

describe('minimal scope keeps diagnostic meta, not just IDs (regression — 5.1.3)', () => {
  it('keeps the measurements an event-loop-lag monitor reports', () => {
    // Found in production: the monitor collected all five of these and the file
    // transport wrote none of them, because the old filter kept only *Id fields.
    const kept = filterEssentialMeta({
      lagMs: 1400,
      rssMB: 1487,
      heapUsedMB: 900,
      heapTotalMB: 1100,
      externalMB: 12,
    });

    expect(kept).toEqual({
      lagMs: 1400,
      rssMB: 1487,
      heapUsedMB: 900,
      heapTotalMB: 1100,
      externalMB: 12,
    });
  });

  it('still keeps correlation fields and anything ending in Id', () => {
    const kept = filterEssentialMeta({
      traceId: 't-1',
      ip: '10.0.0.1',
      orderId: 'o-9',
      appName: 'api',
    });

    expect(kept).toEqual({
      traceId: 't-1',
      ip: '10.0.0.1',
      orderId: 'o-9',
      appName: 'api',
    });
  });

  it('keeps booleans and null, drops only undefined', () => {
    expect(filterEssentialMeta({ cached: false, evicted: null, missing: undefined }))
      .toEqual({ cached: false, evicted: null });
  });

  it('truncates a long string rather than dropping the field', () => {
    const kept = filterEssentialMeta({ sql: 'x'.repeat(500) });

    expect(kept.sql).toHaveLength(203); // 200 + '...'
    expect(kept.sql.endsWith('...')).toBe(true);
  });

  it('summarizes bulky values so the key never vanishes silently', () => {
    const kept = filterEssentialMeta({
      rows: [1, 2, 3],
      config: { a: 1, b: 2 },
    });

    expect(kept).toEqual({ rows: '[3 items]', config: '{2 keys}' });
  });

  it('tolerates a non-object meta', () => {
    expect(filterEssentialMeta(null)).toEqual({});
    expect(filterEssentialMeta('nope' as any)).toEqual({});
  });
});
