/**
 * Vitest tests for the util module.
 * @file src/util/util.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { utilClass } from './index.js';

beforeEach(() => { utilClass.clearCache(); });

describe('utilClass.get()', () => {
  it('returns a UtilClass instance', () => {
    const util = utilClass.get();
    expect(util).toBeDefined();
    expect(typeof util).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(utilClass.get()).toBe(utilClass.get());
  });
});

describe('util.get() — safe deep property access', () => {
  const util = utilClass.get();

  it('retrieves a nested value', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(util.get(obj, 'a.b.c', 0)).toBe(42);
  });

  it('returns default when path is missing', () => {
    const obj = { a: {} };
    expect(util.get(obj, 'a.b.x', 'default')).toBe('default');
  });
});

describe('util.isEmpty()', () => {
  const util = utilClass.get();

  it('returns true for null, undefined, empty string, empty array, empty object', () => {
    expect(util.isEmpty(null)).toBe(true);
    expect(util.isEmpty(undefined)).toBe(true);
    expect(util.isEmpty('')).toBe(true);
    expect(util.isEmpty([])).toBe(true);
    expect(util.isEmpty({})).toBe(true);
  });

  it('returns false for non-empty values', () => {
    expect(util.isEmpty(0)).toBe(false);
    expect(util.isEmpty(false)).toBe(false);
    expect(util.isEmpty('hello')).toBe(false);
    expect(util.isEmpty([1])).toBe(false);
  });
});

describe('util.slugify()', () => {
  const util = utilClass.get();

  it('converts a phrase to a URL-safe slug', () => {
    expect(util.slugify('My Awesome Post!')).toBe('my-awesome-post');
  });

  it('handles consecutive spaces and special characters', () => {
    const result = util.slugify('  Hello   World  ');
    expect(result).not.toContain(' ');
    expect(result).toContain('hello');
  });
});

describe('util.chunk()', () => {
  const util = utilClass.get();

  it('splits an array into fixed-size chunks', () => {
    expect(util.chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it('handles remainder chunks', () => {
    const result = util.chunk([1, 2, 3, 4, 5], 3);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(2);
  });
});

describe('util.pick()', () => {
  const util = utilClass.get();

  it('returns an object with only specified keys', () => {
    const user = { id: 1, email: 'a@b.com', password: 'secret' };
    const result = util.pick(user, ['id', 'email']);
    expect(result).toEqual({ id: 1, email: 'a@b.com' });
    expect(result).not.toHaveProperty('password');
  });
});

describe('util.unique()', () => {
  const util = utilClass.get();

  it('removes duplicate values', () => {
    expect(util.unique([1, 2, 2, 3, 3])).toEqual([1, 2, 3]);
  });

  it('handles empty array', () => {
    expect(util.unique([])).toEqual([]);
  });
});

describe('util.clamp()', () => {
  const util = utilClass.get();

  it('clamps value to max when above range', () => {
    expect(util.clamp(150, 0, 100)).toBe(100);
  });

  it('clamps value to min when below range', () => {
    expect(util.clamp(-10, 0, 100)).toBe(0);
  });

  it('returns value unchanged when in range', () => {
    expect(util.clamp(50, 0, 100)).toBe(50);
  });
});

describe('util.formatBytes()', () => {
  const util = utilClass.get();

  it('formats bytes to human-readable string', () => {
    const result = util.formatBytes(1_572_864);
    expect(result).toMatch(/1\.5\s*MB/i);
  });

  it('handles zero bytes', () => {
    expect(util.formatBytes(0)).toMatch(/0/);
  });
});

describe('util.truncate()', () => {
  const util = utilClass.get();

  it('truncates a string and appends ellipsis', () => {
    const result = util.truncate('A very long string', 10);
    expect(result.length).toBeLessThanOrEqual(13); // 10 chars + "..."
    expect(result).toContain('...');
  });
});

describe('util.uuid()', () => {
  const util = utilClass.get();

  it('returns a UUID-like string', () => {
    const id = util.uuid();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('returns a unique value each call', () => {
    expect(util.uuid()).not.toBe(util.uuid());
  });
});

describe('util.debounce()', () => {
  const util = utilClass.get();

  it('returns a function', () => {
    const debounced = util.debounce(() => {}, 100);
    expect(typeof debounced).toBe('function');
  });
});

describe('util.sleep()', () => {
  const util = utilClass.get();

  it('resolves after the given delay', async () => {
    const start = Date.now();
    await util.sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset', 'clearCache', 'getConfig',
    'isDevelopment', 'isProduction', 'quickSetup', 'validateConfig', 'getStatus',
  ];

  const INSTANCE_METHODS = [
    'get', 'isEmpty', 'slugify', 'chunk', 'debounce',
    'pick', 'unique', 'clamp', 'formatBytes', 'truncate', 'sleep', 'uuid',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = ['set', 'omit', 'throttle', 'retry'];

  // Class-level methods that MUST NOT exist — drift trap for docs that
  // assume symmetry with the instance surface.
  const HALLUCINATED_CLASS = [
    'isEmpty', 'slugify', 'chunk', 'debounce', 'pick', 'unique',
    'clamp', 'formatBytes', 'truncate', 'sleep', 'uuid',
  ];

  for (const m of CLASS_METHODS) {
    it(`utilClass.${m} exists`, () => {
      expect(typeof (utilClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`utilClass.${m} does NOT exist (call via utilClass.get().${m}() instead)`, () => {
      expect(typeof (utilClass as any)[m]).not.toBe('function');
    });
  }

  const util = utilClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`util instance .${m} exists`, () => {
      expect(typeof (util as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
    it(`util.${m} does NOT exist`, () => {
      expect(typeof (util as any)[m]).not.toBe('function');
    });
  }
});
