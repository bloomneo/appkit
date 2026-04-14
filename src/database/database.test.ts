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
    'create', 'delete', 'disconnect',
  ];

  // Class-level methods that MUST NOT exist. Drift trap for docs that assume
  // query/transaction helpers live on databaseClass instead of the client
  // returned by .get().
  const HALLUCINATED_CLASS = [
    'query', 'transaction', 'model', 'connect', 'close',
    'put', 'update', 'findMany', 'raw',
  ];

  // Methods available on the instance returned by databaseClass.org(id).
  const ORG_INSTANCE_METHODS = ['get', 'getTenants'];

  // Methods that MUST NOT exist on the OrgDatabase instance.
  const HALLUCINATED_ORG_INSTANCE = [
    'list', 'exists', 'create', 'delete', 'health', 'disconnect',
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
