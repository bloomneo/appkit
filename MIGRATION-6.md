# Migrating to @bloomneo/appkit 6

> Work in progress on the `next` branch (6.0.0-alpha). Filled in as each change lands.
> The plan: `~/vc/production/BLOOMNEO-6-CHECKLIST.md` (Phases 2–4).

appkit 6 keeps every API the production apps call, with the same names:
`auth.requireLoginToken / requireUserRoles / hashPassword / comparePassword /
generateLoginToken / getUser / verifyToken / hasRole / generateApiToken`,
`error.*`, `database.get()`, `logger.get()`, `security.requests()`,
`email.send`, `config.get`, and the subpath imports.

## Versioning

appkit, uikit and bloom now release together on one version number. 6.0.0 of
each is designed to be used with 6.0.0 of the others.

## Removed

Nothing below was used by any of the four production apps (counted
2026-09-26). Each removal is also banned by the drift check.

| Removed | Use instead |
|---|---|
| `eventClass` (`@bloomneo/appkit/event`), `EventError` | `queueClass` jobs for async work; Redis pub/sub directly if you need fan-out |
| `utilClass` (`@bloomneo/appkit/util`) | Node built-ins (`crypto.randomUUID()`, `structuredClone`, optional chaining) or a small local helper |
| The `appkit` CLI (`appkit generate app / feature`) | `bloom create <name>` scaffolds a project; add features by creating files |
| Logger database, HTTP and webhook transports (`BLOOM_LOGGER_DATABASE`, `BLOOM_LOGGER_DB_*`, `BLOOM_LOGGER_HTTP_*`, `BLOOM_LOGGER_WEBHOOK_*`) | Console and file only. Collect stdout or the log file with your platform's log agent; the old vars are ignored |
| Queue Redis transport (`REDIS_URL` selecting the queue, `BLOOM_QUEUE_TRANSPORT=redis`, `BLOOM_QUEUE_REDIS_*`) | The database transport: set `DATABASE_URL` (auto) or `BLOOM_QUEUE_TRANSPORT=database`. `BLOOM_QUEUE_TRANSPORT=redis` now throws at startup. Jobs left in Redis are not migrated |
| Storage R2 strategy (`CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_*`, `BLOOM_STORAGE_STRATEGY=r2`) | The S3 strategy with an endpoint: `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `AWS_REGION=auto`; `BLOOM_STORAGE_CDN_URL` for public URLs |
| Database Mongoose adapter (`mongodb://` URLs routed to Mongoose) | Prisma is the only adapter; use Prisma's `mongodb` provider if you need MongoDB |
| Per-org databases: `databaseClass.org(id)`, `ORG_<NAME>` URLs, `{org}` in `DATABASE_URL`, `x-org-id` detection | One `DATABASE_URL` per app; tenants are rows (`tenant_id`) in it |
| Tenant from `x-tenant-id` header, `:tenantId` route param, `?tenant=` query or subdomain | `req.user.tenantId` from the login token only: `auth.generateLoginToken({ …, tenantId })` + `auth.requireLoginToken()` before tenant routes |
| `req` argument on `databaseClass.getTenants / list / exists / create / delete` (it only selected an org) | Call them without it |
| Auth permissions model: `auth.hasPermission()`, `auth.requireUserPermissions()`, `authClass.getPermissions()`, `BLOOM_AUTH_PERMISSIONS`, the `permissions` token field | `auth.requireUserRoles([...])` / `auth.hasRole()` on the role ladder (`BLOOM_AUTH_ROLES` to customise). A `permissions` field in a payload is still signed but nothing reads it |
| Auth matrix mode: `BLOOM_AUTH_SCOPES`, `BLOOM_AUTH_TIERS`, `auth.requireScope()`, `auth.requireTier()`, `auth.roleParts()`, `tier` / `scope` token fields | The linear 9-level ladder; the env vars are ignored |
| `auth.canSeePII()`, `auth.maskPII()` | Decide and mask fields in the app's own serializer |
| `security.forms()` (CSRF), `BLOOM_SECURITY_CSRF_*`, `quickSetup({ csrf })`, `validateRequired({ csrf })`, `getStatus().csrf` | Bearer-token APIs need no CSRF token. Cookie-session HTML forms: `SameSite=Lax/Strict` session cookies or a maintained CSRF middleware. `BLOOM_SECURITY_CSRF_SECRET` is no longer required anywhere |
| `security.input()`, `security.html()`, `security.escape()`, `BLOOM_SECURITY_MAX_INPUT_LENGTH`, `BLOOM_SECURITY_ALLOWED_TAGS`, `BLOOM_SECURITY_STRIP_ALL_TAGS` | Validate input with a schema (zod, valibot); let the template engine or React escape output; a dedicated sanitizer (e.g. DOMPurify) if you must accept HTML |
| `email.sendTemplate()` and its built-in `welcome` / `reset` templates | Render `html` / `text` in the app (template literal, React Email, MJML) and call `email.send()` |
| Declared dependencies appkit no longer imports: `ioredis`, `pg`, `mysql2`, `sqlite`, `sqlite3`, `mongoose`, `bull`, `memcached`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, and the optional peers `express-session`, `fastify`, `@fastify/*`, `multer` | If your app imports any of these itself, add it to your own `package.json` |

## Added

- **Row-level security** (`BLOOM_DB_TENANT=rls`): `database.context()`
  middleware, `database.rlsPolicyStatements()` / `rlsPolicySql()`,
  `database.onBypass()`, `currentTenant()`, `BLOOM_DB_TENANT_COLUMN`,
  `BLOOM_PRISMA_CLIENT`. Apps that built this themselves (midhuna's
  `shared/prisma.ts` + `shared/rls.ts`) can delete their copy.

## Changed

### Every appkit error is an `AppKitError`

In 5.x some modules threw typed errors and others threw plain `Error`, so
apps wrapped appkit in their api-router with duck-typing (`err.message
.startsWith('[@bloomneo/appkit/')`, checking `err.statusCode` / `err.code`
by hand). In 6.0 every module throws an `AppKitError` subclass with
`module` and a stable `code`; message text is unchanged.

**Delete the duck-typing.** Either let `error.handleErrors()` handle it, or:

```ts
import { AppKitError, AppError } from '@bloomneo/appkit';

if (err instanceof AppError) { /* HTTP error: err.statusCode, err.type */ }
else if (err instanceof AppKitError) { /* appkit misuse/config: err.module, err.code → 500 */ }
```

New classes: `AuthError` (`@bloomneo/appkit/auth`), `ConfigError`
(`/config`), `VerifyError` (`/verify`). Token verification still throws
`TokenError`. Codes per module are listed in `llms.txt` → "Error Types".

`error.handleErrors()` keeps `AppError` / `SecurityError` statuses and
messages as before. Any other error becomes a 500, and **in production its
message is replaced** by the generic server-error message (`Server error`).
If a client depended on seeing a raw internal message in production, throw
an `AppError` (`error.badRequest(...)`, `error.serverError(...)`) instead.

### Middleware uses Express's own types

appkit used to declare its own `ExpressRequest` / `ExpressResponse` shapes,
which were not Express's `Request` / `Response`, so apps wrote
`auth.requireLoginToken() as any` and `(req as any).user`. In 6.0 every
middleware and handler takes and returns express's types, and appkit
augments `Express.Request`:

```ts
app.get('/x', auth.requireLoginToken(), auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    req.user?.tenantId;   // string | null | undefined — typed, no cast
    res.json({});
  }));
```

- **Delete the casts** (`as any`, `as unknown as RequestHandler`,
  `(req as any).user`). Any that remain are now plain type errors worth
  reading.
- **Install `@types/express`** in TypeScript apps (optional peer; express 4
  or 5 typings).
- `req.user` is `Express.User` (appkit's `JwtPayload`: `userId`, `role`,
  `level`, `type`, `tenantId`, `clientId`, plus any claim you signed);
  `req.token` is the API token's `JwtPayload`. If the app declared its own
  `user` on `Express.Request`, remove it, or add extra fields to
  `Express.User` instead.
- `ExpressRequest`, `ExpressResponse`, `ExpressNextFunction`,
  `ExpressMiddleware`, `ExpressErrorHandler` still export, now as aliases
  of the Express types.
