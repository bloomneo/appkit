# AGENTS.md — @bloomneo/appkit

> Agent instructions for `@bloomneo/appkit`. This is the **rules** file.
> For the **full API reference**, read [`llms.txt`](./llms.txt) in the same directory.
> Both files ship with the package and are accessible via
> `node_modules/@bloomneo/appkit/AGENTS.md` and `node_modules/@bloomneo/appkit/llms.txt`.

## What this package is

`@bloomneo/appkit` is a Node.js backend toolkit with **12 integrated modules**
that share one canonical pattern: every module exports a `xxxClass` namespace
object with a `.get()` factory. There is exactly one way to obtain each module
and exactly one way to use it.

Use it for: Express/Fastify backends, JWT auth, multi-tenant database,
Redis cache, S3 storage, background queues, email, structured logging,
error handling. **Don't use it for:** frontend code, CLI tools, real-time
WebSocket-as-primary-feature, non-Node environments.

## The one rule that matters most

```ts
const auth = authClass.get();  // ALWAYS .get(), NEVER `new AuthClass()`
```

Every module follows this pattern. There are no exceptions. If you find
yourself writing `new SomethingClass()` in code that imports from
`@bloomneo/appkit`, you're doing it wrong.

## Canonical imports — pick one and stay consistent

```ts
// Option A — flat (preferred for general code):
import { authClass, databaseClass, errorClass, loggerClass } from '@bloomneo/appkit';

// Option B — subpath (preferred when only one module is needed):
import { authClass } from '@bloomneo/appkit/auth';
import { databaseClass } from '@bloomneo/appkit/database';
```

Both work. The subpath form is unusual for AppKit (most users want
multiple modules in the same file) but it tree-shakes slightly better.
**Don't mix the two styles in the same file.**

## The 12 modules at a glance

| Module | Import | Purpose |
|---|---|---|
| `authClass` | `from '@bloomneo/appkit/auth'` | JWT tokens, role.level permissions, middleware |
| `databaseClass` | `from '@bloomneo/appkit/database'` | Prisma/Mongoose with multi-tenant filtering |
| `securityClass` | `from '@bloomneo/appkit/security'` | CSRF, rate limiting, encryption, sanitization |
| `errorClass` | `from '@bloomneo/appkit/error'` | HTTP errors with semantic types |
| `cacheClass` | `from '@bloomneo/appkit/cache'` | Memory → Redis auto-scaling |
| `storageClass` | `from '@bloomneo/appkit/storage'` | Local → S3/R2 auto-scaling |
| `queueClass` | `from '@bloomneo/appkit/queue'` | Memory → Redis → DB scaling |
| `emailClass` | `from '@bloomneo/appkit/email'` | Console → SMTP → Resend |
| `eventClass` | `from '@bloomneo/appkit/event'` | Memory → Redis pub/sub |
| `loggerClass` | `from '@bloomneo/appkit/logger'` | Multi-transport, auto-scaling |
| `configClass` | `from '@bloomneo/appkit/config'` | Environment-driven config |
| `utilClass` | `from '@bloomneo/appkit/util'` | Safe property access, debounce, chunk |

For full method signatures and examples, read `llms.txt` in this same directory.

## Environment variables

AppKit reads env vars with the `BLOOM_*` prefix. There is **no** backwards
compatibility for the legacy `VOILA_*` prefix from `@voilajsx/appkit` —
that was removed entirely in 1.5.2.

Required for production:

```bash
BLOOM_AUTH_SECRET=<min 32 chars>          # JWT signing key
DATABASE_URL=postgresql://...              # any Prisma-supported URL
BLOOM_SECURITY_CSRF_SECRET=<min 32 chars>  # CSRF protection
BLOOM_SECURITY_ENCRYPTION_KEY=<64 hex>     # AES-256-GCM key
```

Optional (auto-scaling kicks in when set):

```bash
REDIS_URL=redis://...                  # → distributed cache + queue
AWS_S3_BUCKET=...                      # → cloud storage
RESEND_API_KEY=re_...                  # → professional email
BLOOM_DB_TENANT=auto                   # → multi-tenant mode
```

## When generating code with AppKit

### Always

- **Use `xxxClass.get()`** to obtain a module instance. Cache the result at
  module scope, not inside request handlers.
- **Wrap async route handlers** in `error.asyncRoute(...)` so thrown errors
  flow into the centralized error middleware.
- **Use semantic error types**: `error.badRequest('...')`, `error.unauthorized('...')`,
  `error.notFound('...')`, etc. — never `throw new Error(...)` in routes.
- **Mount `error.handleErrors()` middleware last** in the Express stack.
- **Use `auth.requireLoginToken()` and `auth.requireUserRoles(['admin.tenant'])`** as
  middleware, not custom token-checking code. Chain in that order:
  `requireLoginToken()` first, then `requireUserRoles([...])` — never standalone,
  never reversed.
- **Use `cache.getOrSet(key, fetcher, ttl)`** instead of manual cache-check-then-fetch.
- **Use `logger.get('component-name')`** so logs are tagged.

### Never

- **Never write your own JWT helper.** `auth.generateLoginToken()`,
  `auth.generateApiToken()`, and `auth.verifyToken()` cover every case.
  (`signToken` is a private internal — don't reach for it.)
- **Never instantiate Prisma directly.** `databaseClass.get()` returns the
  shared, tenant-aware client.
- **Never hand-roll rate limiting.** Use `security.requests(maxRequests, windowMs)`.
- **Never write a custom file-upload-to-S3 wrapper.** `storage.put()` /
  `storage.get()` / `storage.url()` handle local + S3 + R2 with the same API.
- **Never read `process.env.X` directly** in business code. Go through
  `config.get('section.key')` so the value is validated and typed.
- **Never `throw new Error(...)` in a route handler.** Use `error.badRequest(...)`,
  `error.unauthorized(...)`, etc. — they include the right HTTP status code.

## Canonical pattern — protected endpoint with database + logger

This is the shape ~80% of AppKit endpoints follow. Generate this as the
default starting point unless told otherwise:

```ts
import { authClass, databaseClass, errorClass, loggerClass } from '@bloomneo/appkit';

const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();
const logger = loggerClass.get('users');

app.post(
  '/api/users',
  auth.requireLoginToken(),                    // 1. authenticate the user
  auth.requireUserRoles(['admin.tenant']),     // 2. check the role (always chained)
  error.asyncRoute(async (req, res) => {
    if (!req.body?.email) {
      throw error.badRequest('Email required');
    }

    const newUser = await database.user.create({ data: req.body });
    logger.info('User created', { userId: newUser.id });

    res.json({ user: newUser });
  })
);

// Last middleware in the stack — handles every thrown semantic error.
app.use(error.handleErrors());
```

**Critical chaining rules for the auth middleware:**
- `requireLoginToken()` MUST come first (it sets `req.user` for downstream).
- `requireUserRoles([...])` is for role-based access on USER routes — chain it
  AFTER `requireLoginToken()`. Never use it standalone or with API tokens.
- `requireApiToken()` is for SERVICE routes (webhooks, integrations). Use it
  alone. Never chain `requireUserRoles` after `requireApiToken` — API tokens
  don't have user roles.

## CLI

`@bloomneo/appkit` ships a CLI for scaffolding backend projects:

```bash
appkit generate app myproject       # full backend scaffold
cd myproject && npm run dev:api     # → http://localhost:3000

appkit generate feature product      # basic feature (route + service + types)
appkit generate feature order --db   # database-enabled feature
appkit generate feature user         # full auth system with 9-role hierarchy
```

For a downstream consumer building with `@bloomneo/bloom`, the bloom CLI
handles scaffolding instead — appkit's CLI is for users who only want the
backend, no frontend.

## Migration notes

- This package was previously published as `@voilajsx/appkit` (frozen at
  1.2.8). Run a project-wide find-and-replace of `@voilajsx/appkit` →
  `@bloomneo/appkit`. The API is identical.
- **BREAKING (1.5.2):** the legacy `VOILA_*` env var prefix is gone.
  Rename every `VOILA_FOO` in your `.env` files to `BLOOM_FOO`. There
  is no fallback, no deprecation warning, no compatibility shim — the
  rebrand is a clean break and consumers upgrading from earlier versions
  must rename in one go.

## Where to look next

- **Full API reference**: [`llms.txt`](./llms.txt) (in this directory)
- **Module source code**: `node_modules/@bloomneo/appkit/dist/` (TypeScript types)
- **CHANGELOG**: [`CHANGELOG.md`](./CHANGELOG.md) for release history
- **Issues**: https://github.com/bloomneo/appkit/issues
