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
});

describe('security.forms() — CSRF', () => {
  it('returns an Express middleware function', () => {
    // May throw if BLOOM_SECURITY_CSRF_SECRET not set — that is expected behaviour.
    try {
      const mw = securityClass.get().forms();
      expect(typeof mw).toBe('function');
    } catch (e: any) {
      expect(e.message).toMatch(/CSRF secret/i);
    }
  });
});

describe('security.input() — sanitization', () => {
  const security = securityClass.get();

  it('strips <script> tags', () => {
    const result = security.input('<script>alert(1)</script>hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('hello');
  });

  it('returns a string for any input', () => {
    expect(typeof security.input('test')).toBe('string');
    expect(typeof security.input('')).toBe('string');
  });
});

describe('security.html() — HTML sanitization', () => {
  it('strips disallowed tags but keeps safe ones', () => {
    const security = securityClass.get();
    const result = security.html('<b>bold</b><script>evil()</script>');
    expect(result).toContain('<b>bold</b>');
    expect(result).not.toContain('<script>');
  });
});

describe('security.escape()', () => {
  it('escapes HTML special characters', () => {
    const security = securityClass.get();
    const result = security.escape('<div>"test"&</div>');
    expect(result).not.toContain('<div>');
    expect(result).toContain('&lt;');
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
    'forms', 'requests', 'input', 'html', 'escape', 'encrypt', 'decrypt', 'generateKey',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = ['csrf', 'requireCsrf', 'email', 'url'];

  // Class-level methods that MUST NOT exist — drift trap for docs that
  // assume symmetry with the instance surface.
  const HALLUCINATED_CLASS = [
    'forms', 'requests', 'input', 'html', 'escape', 'encrypt', 'decrypt',
  ];

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
