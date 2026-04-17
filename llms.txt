# @bloomneo/appkit — full reference

> Machine-readable API reference for AI coding agents.
> For **rules** (what to always/never do), read [`AGENTS.md`](./AGENTS.md) in this directory first.
> Both files ship with the package at `node_modules/@bloomneo/appkit/`.

## Setup (every project)

```ts
// 1. Install
//    npm install @bloomneo/appkit

// 2. Set env vars in .env (minimum)
//    BLOOM_AUTH_SECRET=<min 32 chars>
//    DATABASE_URL=postgresql://...

// 3. Import what you need (the canonical pattern is one xxxClass per module)
import {
  authClass,
  databaseClass,
  errorClass,
  loggerClass,
  cacheClass,
  storageClass,
  queueClass,
  emailClass,
  eventClass,
  configClass,
  securityClass,
  utilClass,
} from '@bloomneo/appkit';

// 4. Get instances at module scope (NEVER inside route handlers)
const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();
const logger = loggerClass.get('my-app');
```

## Universal pattern

Every module is `xxxClass.get()`. There are **no exceptions**, no constructors,
no factories with custom names. If you remember one rule, it's this one.

```ts
const auth = authClass.get();           // synchronous
const database = await databaseClass.get(); // async (initializes connection)
const cache = cacheClass.get('users');  // optional namespace param
const logger = loggerClass.get('api');  // optional component param
```

---

## Module 1 — Auth (`@bloomneo/appkit/auth`)

JWT tokens, role.level permissions, Express middleware. Two token types:
**login tokens** (humans) and **API tokens** (services/webhooks).

### Methods (verified by src/auth/auth.test.ts — 47/47 passing)

```ts
const auth = authClass.get();

// Token generation — these are the ONLY two public token-creation methods.
// (`signToken` is a private internal — never call it from consumer code.)
auth.generateLoginToken(payload, expiresIn?: string): string
//   payload: { userId: string | number, role: string, level: string, permissions?: string[], email?: string }
//   default expiresIn: '7d'

auth.generateApiToken(payload, expiresIn?: string): string
//   payload: { keyId: string, role: string, level: string, permissions?: string[] }
//   default expiresIn: '1y'

// Token verification — handles BOTH login and API tokens. Throws on bad token.
auth.verifyToken(token: string): JwtPayload

// Password hashing
auth.hashPassword(plain: string, rounds?: number): Promise<string>
auth.comparePassword(plain: string, hash: string): Promise<boolean>  // never throws

// Express middleware factories — return ExpressMiddleware functions
auth.requireLoginToken(options?): ExpressMiddleware       // user authentication
auth.requireApiToken(options?): ExpressMiddleware         // API token authentication
auth.requireUserRoles(['admin.tenant']): ExpressMiddleware       // role check (OR within array)
auth.requireUserRoles(['admin.tenant', 'admin.org']): ExpressMiddleware
auth.requireUserPermissions(['manage:users']): ExpressMiddleware // permission check (AND within array)

// Request helpers
auth.getUser(req: ExpressRequest): JwtPayload | null   // null-safe extract from req.user OR req.token
auth.hasRole(userRoleLevel: string, requiredRoleLevel: string): boolean   // inheritance-aware
auth.hasPermission(user: JwtPayload, permission: string): boolean   // permission inheritance
```

### Middleware chaining rules

- `requireLoginToken()` MUST come first on user routes — it sets `req.user` for downstream.
- `requireUserRoles([...])` and `requireUserPermissions([...])` chain AFTER `requireLoginToken()`.
  Never use them standalone, never on API token routes (API tokens don't have user roles).
- `requireApiToken()` is for SERVICE routes only. Use it alone — never chain `requireUserRoles`
  after it.

### Role hierarchy (9 levels, automatic inheritance)

The default hierarchy ships with these 9 role.level values:

```
Level 1: user.basic
Level 2: user.pro       (NOT 'user.premium')
Level 3: user.max       (NOT 'user.enterprise')
Level 4: moderator.review
Level 5: moderator.approve
Level 6: moderator.manage
Level 7: admin.tenant
Level 8: admin.org
Level 9: admin.system
```

`requireUserRoles(['admin.tenant'])` accepts `admin.tenant`, `admin.org`, AND `admin.system`
via inheritance. To register additional roles, set the `BLOOM_AUTH_ROLES` env var:

```bash
BLOOM_AUTH_ROLES=user.basic:1,user.pro:2,...,service.webhook:10
```

If you call `generateLoginToken({ role: 'service', level: 'webhook' })` without
registering the role, you get `Error: Invalid role.level: "service.webhook"` at runtime.

### Example — login flow

```ts
import { authClass, databaseClass, errorClass } from '@bloomneo/appkit';

const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();

app.post('/auth/login', error.asyncRoute(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw error.badRequest('Email and password required');

  const user = await database.user.findUnique({ where: { email } });
  if (!user) throw error.unauthorized('Invalid credentials');

  const valid = await auth.comparePassword(password, user.password);
  if (!valid) throw error.unauthorized('Invalid credentials');

  const token = auth.generateLoginToken({
    userId: user.id,
    role: user.role,
    level: user.level,
  });
  res.json({ token, user: { id: user.id, email: user.email } });
}));
```

### Example — protected admin route

```ts
app.delete(
  '/admin/users/:id',
  auth.requireLoginToken(),                    // 1. authenticate
  auth.requireUserRoles(['admin.tenant']),     // 2. authorize (chained)
  error.asyncRoute(async (req, res) => {
    const me = auth.getUser(req);              // null-safe; non-null after middleware
    if (!me) throw error.unauthorized();
    await database.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ deleted: true });
  })
);
```

---

## Module 2 — Database (`@bloomneo/appkit/database`)

Multi-tenant Prisma/Mongoose with automatic tenant filtering.

### Methods

```ts
const database = await databaseClass.get();
// `database` is the Prisma client, scoped to current tenant

// Tenant management (when BLOOM_DB_TENANT=auto)
database.user.findMany()                          // auto-filtered by tenant_id
database.user.create({ data: {...} })             // auto-stamps tenant_id

// Cross-tenant queries (admin only)
const dbAll = await databaseClass.getTenants();   // unfiltered, all tenants
dbAll.user.groupBy({ by: ['tenant_id'], _count: true })

// Org-level (multi-org SaaS)
const acmeDb = await databaseClass.org('acme').get();  // ORG_ACME=postgresql://acme.../prod
```

### Required env

```bash
DATABASE_URL=postgresql://...        # required
BLOOM_DB_TENANT=auto              # optional, enables multi-tenant filtering
ORG_<NAME>=postgresql://...          # optional, enables per-org databases
```

---

## Module 3 — Security (`@bloomneo/appkit/security`)

CSRF protection, rate limiting, AES-256-GCM encryption, input sanitization.

### Methods

```ts
const security = securityClass.get();

// Rate limiting middleware
security.requests(maxRequests: number, windowMs: number)
// e.g. security.requests(100, 900000) → 100 req per 15 min per IP

// CSRF protection middleware — ONE method that does both injection AND validation.
// Mount once on HTML form routes. No separate requireCsrf() — forms() handles it.
security.forms(): ExpressMiddleware

// Encryption
security.encrypt(plaintext: string): string   // AES-256-GCM
security.decrypt(ciphertext: string): string

// Input sanitization (strip XSS + control chars — NOT email/URL validation)
security.input(value: string): string
security.html(value: string): string          // strip disallowed HTML tags, keep safe ones
security.escape(value: string): string        // escape HTML special chars (&, <, >, etc.)

// NOTE: there is no security.email() or security.url() — use zod or validator.js for those.
```

### Required env

```bash
BLOOM_SECURITY_CSRF_SECRET=<min 32 chars>
BLOOM_SECURITY_ENCRYPTION_KEY=<64 hex chars for AES-256>
```

---

## Module 4 — Error (`@bloomneo/appkit/error`)

HTTP errors with semantic types and centralized middleware.

### Methods

```ts
const error = errorClass.get();

// Semantic error throwers (each sets correct HTTP status)
throw error.badRequest('message')        // 400
throw error.unauthorized('message')      // 401
throw error.forbidden('message')         // 403
throw error.notFound('message')          // 404
throw error.conflict('message')          // 409
throw error.tooMany('message')           // 429
throw error.serverError('message')       // 500  (alias: error.internal)

// Async route wrapper (catches throws)
app.get('/x', error.asyncRoute(async (req, res) => {
  if (!req.params.id) throw error.badRequest('id required');
  // ...
}));

// Error-handling middleware (mount LAST in stack)
app.use(error.handleErrors());
```

---

## Module 5 — Cache (`@bloomneo/appkit/cache`)

Memory → Redis auto-scaling. Same API across both backends.

### Methods

```ts
const cache = cacheClass.get();              // default 'app' namespace
const userCache = cacheClass.get('users');   // custom namespace (isolation)

await cache.set(key: string, value: any, ttlSeconds?: number)
await cache.get<T>(key: string): Promise<T | null>
await cache.delete(key: string): Promise<boolean>   // NOTE: delete(), NOT del()

// Presence check — there is no cache.has(). Check for null instead:
const v = await cache.get('foo');
if (v !== null) { /* key exists */ }

// THE pattern — use this 90% of the time
await cache.getOrSet<T>(key, fetcher: () => Promise<T>, ttlSeconds?): Promise<T>
// e.g. await cache.getOrSet('users:list', () => database.user.findMany(), 300)
```

Set `REDIS_URL` to auto-upgrade from memory to Redis. No code changes needed.

---

## Module 6 — Storage (`@bloomneo/appkit/storage`)

Local → S3/R2 auto-scaling. Same API across all providers.

### Methods

```ts
const storage = storageClass.get();

await storage.put(key: string, buffer: Buffer, opts?: { contentType?: string })
await storage.get(key: string): Promise<Buffer>
await storage.delete(key: string): Promise<boolean>   // NOTE: delete(), NOT del()
await storage.exists(key: string): Promise<boolean>   // NOTE: exists(), NOT has()
await storage.list(prefix?: string, limit?: number): Promise<StorageFile[]>
storage.url(key: string): string                      // public URL
await storage.signedUrl(key, expiresIn?: number): Promise<string>  // presigned
await storage.copy(sourceKey: string, destKey: string): Promise<string>
```

Set `AWS_S3_BUCKET` (or `R2_BUCKET`) to auto-upgrade from local disk to cloud.

---

## Module 7 — Queue (`@bloomneo/appkit/queue`)

Memory → Redis → DB auto-scaling background jobs.

### Methods

```ts
const queue = queueClass.get();

// Enqueue immediately (or with a fixed delay)
await queue.add(jobType: string, data: any, opts?: {
  delay?: number;      // ms to wait before running (default 0)
  attempts?: number;   // max retry attempts (NOTE: "attempts" not "retries")
  priority?: number;   // lower number = higher priority
})

// Process — register a worker for a job type
queue.process(jobType, async (data) => {
  // return the result; throw to trigger a retry
});

// Schedule — enqueue with a delay in milliseconds (NOT a cron expression)
await queue.schedule(jobType: string, data: any, delayMs: number): Promise<string>
// e.g. run once 8 hours from now:
await queue.schedule('cleanup-tokens', {}, 8 * 60 * 60 * 1000)
// For recurring/cron jobs use a cron library (node-cron etc.) to call queue.add().

// Other instance methods
await queue.pause(jobType?: string)
await queue.resume(jobType?: string)
await queue.getStats(jobType?: string): Promise<QueueStats>
await queue.retry(jobId: string)
await queue.remove(jobId: string)
```

Memory by default; Redis when `REDIS_URL` is set.

---

## Module 8 — Email (`@bloomneo/appkit/email`)

Console → SMTP → Resend auto-scaling. Templates supported.

### Methods

```ts
const email = emailClass.get();

// Send a plain or HTML email. EmailData fields:
await email.send({
  to: string | string[],          // required
  subject: string,                // required
  text?: string,                  // plain-text body
  html?: string,                  // HTML body (send both for best deliverability)
  from?: string,                  // override sender
  replyTo?: string,
  cc?: string | string[],
  bcc?: string | string[],
  // NOTE: there are NO "template" or "data" fields — use sendTemplate() below.
})

// Convenience shortcuts
await email.sendText(to: string, subject: string, text: string)
await email.sendHtml(to: string, subject: string, html: string, text?: string)

// Templated email — pass the template name + all variables in one object
await email.sendTemplate(templateName: string, data: Record<string, any>)
// e.g. await email.sendTemplate('password-reset', { to: addr, resetLink, expiresIn: '1 hour' })

await email.sendBatch(emails: EmailData[], batchSize?: number)
```

`console` strategy in dev (logs to terminal), `smtp` if `SMTP_HOST` set,
`resend` if `RESEND_API_KEY` set.

---

## Module 9 — Event (`@bloomneo/appkit/event`)

Memory → Redis pub/sub for distributed events. Wildcard pattern matching.

### Methods

```ts
const events = eventClass.get();              // default namespace
const userEvents = eventClass.get('users');   // namespace isolation

events.on(eventName: string, handler: (data) => void | Promise<void>)
events.on('user.*', handler)                  // wildcard
await events.emit(eventName: string, data: any)
events.off(eventName, handler)
```

Set `REDIS_URL` to distribute events across processes/servers.

---

## Module 10 — Util (`@bloomneo/appkit/util`)

12 small zero-dependency helpers for common Node.js tasks.

### Methods

```ts
const util = utilClass.get();

util.get(obj, 'a.b.c.d', defaultValue)     // safe deep property access (read-only)
// NOTE: there is no util.set() — use plain assignment for mutation.
util.pick(obj, ['a', 'b', 'c'])             // subset (keep listed keys)
// NOTE: there is no util.omit() — use util.pick() with the keys you want to keep.
util.isEmpty(value: any): boolean           // true for null, undefined, '', [], {}
util.chunk(array, size)                     // split into batches
util.unique(array): any[]                   // deduplicate
util.clamp(value, min, max): number         // clamp(150, 0, 100) → 100
util.debounce(fn, ms)
// NOTE: there is no util.throttle() — only debounce.
util.sleep(ms): Promise<void>
util.uuid(): string                         // v4 UUID
util.slugify(text, opts?)                   // url-safe slug
util.formatBytes(bytes): string             // "1.5 MB"
util.truncate(text, maxLength): string      // truncate with ellipsis
// NOTE: there is no util.retry() — implement retry with a loop or a dedicated library.
```

---

## Module 11 — Config (`@bloomneo/appkit/config`)

Type-safe environment variable access with validation.

### Methods

```ts
// Instance methods — on the object returned by configClass.get()
const config = configClass.get();

config.get('section.key', defaultValue?)         // always returns string | undefined
config.has('section.key'): boolean
config.getRequired('section.key'): string        // throws if missing
config.getMany({ a: 'section.key_a', b: 'section.key_b' }): { a: string, b: string }  // object in, object out
config.getAll(): Record<string, string | undefined>

// NOTE: getNumber() and getBoolean() do NOT exist on the config instance.
// Parse manually:
const port = Number(config.get('api.port') ?? 3000);
const debug = config.get('app.debug') === 'true';

// Environment helpers — on configClass directly (NOT on the instance)
configClass.isDevelopment(): boolean
configClass.isProduction(): boolean
configClass.isTest(): boolean
configClass.validateRequired(['BLOOM_AUTH_SECRET', 'DATABASE_URL'])  // throws if missing
```

`config.get('auth.secret')` reads `BLOOM_AUTH_SECRET`. All env vars use
the `BLOOM_*` prefix.

---

## Module 12 — Logger (`@bloomneo/appkit/logger`)

Multi-transport structured logging. Console → File → HTTP auto-scaling.

### Methods

```ts
const logger = loggerClass.get('api');     // component-tagged

logger.debug(message: string, meta?)
logger.info(message: string, meta?)
logger.warn(message: string, meta?)
logger.error(message: string, meta?)
logger.fatal(message: string, meta?)

// Multi-transport — set env vars to enable
// BLOOM_LOGGER_FILE_PATH=/var/log/app.log → file transport
// BLOOM_LOGGER_HTTP_URL=https://logs.example.com → HTTP transport
```

---

## Environment variable reference

| Variable | Purpose | Required? |
|---|---|---|
| `BLOOM_AUTH_SECRET` | JWT signing key (min 32 chars) | yes |
| `DATABASE_URL` | Prisma connection string | yes |
| `BLOOM_SECURITY_CSRF_SECRET` | CSRF token signing (min 32 chars) | recommended |
| `BLOOM_SECURITY_ENCRYPTION_KEY` | AES-256-GCM key (64 hex chars) | recommended |
| `REDIS_URL` | Distributed cache + queue + events | optional |
| `AWS_S3_BUCKET` | Cloud storage | optional |
| `BLOOM_DB_TENANT` | `auto` enables multi-tenant filtering | optional |
| `RESEND_API_KEY` | Production email | optional |
| `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` | SMTP email | optional |
| `BLOOM_LOGGER_FILE_PATH` | File transport for logger | optional |
| `BLOOM_LOGGER_HTTP_URL` | HTTP transport for logger | optional |
| `ORG_<NAME>` | Per-org database (multi-org SaaS) | optional |

All environment variables use the `BLOOM_*` prefix. No legacy fallbacks.

---

## Subpath imports

Each module is also available as a subpath for tree-shaking:

```ts
import { authClass } from '@bloomneo/appkit/auth';
import { databaseClass } from '@bloomneo/appkit/database';
import { securityClass } from '@bloomneo/appkit/security';
import { errorClass } from '@bloomneo/appkit/error';
import { cacheClass } from '@bloomneo/appkit/cache';
import { storageClass } from '@bloomneo/appkit/storage';
import { queueClass } from '@bloomneo/appkit/queue';
import { emailClass } from '@bloomneo/appkit/email';
import { eventClass } from '@bloomneo/appkit/event';
import { loggerClass } from '@bloomneo/appkit/logger';
import { configClass } from '@bloomneo/appkit/config';
import { utilClass } from '@bloomneo/appkit/util';
```

The flat `from '@bloomneo/appkit'` import is preferred when multiple
modules are used in the same file (most common case).

---

## Error Types (4.0.0+)

Every typed error extends `AppKitError`. Catch once, handle all:

```ts
import { AppKitError } from '@bloomneo/appkit';

try { ... } catch (err) {
  if (err instanceof AppKitError) {
    logger.warn('appkit error', { module: err.module, code: err.code });
  }
  throw err;
}
```

### Codes by module

| Module | Class | Common codes | Fix |
|---|---|---|---|
| auth | `TokenError` | `expired` / `not_before` / `invalid` / `malformed` | Refresh or re-issue the token |
| cache | `CacheError` | `CACHE_GET_FAILED` / `CACHE_SET_FAILED` / `CACHE_INVALID_KEY` / `CACHE_CONNECT_FAILED` | Check Redis connectivity / key format |
| database | `DatabaseError` | `DATABASE_MISSING_URL` / `DATABASE_ERROR` | Set `DATABASE_URL` |
| email | `EmailError` | `EMAIL_PROD_NO_PROVIDER` / `EMAIL_ERROR` | Set `RESEND_API_KEY` or `SMTP_HOST` in production |
| error | `AppError` | HTTP type string (`BAD_REQUEST`, `NOT_FOUND`, etc.) | Handled by `error.handleErrors()` middleware automatically |
| event | `EventError` | `EVENT_ERROR` | Fix serialization / handler shape |
| logger | `LoggerError` | `LOGGER_ERROR` | Check transport config |
| queue | `QueueError` | `QUEUE_ERROR` / `QUEUE_HANDLER_TIMEOUT` | Investigate handler; override `{ timeout }` on `process()` if intentional |
| security | `SecurityError` | `SECURITY_MISSING_CONFIG` / `SECURITY_400` / `SECURITY_403` | Set required env; reject invalid input |
| storage | `StorageError` | `STORAGE_ERROR` | Check bucket creds / key path |
| util | `AppKitError` (via `requireProp` / `requireEnv`) | `UTIL_MISSING_PROP` / `UTIL_MISSING_ENV` | Fix the caller |

Every message is prefixed `[@bloomneo/appkit/<module>]` and ends with
`See: <README anchor URL>` so an agent can fetch the doc section and self-correct.

---

## Migration → 4.0.0

Full table: [`CHANGELOG.md`](./CHANGELOG.md#400---2026-04-17).

### From 2.0.0 → 4.0.0

Teardown verb unified across every stateful module:

```
cacheClass.flushAll(      → cacheClass.clearAll(
cacheClass.shutdown(      → cacheClass.disconnectAll(
queueClass.clear(         → queueClass.disconnectAll(
emailClass.shutdown(      → emailClass.disconnectAll(
emailClass.clear(         → emailClass.disconnectAll(
eventClass.shutdown(      → eventClass.disconnectAll(
eventClass.clear(         → eventClass.disconnectAll(
storageClass.shutdown(    → storageClass.disconnectAll(
storageClass.clear(       → storageClass.disconnectAll(
loggerClass.clear(        → loggerClass.disconnectAll(
databaseClass.disconnect( → databaseClass.disconnectAll(
```

Error types unified under `AppKitError`:

```
catch (err) { if (err instanceof AppKitError) { log(err.module, err.code) } }
```

Library no longer auto-registers `process.on('SIGTERM', ...)`. Wire it
yourself (scaffolded backend template does this).

Email/storage/database/security throw in `NODE_ENV=production` when
required env vars are missing. No silent fallback.

### From 1.5.x → 4.0.0

Apply the 2.0.0 → 4.0.0 list above plus:

- `auth.user(req)` → `auth.getUser(req)`
- `auth.can(user, perm)` → `auth.hasPermission(user, perm)`
- `security.csrf()` → `security.forms()`
- `error.handleErrors({ includeStack })` → `error.handleErrors({ showStack })`

Removed (never actually existed — docs were wrong): `auth.requireLogin()`,
`auth.requireRole()`, `logger.gethasTransport()`, `logger.getclear()`. Use
`auth.requireLoginToken()`, `auth.requireUserRoles([...])`,
`loggerClass.hasTransport()`, `loggerClass.disconnectAll()`.

---

## CLI

```bash
npm install -g @bloomneo/appkit
appkit generate app myproject              # full backend scaffold
appkit generate feature product            # basic feature
appkit generate feature order --db         # database-enabled feature
appkit generate feature user               # full auth system
```

For frontend + backend together, use `@bloomneo/bloom` which scaffolds both.

---

## Where to look next

- **Rules** (always/never): `AGENTS.md` in this same directory
- **Source code**: `dist/` (compiled TypeScript with .d.ts)
- **Per-module READMEs**: shipped in the tarball at `node_modules/@bloomneo/appkit/src/<module>/README.md` (long-form human-facing docs; also browsable at `https://github.com/bloomneo/appkit/tree/main/src`)
- **CHANGELOG**: `CHANGELOG.md`
- **Issues**: https://github.com/bloomneo/appkit/issues
