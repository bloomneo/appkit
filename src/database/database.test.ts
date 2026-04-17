/**
 * Vitest tests for the database module.
 * These tests verify the public API surface without requiring a real database.
 * @file src/database/database.test.ts
 */

import { describe, it, expect } from 'vitest';
import { databaseClass } from './index.js';

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'getTenants', 'org', 'health', 'list', 'exists',
    'create', 'delete', 'disconnectAll',
  ];

  // Class-level methods that MUST NOT exist. Drift trap for docs that assume
  // query/transaction helpers live on databaseClass instead of the client
  // returned by .get().
  const HALLUCINATED_CLASS = [
    'query', 'transaction', 'model', 'connect', 'close',
    'put', 'update', 'findMany', 'raw',
    'disconnect',   // renamed to disconnectAll() in 4.0.0 — one teardown verb across package
  ];

  // Methods available on the instance returned by databaseClass.org(id).
  const ORG_INSTANCE_METHODS = ['get', 'getTenants'];

  // Methods that MUST NOT exist on the OrgDatabase instance.
  const HALLUCINATED_ORG_INSTANCE = [
    'list', 'exists', 'create', 'delete', 'health', 'disconnect', 'disconnectAll',
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

  const org = databaseClass.org('test-org');
  for (const m of ORG_INSTANCE_METHODS) {
    it(`databaseClass.org().${m} exists and is a function`, () => {
      expect(typeof (org as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_ORG_INSTANCE) {
    it(`databaseClass.org().${m} does NOT exist`, () => {
      expect(typeof (org as any)[m]).not.toBe('function');
    });
  }
});

describe('databaseClass.org()', () => {
  it('returns an object with get() and getTenants()', () => {
    const org = databaseClass.org('acme');
    expect(typeof org.get).toBe('function');
    expect(typeof org.getTenants).toBe('function');
  });

  it('accepts various org name formats', () => {
    expect(() => databaseClass.org('test-org')).not.toThrow();
  });

  it('throws when org ID is missing or wrong type', () => {
    expect(() => databaseClass.org('' as any)).toThrow(/Organization ID is required/);
    expect(() => databaseClass.org(null as any)).toThrow(/Organization ID is required/);
  });
});

describe('databaseClass.create() — tenant ID validation', () => {
  it('rejects empty string', async () => {
    await expect(databaseClass.create('', null)).rejects.toThrow(/Tenant ID is required/);
  });

  it('rejects invalid characters', async () => {
    await expect(databaseClass.create('acme org!', null)).rejects.toThrow(/Invalid tenant ID format/);
    await expect(databaseClass.create('acme/org', null)).rejects.toThrow(/Invalid tenant ID format/);
  });

  it('accepts alphanumeric, underscore, hyphen', async () => {
    // No DATABASE_URL wiring needed — create() is a format validator in
    // row-level strategy; it doesn't touch the DB.
    await expect(databaseClass.create('tenant-1', null)).resolves.toBeUndefined();
    await expect(databaseClass.create('tenant_1', null)).resolves.toBeUndefined();
    await expect(databaseClass.create('tenantA1B2', null)).resolves.toBeUndefined();
  });
});

describe('databaseClass.delete() — safety rails', () => {
  it('refuses delete without confirm:true option', async () => {
    await expect(
      databaseClass.delete('t1', {}, null),
    ).rejects.toThrow(/confirm|Confirmation/i);
  });

  it('refuses delete without tenant ID', async () => {
    await expect(
      databaseClass.delete('', { confirm: true }, null),
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
    const { AppKitError } = await import('../util/errors.js');
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
      await expect(databaseClass.create('acme', null)).resolves.toBeUndefined();
    } finally {
      if (saved !== undefined) process.env.BLOOM_DB_TENANT = saved;
    }
  });

  it('with BLOOM_DB_TENANT=auto, module does not crash on setup', () => {
    const saved = process.env.BLOOM_DB_TENANT;
    process.env.BLOOM_DB_TENANT = 'auto';
    try {
      expect(() => databaseClass.org('acme')).not.toThrow();
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
