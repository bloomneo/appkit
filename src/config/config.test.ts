/**
 * Vitest tests for the config module.
 * @file src/config/config.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configClass } from './index.js';

beforeEach(() => { configClass.reset(); });

describe('configClass.get()', () => {
  it('returns a ConfigClass instance', () => {
    const config = configClass.get();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(configClass.get()).toBe(configClass.get());
  });

  it('reset() returns a new instance', () => {
    const a = configClass.get();
    const b = configClass.reset();
    expect(a).not.toBe(b);
  });
});

describe('config.get() / getNumber() / getBoolean()', () => {
  it('get() returns default when key not present', () => {
    const config = configClass.reset({ nested: { key: 'hello' } } as any);
    expect(config.get('nested.key', 'fallback')).toBe('hello');
    expect(config.get('missing.key', 'fallback')).toBe('fallback');
  });

  it('get() returns raw value (callers cast to number/boolean themselves)', () => {
    const config = configClass.reset({ port: '3000' } as any);
    expect(Number(config.get('port') ?? 0)).toBe(3000);
  });

  it('has() returns true when path exists', () => {
    const config = configClass.reset({ db: { url: 'postgres://localhost' } } as any);
    expect(config.has('db.url')).toBe(true);
    expect(config.has('db.missing')).toBe(false);
  });

  it('getRequired() throws when path is missing', () => {
    const config = configClass.reset({} as any);
    expect(() => config.getRequired('nonexistent')).toThrow(/Missing required/);
  });
});

describe('Environment detection — on configClass, not on config instance', () => {
  it('isDevelopment() is a function on configClass', () => {
    expect(typeof configClass.isDevelopment).toBe('function');
    expect(typeof configClass.isDevelopment()).toBe('boolean');
  });

  it('isProduction() is a function on configClass', () => {
    expect(typeof configClass.isProduction).toBe('function');
    expect(typeof configClass.isProduction()).toBe('boolean');
  });

  it('isTest() is a function on configClass', () => {
    expect(typeof configClass.isTest).toBe('function');
    expect(typeof configClass.isTest()).toBe('boolean');
  });

  it('isDevelopment() and isProduction() are mutually exclusive', () => {
    expect(configClass.isDevelopment() && configClass.isProduction()).toBe(false);
  });

  it('configClass.isDevelopment() NOT on config instance', () => {
    const config = configClass.get();
    // These helpers live on configClass, not on the ConfigClass instance.
    expect(typeof (config as any).isDevelopment).not.toBe('function');
    expect(typeof (config as any).isProduction).not.toBe('function');
  });
});

describe('validateRequired()', () => {
  it('does not throw when all paths are present', () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    configClass.reset();
    expect(() => configClass.validateRequired(['database.url'])).not.toThrow();
    delete process.env.DATABASE_URL;
  });

  it('throws when a required path is missing', () => {
    delete process.env.DEFINITELY_MISSING_VAR;
    configClass.reset();
    expect(() => configClass.validateRequired(['definitely.missing.var'])).toThrow(/missing/i);
  });
});

describe('getEnvVars()', () => {
  it('returns a plain object', () => {
    const vars = configClass.getEnvVars();
    expect(typeof vars).toBe('object');
    expect(Array.isArray(vars)).toBe(false);
  });

  it('does not include BLOOM_* framework variables', () => {
    const vars = configClass.getEnvVars();
    for (const key of Object.keys(vars)) {
      expect(key.startsWith('BLOOM_')).toBe(false);
    }
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset',
    'getEnvironment', 'isDevelopment', 'isProduction', 'isTest',
    'getEnvVars', 'validateRequired', 'getModuleConfig',
  ];

  const INSTANCE_METHODS = ['get', 'has', 'getAll', 'getRequired', 'getMany'];

  // Methods that do NOT exist on the ConfigClass instance (they're on configClass).
  const NOT_ON_INSTANCE = ['isDevelopment', 'isProduction', 'isTest', 'getNumber', 'getBoolean'];

  // configClass-level methods that MUST NOT exist — drift trap for docs.
  // `clearCache` was documented in an earlier README draft but never implemented.
  // Consumers should use `configClass.reset()` instead.
  const HALLUCINATED_CLASS_METHODS = ['clearCache'];

  for (const m of CLASS_METHODS) {
    it(`configClass.${m} exists and is a function`, () => {
      expect(typeof (configClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS_METHODS) {
    it(`configClass.${m} does NOT exist (use reset() instead)`, () => {
      expect(typeof (configClass as any)[m]).not.toBe('function');
    });
  }

  const instance = configClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`config instance .${m} exists and is a function`, () => {
      expect(typeof (instance as any)[m]).toBe('function');
    });
  }

  for (const m of NOT_ON_INSTANCE) {
    it(`config instance .${m} does NOT exist (lives on configClass, not instance)`, () => {
      expect(typeof (instance as any)[m]).not.toBe('function');
    });
  }
});
