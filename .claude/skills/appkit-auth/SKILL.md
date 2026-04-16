---
name: appkit-auth
description: >-
  Use when writing code that authenticates users, issues or verifies JWTs,
  hashes passwords, protects Express/Fastify routes, or checks roles and
  permissions via `@bloomneo/appkit/auth`. Covers the canonical issue →
  verify → protect → extract flow and the role.level hierarchy.
---

# @bloomneo/appkit/auth

Single-entry auth: `authClass.get()` returns an object that does hashing, JWT
issuance/verification, and middleware generation. One import, one call, no
factories.

## Canonical flow

```ts
import 'dotenv/config';   // BLOOM_AUTH_SECRET must be set first
import { authClass } from '@bloomneo/appkit/auth';

const auth = authClass.get();

// 1. Signup
const hash = await auth.hashPassword(password);

// 2. Login
if (await auth.comparePassword(input, hash)) {
  const token = auth.generateLoginToken({
    userId: user.id,
    role: 'user',
    level: 'basic',
    // payload pass-through: any extra JSON-serializable fields are preserved
    email: user.email,
  });
}

// 3. Protect a route
app.get('/me', auth.requireLoginToken(), (req, res) => {
  const u = auth.getUser(req);           // { userId, role, level, email, ... } | null
  res.json({ id: u.userId, email: u.email });
});

// 4. Role-gate a route
app.delete('/users/:id',
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.system']),
  handler,
);
```

## role.level — the one gotcha

Roles have two forms that are easy to confuse:

- **Split form** at token creation: `{ role: 'admin', level: 'tenant' }`
- **Dotted form** at middleware check: `auth.requireUserRoles(['admin.tenant'])`

They refer to the same identity. The dotted form is keyed into the hierarchy;
the split form is what `generateLoginToken` expects. Passing
`role: 'admin.tenant'` to `generateLoginToken` will fail validation.

Default hierarchy (low → high): `user.basic` → `user.pro` → `user.max` →
`moderator.review` → `moderator.manage` → `admin.tenant` → `admin.org` →
`admin.system`. Higher always passes a lower check.

Custom hierarchy: set `BLOOM_AUTH_ROLES=user.basic,user.pro,admin.system`.

## Token types — pick the right one

| Issuer | Method | Required payload | Use case |
|---|---|---|---|
| User login | `generateLoginToken` | `userId`, `role`, `level` | Browser sessions, user auth |
| Service/API | `generateApiToken` | `keyId`, `role`, `level` | Webhooks, service-to-service |

Don't cross them. `generateLoginToken({ keyId })` is wrong. So is
`generateApiToken({ userId })`. They're verified by different middleware
(`requireLoginToken` vs `requireApiToken`).

## Public API — the whole surface

```ts
// Instance (from authClass.get())
auth.hashPassword(password, rounds?)           // → Promise<string>
auth.comparePassword(password, hash)           // → Promise<boolean>
auth.generateLoginToken(payload, expiresIn?)   // → string
auth.generateApiToken(payload, expiresIn?)     // → string
auth.verifyToken(token)                        // → payload | throws
auth.getUser(req)                              // → payload | null (never throws)
auth.hasRole(userRole, required)               // → boolean
auth.hasPermission(user, permission)           // → boolean
auth.requireLoginToken(options?)               // → middleware
auth.requireApiToken(options?)                 // → middleware
auth.requireUserRoles(['admin.system'])        // → middleware (OR semantics)
auth.requireUserPermissions(['manage:all'])    // → middleware (AND semantics)

// Class (from authClass directly)
authClass.getRoles()                           // → RoleHierarchy
authClass.getPermissions()                     // → PermissionConfig
authClass.getAllRoles()                        // → string[] (sorted low→high)
authClass.isValidRole(roleLevel)               // → boolean
authClass.reset(newConfig?)                    // → void (tests only)
```

## Env vars (see root `.env.example`)

- `BLOOM_AUTH_SECRET` — **required**, ≥32 random chars
- `BLOOM_AUTH_EXPIRES_IN` — default `7d`
- `BLOOM_AUTH_BCRYPT_ROUNDS` — default `10`
- `BLOOM_AUTH_ROLES` — override default hierarchy
- `BLOOM_AUTH_PERMISSIONS` — custom permissions list

## Methods that DO NOT exist (common hallucinations)

- `auth.signToken()` — use `generateLoginToken` / `generateApiToken`
- `auth.requireRole('admin')` — use `requireUserRoles(['admin.system'])`
- `auth.requireLogin()` — use `requireLoginToken()`
- `auth.user(req)` — use `getUser(req)`
- `auth.can(user, ...)` — use `hasPermission(user, permission)`
