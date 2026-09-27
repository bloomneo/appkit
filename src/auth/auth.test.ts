/**
 * Vitest tests for the auth module.
 *
 * Co-located with the source it tests so it stays in sync. Run with `npm test`.
 *
 * What this catches:
 *   - Hallucinated method names (every public method is exercised here)
 *   - Wrong argument shapes
 *   - Runtime initialization bugs
 *   - Drift between this file and src/auth/auth.ts
 *
 * If you add or rename a public method on AuthenticationClass, you must
 * update this file in the same change. The tests act as the contract for
 * what the auth module promises consumers.
 *
 * @file src/auth/auth.test.ts
 */

import { describe, it, expect } from 'vitest';

// Env vars (BLOOM_AUTH_SECRET, etc) are set by vitest.setup.ts which runs
// BEFORE any test file is loaded. See vitest.config.js → setupFiles.
import { authClass } from './index.js';

describe('authClass.get()', () => {
  it('returns a non-null AuthenticationClass instance', () => {
    const auth = authClass.get();
    expect(auth).toBeDefined();
    expect(auth).not.toBeNull();
    expect(typeof auth).toBe('object');
  });

  it('returns the same instance across calls (singleton)', () => {
    const a = authClass.get();
    const b = authClass.get();
    expect(a).toBe(b);
  });
});

describe('Token generation', () => {
  const auth = authClass.get();

  describe('generateLoginToken', () => {
    it('returns a JWT string for a valid user payload', () => {
      const token = auth.generateLoginToken(
        { userId: 123, role: 'user', level: 'basic' },
        '7d',
      );
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('uses the default 7d expiry when none is provided', () => {
      const token = auth.generateLoginToken({
        userId: 1,
        role: 'user',
        level: 'basic',
      });
      expect(typeof token).toBe('string');
    });

    it('throws when userId is missing', () => {
      expect(() =>
        auth.generateLoginToken({ role: 'user', level: 'basic' } as any),
      ).toThrow(/userId/i);
    });

    it('throws when role.level is not in the configured hierarchy', () => {
      expect(() =>
        auth.generateLoginToken({
          userId: 1,
          role: 'fake',
          level: 'rolelevel',
        }),
      ).toThrow(/Invalid role.level/);
    });
  });

  describe('generateApiToken', () => {
    it('returns a JWT string for a valid API key payload (admin.system is in default hierarchy)', () => {
      const token = auth.generateApiToken(
        { keyId: 'webhook_test', role: 'admin', level: 'system' },
        '1y',
      );
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('throws when keyId is missing', () => {
      expect(() =>
        auth.generateApiToken({
          role: 'admin',
          level: 'system',
        } as any),
      ).toThrow(/keyId/i);
    });

    it('throws when role.level is not in the configured hierarchy (e.g. service.webhook is NOT in defaults)', () => {
      // This is the canonical bug from src/auth/README.md that we're now testing for.
      // The README used to show role: 'service', level: 'webhook' which throws here.
      expect(() =>
        auth.generateApiToken({
          keyId: 'test',
          role: 'service',
          level: 'webhook',
        }),
      ).toThrow(/Invalid role.level/);
    });
  });
});

describe('verifyToken', () => {
  const auth = authClass.get();

  it('roundtrips a login token to its payload', () => {
    const token = auth.generateLoginToken({
      userId: 42,
      role: 'admin',
      level: 'tenant',
    });
    const payload = auth.verifyToken(token);
    expect(payload.userId).toBe(42);
    expect(payload.role).toBe('admin');
    expect(payload.level).toBe('tenant');
    expect(payload.type).toBe('login');
  });

  it('roundtrips an API token to its payload', () => {
    const token = auth.generateApiToken({
      keyId: 'svc_42',
      role: 'admin',
      level: 'system',
    });
    const payload = auth.verifyToken(token);
    expect(payload.keyId).toBe('svc_42');
    expect(payload.role).toBe('admin');
    expect(payload.level).toBe('system');
    expect(payload.type).toBe('api_key');
  });

  it('throws when given a non-string token', () => {
    expect(() => auth.verifyToken(undefined as any)).toThrow(/string/i);
  });

  it('throws when given a malformed token', () => {
    expect(() => auth.verifyToken('not.a.jwt')).toThrow();
  });
});

describe('Password hashing', () => {
  const auth = authClass.get();

  it('hashPassword returns a bcrypt hash for a non-empty password', async () => {
    const hash = await auth.hashPassword('correct horse battery staple');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('hashPassword throws on empty password', async () => {
    await expect(auth.hashPassword('')).rejects.toThrow();
  });

  it('comparePassword returns true for the correct password', async () => {
    const hash = await auth.hashPassword('correct password');
    const ok = await auth.comparePassword('correct password', hash);
    expect(ok).toBe(true);
  });

  it('comparePassword returns false for the wrong password', async () => {
    const hash = await auth.hashPassword('correct password');
    const ok = await auth.comparePassword('wrong password', hash);
    expect(ok).toBe(false);
  });

  it('comparePassword returns false (does NOT throw) for malformed hash', async () => {
    const ok = await auth.comparePassword('any password', 'not-a-real-hash');
    expect(ok).toBe(false);
  });
});

describe('getUser(req) — null-safe extraction', () => {
  const auth = authClass.get();

  it('returns null for an empty request', () => {
    const user = auth.getUser({ headers: {}, method: 'GET' } as any);
    expect(user).toBeNull();
  });

  it('returns the user object when req.user is populated (login flow)', () => {
    const fakeReq = {
      headers: {},
      method: 'GET',
      user: { userId: 7, role: 'user', level: 'basic', type: 'login' },
    } as any;
    const user = auth.getUser(fakeReq);
    expect(user).not.toBeNull();
    expect(user!.userId).toBe(7);
  });

  it('returns the token object when req.token is populated (API flow)', () => {
    const fakeReq = {
      headers: {},
      method: 'GET',
      token: { keyId: 'svc', role: 'admin', level: 'system', type: 'api_key' },
    } as any;
    const user = auth.getUser(fakeReq);
    expect(user).not.toBeNull();
    expect(user!.keyId).toBe('svc');
  });

  it('bare-noun user() method is renamed — auth.user does NOT exist', () => {
    // NAMING.md bans bare-noun methods. Keep this assertion so docs and
    // consumers cannot silently revert to the old name.
    expect((auth as any).user).toBeUndefined();
  });
});

describe('hasRole — inheritance', () => {
  const auth = authClass.get();

  it('admin.org includes admin.tenant (org > tenant)', () => {
    expect(auth.hasRole('admin.org', 'admin.tenant')).toBe(true);
  });

  it('admin.system includes user.basic (system > basic)', () => {
    expect(auth.hasRole('admin.system', 'user.basic')).toBe(true);
  });

  it('user.basic does NOT include admin.tenant (basic < tenant)', () => {
    expect(auth.hasRole('user.basic', 'admin.tenant')).toBe(false);
  });

  it('admin.tenant equals admin.tenant', () => {
    expect(auth.hasRole('admin.tenant', 'admin.tenant')).toBe(true);
  });

  it('returns false when either role is invalid', () => {
    expect(auth.hasRole('not.real', 'admin.tenant')).toBe(false);
    expect(auth.hasRole('admin.tenant', 'not.real')).toBe(false);
  });
});

describe('Express middleware factories', () => {
  const auth = authClass.get();

  it('requireLoginToken() returns a function', () => {
    const mw = auth.requireLoginToken();
    expect(typeof mw).toBe('function');
  });

  it('requireApiToken() returns a function', () => {
    const mw = auth.requireApiToken();
    expect(typeof mw).toBe('function');
  });

  it('requireUserRoles([...]) returns a function', () => {
    const mw = auth.requireUserRoles(['admin.tenant']);
    expect(typeof mw).toBe('function');
  });

  it('requireUserRoles throws if given an empty array', () => {
    expect(() => auth.requireUserRoles([])).toThrow(/non-empty/i);
  });

  it('requireUserRoles throws if any role.level is invalid', () => {
    expect(() => auth.requireUserRoles(['not.real'])).toThrow(/Invalid role.level/);
  });

});

describe('Public API surface — drift check', () => {
  // This test acts as a contract: it asserts the EXACT set of public methods
  // on AuthenticationClass. If you add or remove a public method, this test
  // will fail and you must update both the test AND the docs (AGENTS.md,
  // llms.txt, src/auth/README.md) at the same time.
  //
  // The drift checker (scripts/check-auth-drift.mjs) walks the docs and
  // verifies every `auth.<method>()` mention exists on this surface.

  const PUBLIC_METHODS = [
    // Token generation
    'generateLoginToken',
    'generateApiToken',
    'verifyToken',
    // Password security
    'hashPassword',
    'comparePassword',
    // User extraction + authorization checks
    'getUser',
    'hasRole',
    'scopedWhere',
    // Express middleware factories
    'requireLoginToken',
    'requireUserRoles',
    'requireApiToken',
  ];

  // Methods that MUST NOT exist on the runtime instance. These are pure
  // hallucinations — names an earlier draft of the docs claimed but which
  // were never real. If any of these become real methods later, this test
  // will fail so we remember to update the docs.
  //
  // NOTE: `signToken` is intentionally NOT in this list. It exists as a
  // TypeScript `private` method on AuthenticationClass, which means:
  //   - The TypeScript compiler will refuse to call `auth.signToken(...)`
  //     from consumer code (compile error TS2341).
  //   - At runtime, the method is still a normal JS property — there's no
  //     real visibility enforcement, only the compile-time check.
  //
  // This is a known TypeScript quirk and not worth refactoring to JS
  // private fields (#signToken) just for the test. Instead, the
  // `scripts/check-auth-drift.mjs` checker enforces that NO documentation
  // file (AGENTS.md, llms.txt, README.md, examples/*.ts) ever mentions
  // `auth.signToken(` — that's the actual contract we care about.
  const HALLUCINATED_METHODS = [
    'requireLogin', // never existed — real name is requireLoginToken
    'requireRole',  // never existed — real name is requireUserRoles
    'user',         // renamed pre-v1 to getUser() per NAMING.md (no bare-noun methods)
    'can',          // renamed pre-v1, then removed with the permissions model in 6.0
    // Removed in 6.0 — permissions model, matrix mode and PII helpers.
    'hasPermission',
    'requireUserPermissions',
    'requireScope',
    'requireTier',
    'roleParts',
    'canSeePII',
    'maskPII',
  ];

  const auth = authClass.get();

  for (const method of PUBLIC_METHODS) {
    it(`auth.${method} exists and is a function`, () => {
      expect(typeof (auth as any)[method]).toBe('function');
    });
  }

  for (const method of HALLUCINATED_METHODS) {
    it(`auth.${method} does NOT exist on the runtime surface`, () => {
      expect(typeof (auth as any)[method]).not.toBe('function');
    });
  }
});

describe('data scope claims (tenantId / clientId) and the linear ladder', () => {
  it('ignores the removed matrix env vars — roles stay on the linear ladder (6.0)', () => {
    const savedScopes = process.env.BLOOM_AUTH_SCOPES;
    const savedTiers = process.env.BLOOM_AUTH_TIERS;
    process.env.BLOOM_AUTH_SCOPES = 'client,tenant,org,system';
    process.env.BLOOM_AUTH_TIERS = 'user,moderator,admin';
    try {
      const auth = authClass.reset();
      expect(auth.hasRole('admin.org', 'admin.tenant')).toBe(true);
      expect(auth.hasRole('admin.tenant', 'admin.org')).toBe(false);
      // A matrix-only pair is not a registered role.level.
      expect(() => auth.generateLoginToken({ userId: 'u1', role: 'moderator', level: 'org' })).toThrow(/Invalid role.level/);
    } finally {
      if (savedScopes === undefined) delete process.env.BLOOM_AUTH_SCOPES;
      else process.env.BLOOM_AUTH_SCOPES = savedScopes;
      if (savedTiers === undefined) delete process.env.BLOOM_AUTH_TIERS;
      else process.env.BLOOM_AUTH_TIERS = savedTiers;
      authClass.reset();
    }
  });

  it('carries tenantId and clientId as data scope', () => {
    const auth = authClass.get();
    const token = auth.generateLoginToken({
      userId: 'u1', role: 'admin', level: 'tenant', tenantId: 'firm-1', clientId: null,
    });
    const decoded = auth.verifyToken(token);
    expect(decoded.tenantId).toBe('firm-1');
    expect(decoded.clientId).toBeNull();
  });

  it('scopedWhere returns the caller binding, and {} for platform', () => {
    const auth = authClass.get();
    expect(auth.scopedWhere({ headers: {}, user: { userId: 'u1', tenantId: 'firm-1', clientId: 'c-9' } } as any))
      .toEqual({ tenantId: 'firm-1', clientId: 'c-9' });
    expect(auth.scopedWhere({ headers: {}, user: { userId: 'u1', tenantId: null, clientId: null } } as any)).toEqual({});
  });

  it('scopedWhere throws instead of returning all data when it cannot tell', () => {
    const auth = authClass.get();
    // No authenticated user.
    expect(() => auth.scopedWhere({ headers: {} } as any)).toThrow(/needs an authenticated user/);
    // A token minted without the claim is not a platform account.
    expect(() => auth.scopedWhere({ headers: {}, user: { userId: 'u1', role: 'admin', level: 'tenant' } } as any))
      .toThrow(/no tenantId claim/);
  });
});
