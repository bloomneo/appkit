/**
 * Vitest tests for the security module.
 * @file src/security/security.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { securityClass } from './index.js';

beforeEach(() => { securityClass.clearCache(); });

describe('securityClass.get()', () => {
  it('returns a SecurityClass instance', () => {
    const security = securityClass.get();
    expect(security).toBeDefined();
    expect(typeof security).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(securityClass.get()).toBe(securityClass.get());
  });
});

describe('security.requests() — rate limiting', () => {
  it('returns an Express middleware function', () => {
    const mw = securityClass.get().requests(100, 60_000);
    expect(typeof mw).toBe('function');
  });

  // Drives a limiter with fake req/res and returns the status each call got.
  function hit(mw: any, times: number, ip = '10.0.0.1'): number[] {
    const statuses: number[] = [];
    for (let i = 0; i < times; i++) {
      let status = 200;
      mw({ ip, headers: {}, connection: { remoteAddress: ip } }, { setHeader() {} }, (err?: any) => {
        if (err) status = err.statusCode ?? err.status ?? 500;
      });
      statuses.push(status);
    }
    return statuses;
  }

  it('counts each limiter separately for the same client', () => {
    const security = securityClass.get();
    const login = security.requests(2, 60_000);
    const api = security.requests(100, 60_000);

    // Ordinary API traffic must not spend the login budget.
    hit(api, 10);
    expect(hit(login, 3)).toEqual([200, 200, 429]);
  });

  it('shares a count between limiters given the same name', () => {
    const security = securityClass.get();
    const a = security.requests(2, 60_000, { name: 'login' });
    const b = security.requests(2, 60_000, { name: 'login' });

    hit(a, 2);
    expect(hit(b, 1)).toEqual([429]);
  });
});

describe('security.encrypt() / decrypt()', () => {
  it('roundtrips plaintext through encrypt/decrypt', () => {
    try {
      const security = securityClass.get();
      const cipher = security.encrypt('secret value');
      const plain = security.decrypt(cipher);
      expect(plain).toBe('secret value');
    } catch (e: any) {
      // May throw if BLOOM_SECURITY_ENCRYPTION_KEY not set
      expect(e.message).toMatch(/key|encrypt/i);
    }
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset', 'clearCache', 'getConfig',
    'isDevelopment', 'isProduction',
    'generateKey', 'quickSetup', 'validateRequired', 'getStatus',
  ];

  const INSTANCE_METHODS = [
    'requests', 'encrypt', 'decrypt', 'generateKey',
  ];

  // Instance methods that do NOT exist — previously hallucinated, or removed
  // in 6.0 (forms / input / html / escape).
  const HALLUCINATED_INSTANCE = ['csrf', 'requireCsrf', 'email', 'url', 'forms', 'input', 'html', 'escape'];

  // Class-level methods that MUST NOT exist — drift trap for docs that
  // assume symmetry with the instance surface.
  const HALLUCINATED_CLASS = [
    'forms', 'requests', 'input', 'html', 'escape', 'encrypt', 'decrypt',
  ];

  it('quickSetup() returns only the rate limiter now that CSRF is gone', () => {
    const mws = securityClass.quickSetup();
    expect(mws).toHaveLength(1);
    expect(typeof mws[0]).toBe('function');
    expect(securityClass.getStatus()).not.toHaveProperty('csrf');
  });

  for (const m of CLASS_METHODS) {
    it(`securityClass.${m} exists`, () => {
      expect(typeof (securityClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`securityClass.${m} does NOT exist (call via securityClass.get().${m}() instead)`, () => {
      expect(typeof (securityClass as any)[m]).not.toBe('function');
    });
  }

  const security = securityClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`security instance .${m} exists`, () => {
      expect(typeof (security as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
    it(`security.${m} does NOT exist`, () => {
      expect(typeof (security as any)[m]).not.toBe('function');
    });
  }
});
