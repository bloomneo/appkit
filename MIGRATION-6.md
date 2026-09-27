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

## Changed

_None yet._
