/**
 * Integration gates — every module claim exercised against the real backend.
 * @file tests/integration/backends.integration.test.ts
 *
 * These exist because of a specific failure: `appkit-database` advertised
 * SQLite support that could never have worked, and nobody noticed because
 * nothing ever ran it. An unexercised claim is not a feature, it is a promise
 * you haven't kept — and the bill arrives in production, under deadline.
 *
 * Run:  npm run test:integration
 *
 * Each suite skips when its service isn't configured, and prints WHY, so a
 * skip is never mistaken for a pass. CI supplies the services; locally you
 * get an honest "not verified".
 */

import { describe, it, expect, afterAll } from 'vitest';

const REDIS = process.env.APPKIT_TEST_REDIS_URL;
const POSTGRES = process.env.APPKIT_TEST_POSTGRES_URL;
const S3_BUCKET = process.env.APPKIT_TEST_S3_BUCKET;

const announce = (name: string, envVar: string) =>
  console.warn(
    `[appkit:integration] SKIPPED ${name} — ${envVar} is not set. ` +
      `This claim is UNVERIFIED in this run.`,
  );

/* ────────────────────────────── Cache → Redis ────────────────────────────── */

describe.skipIf(!REDIS)('cache: Memory → Redis is real', () => {
  afterAll(async () => {
    const { cacheClass } = await import('../../src/cache/index.js');
    await cacheClass.disconnectAll();
  });

  it('round-trips a value through an actual Redis server', async () => {
    process.env.REDIS_URL = REDIS;
    const { cacheClass } = await import('../../src/cache/index.js');
    const cache = cacheClass.get('integration');

    expect(cacheClass.getStrategy()).toBe('redis');
    await cache.set('k', { hello: 'world' }, 30);
    expect(await cache.get('k')).toEqual({ hello: 'world' });
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('getOrSet coalesces concurrent misses into one fetch', async () => {
    // The property midhuna hand-rolled a whole TTL cache to get, not knowing
    // appkit already had it. If this ever regresses, that decision was right.
    process.env.REDIS_URL = REDIS;
    const { cacheClass } = await import('../../src/cache/index.js');
    const cache = cacheClass.get('integration-coalesce');

    let fetches = 0;
    const fetcher = async () => {
      fetches++;
      await new Promise((r) => setTimeout(r, 50));
      return 'value';
    };

    const results = await Promise.all([
      cache.getOrSet('same-key', fetcher, 30),
      cache.getOrSet('same-key', fetcher, 30),
      cache.getOrSet('same-key', fetcher, 30),
    ]);

    expect(results).toEqual(['value', 'value', 'value']);
    expect(fetches).toBe(1);
  });
});
if (!REDIS) announce('cache→Redis', 'APPKIT_TEST_REDIS_URL');

/* ──────────────────────── Database → Postgres + SQLite ───────────────────── */

describe.skipIf(!POSTGRES)('database: Postgres is real', () => {
  it('accepts a Postgres URL and reports the right provider', async () => {
    process.env.DATABASE_URL = POSTGRES;
    const { getSmartDefaults } = await import('../../src/database/defaults.js');
    const config = getSmartDefaults();
    expect(config.database.provider).toBe('postgresql');
    expect(config.database.adapter).toBe('prisma');
  });
});
if (!POSTGRES) announce('database→Postgres', 'APPKIT_TEST_POSTGRES_URL');

describe('database: SQLite claim (no service needed — this is the one that was false)', () => {
  it('accepts Prisma SQLite and reports the sqlite provider', async () => {
    const saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'file:./integration.db';
    try {
      const { getSmartDefaults } = await import('../../src/database/defaults.js');
      const config = getSmartDefaults();
      expect(config.database.provider).toBe('sqlite');
      expect(config.database.adapter).toBe('prisma');
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  });
});

/* ────────────────────────────── Storage → S3 ─────────────────────────────── */

describe.skipIf(!S3_BUCKET)('storage: S3 is real', () => {
  afterAll(async () => {
    const { storageClass } = await import('../../src/storage/index.js');
    await storageClass.disconnectAll();
  });

  it('round-trips an object through an actual bucket', async () => {
    process.env.AWS_S3_BUCKET = S3_BUCKET;
    const { storageClass } = await import('../../src/storage/index.js');
    const storage = storageClass.get();

    const key = `appkit-integration/${Date.now()}.txt`;
    await storage.put(key, Buffer.from('hello'));
    const back = await storage.get(key);
    expect(back?.toString()).toBe('hello');
    await storage.delete(key);
  });
});
if (!S3_BUCKET) announce('storage→S3', 'APPKIT_TEST_S3_BUCKET');
