/**
 * Vitest tests for the logger module.
 * @file src/logger/logger.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loggerClass } from './index.js';
import { validateEnvironment } from './defaults.js';

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

describe('DATABASE_URL is only the logger\'s business when it logs to a database (regression — 4.0.1)', () => {
  // Before 4.0.1 this validation ran unconditionally, so merely *setting*
  // DATABASE_URL to a value the logger didn't recognise (e.g. Prisma's
  // `file:./dev.db`) threw at import time and killed the whole server before
  // a single route loaded — even with database logging switched off.
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

  it('ignores an unrecognised DATABASE_URL when database logging is off', () => {
    withEnv({ DATABASE_URL: 'file:./dev.db', BLOOM_LOGGER_DATABASE: undefined }, () => {
      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  it('ignores a totally malformed DATABASE_URL when database logging is off', () => {
    withEnv({ DATABASE_URL: 'this-is-not-a-url', BLOOM_LOGGER_DATABASE: undefined }, () => {
      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  it('accepts a file: URL when database logging is ON', () => {
    withEnv({ DATABASE_URL: 'file:./dev.db', BLOOM_LOGGER_DATABASE: 'true' }, () => {
      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  it('still rejects a malformed DATABASE_URL when database logging is ON', () => {
    withEnv({ DATABASE_URL: 'this-is-not-a-url', BLOOM_LOGGER_DATABASE: 'true' }, () => {
      expect(() => validateEnvironment()).toThrow(/Invalid DATABASE_URL/);
    });
  });

  it('still requires DATABASE_URL when database logging is ON', () => {
    withEnv({ DATABASE_URL: undefined, BLOOM_LOGGER_DATABASE: 'true' }, () => {
      expect(() => validateEnvironment()).toThrow(/DATABASE_URL not provided/);
    });
  });
});
