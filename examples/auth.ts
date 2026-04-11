/**
 * CANONICAL PATTERN — JWT auth with role-based middleware.
 *
 * Verified against src/auth/README.md (lines 426-479: API Reference)
 * and src/auth/auth.ts (real public method signatures).
 *
 * Two token types: LOGIN tokens for users, API tokens for services.
 * Middleware chains: `requireLoginToken()` FIRST, then `requireUserRoles()`
 * — never the reverse, never standalone, never with API tokens.
 *
 * Required env: BLOOM_AUTH_SECRET (min 32 chars)
 */

import { authClass } from '@bloomneo/appkit/auth';
import type {
  ExpressRequest,
  ExpressResponse,
  ExpressMiddleware,
} from '@bloomneo/appkit/auth';

const auth = authClass.get();

// ── Token generation ────────────────────────────────────────────────

// Login token: for human users (web/mobile login). 7-day expiry typical.
const loginToken: string = auth.generateLoginToken(
  {
    userId: 123,
    role: 'user',
    level: 'basic',
  },
  '7d',
);

// API token: for services / webhooks / integrations. 1-year expiry typical.
//
// IMPORTANT: the role.level you pass MUST exist in the configured role
// hierarchy or generateApiToken throws "Invalid role.level". The default
// hierarchy ships with `user.basic` → `admin.system` (9 user roles, no
// service roles). For service tokens you have two options:
//
//   1. Use one of the default roles (e.g. `admin.system`) — what we do here.
//   2. Register custom service roles via the BLOOM_AUTH_ROLES env var, e.g.
//      BLOOM_AUTH_ROLES=user.basic:1,...,service.webhook:10
//      and then pass `role: 'service', level: 'webhook'` here.
//
// Option 1 is simpler when the API token holder needs full system access.
// Option 2 is correct when you want narrower scopes for different services.
const apiToken: string = auth.generateApiToken(
  {
    keyId: 'webhook_payment_service',
    role: 'admin',
    level: 'system',
  },
  '1y',
);

// ── Middleware (use these in route definitions) ─────────────────────

// 1. Authenticate ANY logged-in user
const protectAuthenticated: ExpressMiddleware = auth.requireLoginToken();

// 2. Require specific user role (chained AFTER requireLoginToken)
const requireAdmin: ExpressMiddleware = auth.requireUserRoles(['admin.tenant']);

// 3. Require any of multiple roles (OR semantics)
const requireAdminOrOrg: ExpressMiddleware = auth.requireUserRoles([
  'admin.tenant',
  'admin.org',
]);

// 4. Require specific permissions (AND semantics across the array)
const requireUserManagement: ExpressMiddleware = auth.requireUserPermissions([
  'manage:users',
  'edit:tenant',
]);

// 5. API token authentication (services only — DO NOT chain with requireUserRoles)
const protectApi: ExpressMiddleware = auth.requireApiToken();

// ── Route handlers (called by Express after middleware passes) ──────

// Login handler: bcrypt check + token issue
async function loginHandler(req: ExpressRequest, res: ExpressResponse) {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  // Look up the user from your database. Placeholder.
  const user = {
    id: 1,
    email,
    passwordHash: '$2b$10$placeholder',
    role: 'user',
    level: 'basic',
  };

  const valid = await auth.comparePassword(password ?? '', user.passwordHash);
  if (!valid) {
    res.status?.(401).json?.({ error: 'Invalid credentials' });
    return;
  }

  const token = auth.generateLoginToken({
    userId: user.id,
    role: user.role,
    level: user.level,
  });

  res.json?.({ token });
}

// Registration handler: bcrypt hash + token issue
async function registerHandler(req: ExpressRequest, res: ExpressResponse) {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  const hashedPassword = await auth.hashPassword(password ?? '');
  // Save { email, password: hashedPassword } to your database. Placeholder.
  void hashedPassword;
  void email;
  const newUserId = 42;

  const token = auth.generateLoginToken({
    userId: newUserId,
    role: 'user',
    level: 'basic',
  });

  res.json?.({ token });
}

// Authenticated handler: extract user safely from req
function profileHandler(req: ExpressRequest, res: ExpressResponse) {
  const user = auth.user(req);  // null-safe; non-null after requireLoginToken
  if (!user) {
    res.status?.(401).json?.({ error: 'Not authenticated' });
    return;
  }
  res.json?.({ user });
}

// ── Programmatic role hierarchy check (outside middleware) ──────────

const orgIncludesTenant: boolean = auth.hasRole('admin.org', 'admin.tenant');  // true
const userIsAdmin: boolean = auth.hasRole('user.basic', 'admin.tenant');       // false

// ── Verify a token manually (outside middleware) ────────────────────
//
// `verifyToken` is what the middleware uses internally. You normally don't
// call it yourself — `requireLoginToken()` and `requireApiToken()` handle
// it for you. Use this only when you need to validate a token in a
// non-Express context (e.g. WebSocket auth, queue worker auth, scheduled
// task auth). Throws on bad token; never returns null.
function verifyTokenManually(rawToken: string) {
  try {
    const payload = auth.verifyToken(rawToken);
    // payload.userId is set for login tokens; payload.keyId is set for API tokens.
    // payload.type tells you which: 'login' or 'api_key'.
    return payload;
  } catch (e) {
    // Possible messages: 'Token has expired', 'Invalid token',
    // 'Token must be a string', 'Token verification failed: ...'
    return null;
  }
}

// ── Permission check with inheritance (auth.can) ────────────────────
//
// `can` checks fine-grained permissions on a user payload. Permission format
// is `action:scope` (e.g. 'edit:tenant', 'manage:users'). Inheritance rule:
// `manage:scope` automatically grants `view:scope`, `edit:scope`,
// `delete:scope`, etc. for the same scope.
//
// Use this inside a route handler AFTER `requireLoginToken()` middleware
// has validated the user and attached the payload.
function permissionCheckHandler(req: ExpressRequest, res: ExpressResponse) {
  const user = auth.user(req);
  if (!user) {
    res.status?.(401).json?.({ error: 'Not authenticated' });
    return;
  }

  // Check if the user can edit their tenant. Returns true if the user has
  // 'edit:tenant' OR 'manage:tenant' (manage inherits all actions).
  const canEdit: boolean = auth.can(user, 'edit:tenant');
  if (!canEdit) {
    res.status?.(403).json?.({ error: 'Cannot edit tenant' });
    return;
  }

  res.json?.({ allowed: true });
}

// ── Express wiring (commented — uncomment in your app) ──────────────
//
//   import express from 'express';
//   const app = express();
//
//   app.post('/login', loginHandler);
//   app.post('/register', registerHandler);
//
//   // User route: login + role required
//   app.get(
//     '/admin/users',
//     auth.requireLoginToken(),
//     auth.requireUserRoles(['admin.tenant']),
//     profileHandler,
//   );
//
//   // API route: API token only (no user roles)
//   app.post('/webhook/payment', auth.requireApiToken(), (req, res) => {
//     res.json({ ok: true });
//   });

export {
  auth,
  loginToken,
  apiToken,
  protectAuthenticated,
  requireAdmin,
  requireAdminOrOrg,
  requireUserManagement,
  protectApi,
  verifyTokenManually,
  permissionCheckHandler,
  loginHandler,
  registerHandler,
  profileHandler,
  orgIncludesTenant,
  userIsAdmin,
};
