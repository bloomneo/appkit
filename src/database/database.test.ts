/**
 * Vitest tests for the database module.
 * These tests verify the public API surface without requiring a real database.
 * @file src/database/database.test.ts
 */

import { describe, it, expect } from 'vitest';
import { databaseClass } from './index.js';
import { getSmartDefaults } from './defaults.js';

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'getTenants', 'health', 'list', 'exists',
    'create', 'delete', 'disconnectAll', 'tenant', 'bypass',
  ];

  // Class-level methods that MUST NOT exist. Drift trap for docs that assume
  // query/transaction helpers live on databaseClass instead of the client
  // returned by .get().
  const HALLUCINATED_CLASS = [
    'query', 'transaction', 'model', 'connect', 'close',
    'put', 'update', 'findMany', 'raw',
    'disconnect',   // renamed to disconnectAll() in 4.0.0 — one teardown verb across package
    'org',          // per-org databases removed in 6.0
  ];

  for (const m of CLASS_METHODS) {
    it(`databaseClass.${m} exists and is a function`, () => {
      expect(typeof (databaseClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`databaseClass.${m} does NOT exist`, () => {
      expect(typeof (databaseClass as any)[m]).not.toBe('function');
    });
  }
});

describe('databaseClass.create() — tenant ID validation', () => {
  it('rejects empty string', async () => {
    await expect(databaseClass.create('')).rejects.toThrow(/Tenant ID is required/);
  });

  it('rejects invalid characters', async () => {
    await expect(databaseClass.create('acme org!')).rejects.toThrow(/Invalid tenant ID format/);
    await expect(databaseClass.create('acme/org')).rejects.toThrow(/Invalid tenant ID format/);
  });

  it('accepts alphanumeric, underscore, hyphen', async () => {
    // No DATABASE_URL wiring needed — create() is a format validator in
    // row-level strategy; it doesn't touch the DB.
    await expect(databaseClass.create('tenant-1')).resolves.toBeUndefined();
    await expect(databaseClass.create('tenant_1')).resolves.toBeUndefined();
    await expect(databaseClass.create('tenantA1B2')).resolves.toBeUndefined();
  });
});

describe('databaseClass.delete() — safety rails', () => {
  it('refuses delete without confirm:true option', async () => {
    await expect(
      databaseClass.delete('t1', {}),
    ).rejects.toThrow(/confirm|Confirmation/i);
  });

  it('refuses delete without tenant ID', async () => {
    await expect(
      databaseClass.delete('', { confirm: true }),
    ).rejects.toThrow(/Tenant ID is required/);
  });
});

describe('databaseClass.get() — DATABASE_URL requirement', () => {
  it('throws DatabaseError when DATABASE_URL is not set', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(databaseClass.get()).rejects.toThrow(/Database URL required/);
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });

  it('throws thrown-error has DatabaseError shape (code + module)', async () => {
    const { DatabaseError } = await import('./index.js');
    const { AppKitError } = await import('../internal/errors.js');
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await databaseClass.get();
      expect.fail('expected throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(DatabaseError);
      expect(err).toBeInstanceOf(AppKitError);
      expect(err.code).toBe('DATABASE_MISSING_URL');
      expect(err.module).toBe('database');
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });
});

describe('BLOOM_DB_TENANT detection', () => {
  // detectTenant is internal but observable via req context tenant detection.
  // These tests only verify detectTenant's preconditions; integration-style
  // query-filtering tests would require a real DB and live in cookbook/.
  it('without BLOOM_DB_TENANT, req context is ignored (detectTenant returns null)', async () => {
    const saved = process.env.BLOOM_DB_TENANT;
    delete process.env.BLOOM_DB_TENANT;
    try {
      // Indirect: create() doesn't throw because tenant detection is skipped
      // entirely when BLOOM_DB_TENANT is unset.
      await expect(databaseClass.create('acme')).resolves.toBeUndefined();
    } finally {
      if (saved !== undefined) process.env.BLOOM_DB_TENANT = saved;
    }
  });

  it('with BLOOM_DB_TENANT=auto, module does not crash on setup', () => {
    const saved = process.env.BLOOM_DB_TENANT;
    process.env.BLOOM_DB_TENANT = 'auto';
    try {
      expect(typeof databaseClass.tenant).toBe('function');
    } finally {
      if (saved !== undefined) process.env.BLOOM_DB_TENANT = saved;
      else delete process.env.BLOOM_DB_TENANT;
    }
  });

  it('accepts BLOOM_DB_TENANT=false to silence the safety-net warning', () => {
    const saved = process.env.BLOOM_DB_TENANT;
    process.env.BLOOM_DB_TENANT = 'false';
    try {
      // Just asserting no crash on module access with BLOOM_DB_TENANT=false.
      expect(typeof databaseClass.get).toBe('function');
    } finally {
      if (saved !== undefined) process.env.BLOOM_DB_TENANT = saved;
      else delete process.env.BLOOM_DB_TENANT;
    }
  });
});

describe('SQLite via Prisma (regression — 4.0.1)', () => {
  // Prisma's SQLite datasource format is `file:./dev.db`, not `sqlite://`.
  // Before 4.0.1 the validator required a `://` authority and rejected `..`,
  // so no valid Prisma SQLite URL could pass and appkit + Prisma + SQLite was
  // impossible — despite the docs advertising SQLite support.
  const withUrl = <T>(url: string, fn: () => T): T => {
    const saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    try {
      return fn();
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
      else delete process.env.DATABASE_URL;
    }
  };

  const ACCEPTED = [
    'file:./dev.db',
    'file:/absolute/path/app.db',
    'file:../../app.db', // relative parents are legitimate in a local path
    'postgresql://user:pass@localhost:5432/db',
    'mysql://user:pass@localhost:3306/db',
    'mongodb+srv://user:pass@cluster.mongodb.net/db',
  ];

  for (const url of ACCEPTED) {
    it(`accepts ${url}`, () => {
      expect(() => withUrl(url, () => getSmartDefaults())).not.toThrow();
    });
  }

  const REJECTED = ['', 'not-a-url', 'file:', 'postgresql://host/<script>'];

  for (const url of REJECTED) {
    it(`rejects ${url || '(empty)'}`, () => {
      expect(() => withUrl(url, () => getSmartDefaults())).toThrow();
    });
  }

  it('detects sqlite from a file: URL', () => {
    const cfg = withUrl('file:./dev.db', () => getSmartDefaults());
    expect(cfg.database.provider).toBe('sqlite');
    expect(cfg.database.adapter).toBe('prisma');
  });

  it('still rejects path traversal in network URLs', () => {
    expect(() => withUrl('postgresql://host/../etc', () => getSmartDefaults())).toThrow();
  });
});

describe('scoped access — fail closed (5.0)', () => {
  // Pre-5.0, a call that failed to resolve a tenant returned EVERY row and
  // looked like it worked. A production audit found 4 of 44 route files in
  // exactly that state. These guards run before any connection is opened, so
  // they are testable without a database — which is also why they are the
  // right place to enforce the invariant.
  const withEnv = (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn().finally(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
  };

  const TENANT_ON = { BLOOM_DB_TENANT: 'auto', DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('tenant() refuses a request with no resolvable tenant', async () => {
    await withEnv(TENANT_ON, async () => {
      await expect(databaseClass.tenant({ headers: {} }, async () => 'nope')).rejects.toThrow(
        /No tenant resolved/,
      );
    });
  });

  it('tenant() reads tenantId from the login token claim (4.2.0 shape)', async () => {
    await withEnv(TENANT_ON, async () => {
      // Resolution succeeds, so it proceeds past the guard and fails later on
      // the connection instead — proving the claim was picked up.
      await expect(
        databaseClass.tenant({ headers: {}, user: { userId: 'u1', tenantId: 'firm-1' } }, async () => 'ok'),
      ).rejects.not.toThrow(/No tenant resolved/);
    });
  });

  it('tenant() still honours the pre-4.2 tenant_id shape', async () => {
    await withEnv(TENANT_ON, async () => {
      await expect(
        databaseClass.tenant({ headers: {}, user: { userId: 'u1', tenant_id: 'firm-1' } }, async () => 'ok'),
      ).rejects.not.toThrow(/No tenant resolved/);
    });
  });

  it('tenant() ignores caller-controlled tenant sources — header, param, query, subdomain (6.0)', async () => {
    await withEnv(TENANT_ON, async () => {
      const spoofed = {
        headers: { 'x-tenant-id': 'victim', host: 'victim.app.example.com' },
        params: { tenantId: 'victim' },
        query: { tenant: 'victim' },
      };
      await expect(databaseClass.tenant(spoofed, async () => 'nope')).rejects.toThrow(/No tenant resolved/);
      await expect(databaseClass.get(spoofed)).rejects.toThrow(/no tenant resolved/);
    });
  });

  it('tenant() requires a callback', async () => {
    await withEnv(TENANT_ON, async () => {
      await expect(databaseClass.tenant({ headers: {} }, undefined as any)).rejects.toThrow(/needs a callback/);
    });
  });

  it('bypass() demands a specific reason — an unexplained bypass is a forgotten scope', async () => {
    await withEnv(TENANT_ON, async () => {
      await expect(databaseClass.bypass('', async () => 'x')).rejects.toThrow(/needs a specific reason/);
      await expect(databaseClass.bypass('  ', async () => 'x')).rejects.toThrow(/needs a specific reason/);
      await expect(databaseClass.bypass('ok', async () => 'x')).rejects.toThrow(/needs a specific reason/);
    });
  });

  it('bypass() requires a callback', async () => {
    await withEnv(TENANT_ON, async () => {
      await expect(databaseClass.bypass('platform admin report', undefined as any)).rejects.toThrow(
        /needs a callback/,
      );
    });
  });

  it('get() with no context throws in tenant mode instead of returning everything', async () => {
    await withEnv(TENANT_ON, async () => {
      await expect(databaseClass.get()).rejects.toThrow(/no tenant resolved for this call/i);
    });
  });

  it('get() is unchanged when tenant mode is off', async () => {
    await withEnv({ BLOOM_DB_TENANT: 'false', DATABASE_URL: 'postgresql://u:p@localhost:5432/db' }, async () => {
      // No tenant guard — it gets as far as the connection attempt.
      await expect(databaseClass.get()).rejects.not.toThrow(/no tenant resolved/i);
    });
  });
});

describe('single-tenant apps are unaffected (5.0)', () => {
  // The 5.0 guard is opt-in breakage: it only bites apps that asked for
  // multi-tenancy. An app that never sets BLOOM_DB_TENANT keeps the pre-5.0
  // behaviour exactly.
  const withEnv = (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn().finally(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
  };

  const DB = 'postgresql://u:p@localhost:5432/db';

  for (const mode of [undefined, 'false']) {
    it(`get() has no tenant guard when BLOOM_DB_TENANT is ${mode ?? 'unset'}`, async () => {
      await withEnv({ BLOOM_DB_TENANT: mode, DATABASE_URL: DB }, async () => {
        await expect(databaseClass.get()).rejects.not.toThrow(/tenant/i);
      });
    });
  }

  it('tenant() tells a single-tenant app to use get() instead of hunting for a missing claim', async () => {
    await withEnv({ BLOOM_DB_TENANT: undefined, DATABASE_URL: DB }, async () => {
      await expect(
        databaseClass.tenant({ headers: {}, user: { userId: 'u1' } }, async () => 'x'),
      ).rejects.toThrow(/Single-tenant apps should use databaseClass.get\(\)/);
    });
  });

  it('bypass() works without tenant mode and stays silent about it', async () => {
    await withEnv({ BLOOM_DB_TENANT: undefined, DATABASE_URL: DB }, async () => {
      await expect(databaseClass.bypass('nightly export', async () => 'x')).rejects.not.toThrow(/reason/);
    });
  });
});
