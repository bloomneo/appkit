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

  for (const m of CLASS_METHODS) {
    it(`databaseClass.${m} exists and is a function`, () => {
      expect(typeof (databaseClass as any)[m]).toBe('function');
    });
  }
});

describe('databaseClass.org()', () => {
  it('returns an object with get() and getTenants()', () => {
    const org = databaseClass.org('acme');
    expect(typeof org.get).toBe('function');
    expect(typeof org.getTenants).toBe('function');
  });

  it('throws or returns object for different org names', () => {
    expect(() => databaseClass.org('test-org')).not.toThrow();
  });
});
