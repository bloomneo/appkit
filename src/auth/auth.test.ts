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

describe('user(req) — null-safe extraction', () => {
  const auth = authClass.get();

  it('returns null for an empty request', () => {
    const user = auth.user({ headers: {}, method: 'GET' } as any);
    expect(user).toBeNull();
  });

  it('returns the user object when req.user is populated (login flow)', () => {
    const fakeReq = {
      headers: {},
      method: 'GET',
      user: { userId: 7, role: 'user', level: 'basic', type: 'login' },
    } as any;
    const user = auth.user(fakeReq);
    expect(user).not.toBeNull();
    expect(user!.userId).toBe(7);
  });

  it('returns the token object when req.token is populated (API flow)', () => {
    const fakeReq = {
      headers: {},
      method: 'GET',
      token: { keyId: 'svc', role: 'admin', level: 'system', type: 'api_key' },
    } as any;
    const user = auth.user(fakeReq);
    expect(user).not.toBeNull();
    expect(user!.keyId).toBe('svc');
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

describe('can — permission inheritance + replacement', () => {
  const auth = authClass.get();

  // Build a JwtPayload by signing + verifying a token. Pass explicit
  // permissions to test the "explicit replaces defaults" path. Omit them
  // to test the "fall back to role defaults" path.
  function makeUserWithExplicit(perms: string[]) {
    const token = auth.generateLoginToken({
      userId: 1,
      role: 'admin',
      level: 'tenant',
      permissions: perms,
    });
    return auth.verifyToken(token);
  }

  function makeUserWithDefaults() {
    // No explicit permissions — falls back to admin.tenant defaults from
    // src/auth/defaults.ts which include manage:tenant (and inherited).
    const token = auth.generateLoginToken({
      userId: 1,
      role: 'admin',
      level: 'tenant',
    });
    return auth.verifyToken(token);
  }

  it('returns true when user has the exact explicit permission', () => {
    const user = makeUserWithExplicit(['edit:tenant']);
    expect(auth.can(user, 'edit:tenant')).toBe(true);
  });

  it('returns true when user has manage:scope (inherits all actions for that scope)', () => {
    const user = makeUserWithExplicit(['manage:tenant']);
    expect(auth.can(user, 'edit:tenant')).toBe(true);
    expect(auth.can(user, 'view:tenant')).toBe(true);
    expect(auth.can(user, 'delete:tenant')).toBe(true);
  });

  it('NO upward inheritance: edit:scope does NOT grant manage:scope', () => {
    const user = makeUserWithExplicit(['edit:tenant']);
    // Explicit permissions REPLACE role defaults, so admin.tenant's
    // default manage:tenant is NOT consulted. Consumer wanted edit-only,
    // they get edit-only.
    expect(auth.can(user, 'manage:tenant')).toBe(false);
  });

  it('explicit permissions REPLACE role defaults (you CAN downgrade a user)', () => {
    // A user with role='admin', level='tenant' would normally have
    // admin.tenant's default permissions (which include manage:tenant).
    // But because we passed explicit permissions=['view:own'], that array
    // becomes the COMPLETE set — defaults are not consulted.
    const user = makeUserWithExplicit(['view:own']);
    expect(auth.can(user, 'view:own')).toBe(true);
    expect(auth.can(user, 'manage:tenant')).toBe(false);
    expect(auth.can(user, 'edit:tenant')).toBe(false);
  });

  it('explicit empty permissions array completely strips the user (zero permissions)', () => {
    // Edge case: explicit `[]` is still an explicit array, so it replaces
    // defaults. The user has no permissions despite their admin.tenant role.
    const user = makeUserWithExplicit([]);
    expect(auth.can(user, 'view:own')).toBe(false);
    expect(auth.can(user, 'manage:tenant')).toBe(false);
  });

  it('NO explicit permissions falls back to role defaults', () => {
    // When you don't pass a permissions field at all, the user's role.level
    // defaults from the configured RolePermissionConfig apply.
    // admin.tenant's defaults include manage:tenant.
    const user = makeUserWithDefaults();
    expect(auth.can(user, 'manage:tenant')).toBe(true);
    expect(auth.can(user, 'edit:tenant')).toBe(true);  // via manage inheritance
  });

  it('returns false for null user or empty permission', () => {
    const user = makeUserWithExplicit(['edit:tenant']);
    expect(auth.can(null as any, 'edit:tenant')).toBe(false);
    expect(auth.can(user, '')).toBe(false);
  });

  it('throws on malformed permission string (no colon)', () => {
    const user = makeUserWithExplicit(['edit:tenant']);
    expect(() => auth.can(user, 'notvalid')).toThrow(/Invalid permission/);
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

  it('requireUserPermissions([...]) returns a function', () => {
    const mw = auth.requireUserPermissions(['manage:users']);
    expect(typeof mw).toBe('function');
  });

  it('requireUserRoles throws if given an empty array', () => {
    expect(() => auth.requireUserRoles([])).toThrow(/non-empty/i);
  });

  it('requireUserRoles throws if any role.level is invalid', () => {
    expect(() => auth.requireUserRoles(['not.real'])).toThrow(/Invalid role.level/);
  });

  it('requireUserPermissions throws if given an empty array', () => {
    expect(() => auth.requireUserPermissions([])).toThrow(/non-empty/i);
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
    'user',
    'hasRole',
    'can',
    // Express middleware factories
    'requireLoginToken',
    'requireUserRoles',
    'requireUserPermissions',
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
    'requireRole', // never existed — real name is requireUserRoles
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
