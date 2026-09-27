/**
 * Vitest tests for the storage module.
 * @file src/storage/storage.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { storageClass } from './index.js';

afterEach(async () => { await storageClass.disconnectAll(); });

describe('storageClass.get()', () => {
  it('returns a Storage instance', () => {
    const storage = storageClass.get();
    expect(storage).toBeDefined();
    expect(typeof storage).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(storageClass.get()).toBe(storageClass.get());
  });
});

describe('storage.put() + storage.exists() + storage.get()', () => {
  it('puts a file and confirms it exists', async () => {
    const storage = storageClass.get();
    const key = `test/${Date.now()}.txt`;
    await storage.put(key, Buffer.from('hello'), { contentType: 'text/plain' });
    expect(await storage.exists(key)).toBe(true);
  });

  it('returns false for a non-existent key', async () => {
    const storage = storageClass.get();
    expect(await storage.exists('__nonexistent__/file.txt')).toBe(false);
  });

  it('retrieves the stored content', async () => {
    const storage = storageClass.get();
    const key = `test/${Date.now()}-content.txt`;
    await storage.put(key, Buffer.from('world'));
    const buf = await storage.get(key);
    expect(buf.toString()).toBe('world');
  });
});

describe('storage.delete()', () => {
  it('deletes a stored file', async () => {
    const storage = storageClass.get();
    const key = `test/${Date.now()}-del.txt`;
    await storage.put(key, Buffer.from('delete me'));
    const result = await storage.delete(key);
    expect(result).toBe(true);
    expect(await storage.exists(key)).toBe(false);
  });
});

describe('storage.url()', () => {
  it('returns a string URL for a key', () => {
    const storage = storageClass.get();
    const url = storage.url('uploads/file.txt');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});

describe('storage.list()', () => {
  it('returns an array (may be empty)', async () => {
    const storage = storageClass.get();
    const files = await storage.list();
    expect(Array.isArray(files)).toBe(true);
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset', 'getStrategy', 'getConfig',
    'hasCloudStorage', 'isLocal', 'getStats', 'validateConfig', 'disconnectAll',
    'upload', 'download',
  ];

  const INSTANCE_METHODS = [
    'put', 'get', 'delete', 'list', 'url', 'signedUrl', 'exists', 'copy',
    'disconnect', 'getStrategy', 'getConfig',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = ['has', 'save', 'upload', 'fetch'];

  // Class-level methods that MUST NOT exist.
  const HALLUCINATED_CLASS = [
    'put', 'delete', 'list', 'url', 'signedUrl', 'exists', 'copy', 'disconnect',
    'shutdown',   // renamed to disconnectAll() in 3.0.2 — NAMING.md §70
    'clear',      // removed in 4.0.0 — redundant alias, use disconnectAll()
  ];

  for (const m of CLASS_METHODS) {
    it(`storageClass.${m} exists`, () => {
      expect(typeof (storageClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`storageClass.${m} does NOT exist (call via storageClass.get().${m}() instead)`, () => {
      expect(typeof (storageClass as any)[m]).not.toBe('function');
    });
  }

  const storage = storageClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`storage instance .${m} exists`, () => {
      expect(typeof (storage as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
    it(`storage instance .${m} does NOT exist`, () => {
      // Note: storageClass.upload helper exists but NOT on the Storage instance
      expect(typeof (storage as any)[m]).not.toBe('function');
    });
  }

  it('storage.exists() is the correct presence check (not .has())', async () => {
    const s = storageClass.get();
    expect(typeof s.exists).toBe('function');
    expect(typeof (s as any).has).not.toBe('function');
  });
});

describe('S3-compatible endpoints replace the R2 strategy (6.0)', () => {
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

  it('reads S3_ENDPOINT and S3_FORCE_PATH_STYLE into the s3 strategy config', async () => {
    const { getSmartDefaults } = await import('./defaults.js');
    withEnv({
      AWS_S3_BUCKET: 'my-bucket',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      S3_FORCE_PATH_STYLE: 'true',
      BLOOM_STORAGE_STRATEGY: undefined,
    }, () => {
      const config = getSmartDefaults();
      expect(config.strategy).toBe('s3');
      expect(config.s3?.endpoint).toBe('https://abc123.r2.cloudflarestorage.com');
      expect(config.s3?.forcePathStyle).toBe(true);
      expect((config as any).r2).toBeUndefined();
    });
  });

  it('rejects BLOOM_STORAGE_STRATEGY=r2 with a pointer to S3_ENDPOINT', async () => {
    const { getSmartDefaults } = await import('./defaults.js');
    withEnv({ BLOOM_STORAGE_STRATEGY: 'r2' }, () => {
      expect(() => getSmartDefaults()).toThrow(/S3_ENDPOINT/);
    });
  });
});
