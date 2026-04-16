/**
 * tests/public-surface.test.ts
 *
 * Top-level consumer-surface assertions: import every module the way a
 * real consumer would, and assert the full exported shape.
 *
 * Catches in one place:
 *   - Missing re-exports (queue missed QueueClass + default export).
 *   - Wrong default export (storage shipped `export default StorageClass` —
 *     the class — when every other module ships the lowercase singleton).
 *   - Missing `.get()` on any module.
 *   - Drift between the flat `@bloomneo/appkit` entry and each deep entry.
 *
 * These bugs are not caught by each module's own test file because tests
 * inside a module import directly from source, bypassing the published
 * entry-point shape.
 */

import { describe, expect, it } from 'vitest';

// Flat entry — the "convenience" import consumers reach for first.
import * as root from '../src/index.js';

// Deep entries — one per module, exercised through each module's own index.ts.
// Auth's class is exported as `AuthenticationClass` (not `AuthClass`) — that's
// the original class name and is preserved for continuity; the canonical
// entry is `authClass.get()` either way.
import authDefault, { authClass, AuthenticationClass } from '../src/auth/index.js';
import cacheDefault, { cacheClass, CacheClass, CacheError } from '../src/cache/index.js';
import configDefault, { configClass, ConfigClass }   from '../src/config/index.js';
import databaseDefault, { databaseClass }            from '../src/database/index.js';
import emailDefault, { emailClass, EmailClass }      from '../src/email/index.js';
import errorDefault, { errorClass, ErrorClass }      from '../src/error/index.js';
import eventDefault, { eventClass, EventClass }      from '../src/event/index.js';
import loggerDefault, { loggerClass, LoggerClass }   from '../src/logger/index.js';
import queueDefault, { queueClass, QueueClass }      from '../src/queue/index.js';
import securityDefault, { securityClass, SecurityClass } from '../src/security/index.js';
import storageDefault, { storageClass, StorageClass } from '../src/storage/index.js';
import utilDefault, { utilClass, UtilClass }         from '../src/util/index.js';

/**
 * Every public class constant the flat `@bloomneo/appkit` entry must export.
 * If this list grows or shrinks, a module was added or removed — update
 * `src/index.ts` and this list together.
 */
const EXPECTED_FLAT_EXPORTS = [
  'authClass',
  'cacheClass',
  'configClass',
  'databaseClass',
  'emailClass',
  'errorClass',
  'eventClass',
  'loggerClass',
  'queueClass',
  'securityClass',
  'storageClass',
  'utilClass',
] as const;

describe('Flat entry — @bloomneo/appkit', () => {
  for (const name of EXPECTED_FLAT_EXPORTS) {
    it(`exports ${name}`, () => {
      expect((root as any)[name], `${name} missing from src/index.ts`).toBeDefined();
    });

    it(`${name}.get is a function`, () => {
      const obj = (root as any)[name];
      expect(typeof obj.get).toBe('function');
    });
  }

  it('exports no unexpected module-level classes (keeps the surface tight)', () => {
    const extras = Object.keys(root).filter(
      (k) =>
        k.endsWith('Class') &&
        !EXPECTED_FLAT_EXPORTS.includes(k as (typeof EXPECTED_FLAT_EXPORTS)[number]),
    );
    expect(extras, `Unexpected *Class exports: ${extras.join(', ')}`).toEqual([]);
  });
});

describe('Deep entries — every xxxClass.get is a function', () => {
  // Tests that the per-module deep entry (@bloomneo/appkit/<mod>) exposes
  // the canonical `xxxClass.get()` entry point. A missing `.get` would
  // break the single-pattern rule in NAMING.md §Module-Level-Exports.
  const deepEntries = [
    ['authClass',     authClass],
    ['cacheClass',    cacheClass],
    ['configClass',   configClass],
    ['databaseClass', databaseClass],
    ['emailClass',    emailClass],
    ['errorClass',    errorClass],
    ['eventClass',    eventClass],
    ['loggerClass',   loggerClass],
    ['queueClass',    queueClass],
    ['securityClass', securityClass],
    ['storageClass',  storageClass],
    ['utilClass',     utilClass],
  ] as const;

  for (const [name, obj] of deepEntries) {
    it(`${name}.get is a function`, () => {
      expect(typeof (obj as any).get).toBe('function');
    });
  }
});

describe('Flat entry matches deep entries (no drift)', () => {
  // If a consumer imports cacheClass from the flat entry and another
  // consumer imports it from the deep entry, they must get the exact
  // same object. This caught a past regression where two different
  // singletons were constructed because the flat entry re-wrapped
  // the deep export.
  it.each([
    ['authClass',     authClass],
    ['cacheClass',    cacheClass],
    ['configClass',   configClass],
    ['databaseClass', databaseClass],
    ['emailClass',    emailClass],
    ['errorClass',    errorClass],
    ['eventClass',    eventClass],
    ['loggerClass',   loggerClass],
    ['queueClass',    queueClass],
    ['securityClass', securityClass],
    ['storageClass',  storageClass],
    ['utilClass',     utilClass],
  ])('%s from flat entry === from deep entry', (name, deep) => {
    expect((root as any)[name]).toBe(deep);
  });
});

describe('Default exports — every module ships the singleton, not the class', () => {
  // Every module ships `export default xxxClass` (the lowercase singleton).
  // Shipping the class instead broke in the storage audit; shipping nothing
  // breaks `import xxxClass from '@bloomneo/appkit/<mod>'` as a convenience.
  // This test asserts both: the default exists AND it's the singleton.
  it('auth default === authClass',         () => expect(authDefault).toBe(authClass));
  it('cache default === cacheClass',       () => expect(cacheDefault).toBe(cacheClass));
  it('config default === configClass',     () => expect(configDefault).toBe(configClass));
  it('database default === databaseClass', () => expect(databaseDefault).toBe(databaseClass));
  it('email default === emailClass',       () => expect(emailDefault).toBe(emailClass));
  it('error default === errorClass',       () => expect(errorDefault).toBe(errorClass));
  it('event default === eventClass',       () => expect(eventDefault).toBe(eventClass));
  it('logger default === loggerClass',     () => expect(loggerDefault).toBe(loggerClass));
  it('queue default === queueClass',       () => expect(queueDefault).toBe(queueClass));
  it('security default === securityClass', () => expect(securityDefault).toBe(securityClass));
  it('storage default === storageClass',   () => expect(storageDefault).toBe(storageClass));
  it('util default === utilClass',         () => expect(utilDefault).toBe(utilClass));
});

describe('Class re-exports — available for advanced consumers', () => {
  // Modules that expose a subclass-friendly class for advanced consumers
  // (custom strategies, tests bypassing the singleton).
  //
  // Not every module ships one:
  // - `database` is an adapter factory — no single class to subclass; uses
  //   per-provider adapters (PrismaAdapter, MongooseAdapter) internally.
  // - `error` is a value factory — ErrorClass IS exported but usually not
  //   what a consumer reaches for. Keeping it here for symmetry.
  //
  // Auth's class is `AuthenticationClass` (historical name, kept for
  // continuity). Everything else follows the `XxxClass` pattern.
  it('auth re-exports AuthenticationClass', () => expect(typeof AuthenticationClass).toBe('function'));
  it('cache re-exports CacheClass',         () => expect(typeof CacheClass).toBe('function'));
  it('cache re-exports CacheError',         () => expect(typeof CacheError).toBe('function'));
  it('config re-exports ConfigClass',       () => expect(typeof ConfigClass).toBe('function'));
  it('email re-exports EmailClass',         () => expect(typeof EmailClass).toBe('function'));
  it('error re-exports ErrorClass',         () => expect(typeof ErrorClass).toBe('function'));
  it('event re-exports EventClass',         () => expect(typeof EventClass).toBe('function'));
  it('logger re-exports LoggerClass',       () => expect(typeof LoggerClass).toBe('function'));
  it('queue re-exports QueueClass',         () => expect(typeof QueueClass).toBe('function'));
  it('security re-exports SecurityClass',   () => expect(typeof SecurityClass).toBe('function'));
  it('storage re-exports StorageClass',     () => expect(typeof StorageClass).toBe('function'));
  it('util re-exports UtilClass',           () => expect(typeof UtilClass).toBe('function'));
});
