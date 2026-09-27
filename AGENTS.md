# AGENTS.md — @bloomneo/appkit

> Agent instructions for `@bloomneo/appkit`. This is the **rules** file.
> For the **full API reference**, read [`llms.txt`](./llms.txt) in the same directory.
> Both files ship with the package and are accessible via
> `node_modules/@bloomneo/appkit/AGENTS.md` and `node_modules/@bloomneo/appkit/llms.txt`.

## What this package is

`@bloomneo/appkit` is the backend of Bloomneo, which makes business apps safe,
consistent and maintainable however much of the code AI writes. It is a
Node.js toolkit with **12 integrated modules** that share one canonical
pattern: every module exports a `xxxClass` namespace object with a `.get()`
factory. There is exactly one way to obtain each module and exactly one way
to use it. `@bloomneo/appkit/server` adds the API layer: feature discovery,
route contracts and request ids.

Use it for: Express backends, JWT auth, multi-tenant database,
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
| `authClass` | `from '@bloomneo/appkit/auth'` | JWT tokens, role.level hierarchy, middleware |
| `databaseClass` | `from '@bloomneo/appkit/database'` | Prisma with multi-tenant filtering |
| `securityClass` | `from '@bloomneo/appkit/security'` | Rate limiting, AES-256-GCM encryption |
| `errorClass` | `from '@bloomneo/appkit/error'` | HTTP errors with semantic types |
| `cacheClass` | `from '@bloomneo/appkit/cache'` | Memory → Redis auto-scaling |
| `storageClass` | `from '@bloomneo/appkit/storage'` | Local → S3 (R2 / MinIO via `S3_ENDPOINT`) |
| `queueClass` | `from '@bloomneo/appkit/queue'` | Memory → Database (Postgres) jobs |
| `emailClass` | `from '@bloomneo/appkit/email'` | Console → SMTP → Resend |
| `loggerClass` | `from '@bloomneo/appkit/logger'` | Structured logs to console + rotating file |
| `configClass` | `from '@bloomneo/appkit/config'` | Environment-driven config |
| `mcpClass` | `from '@bloomneo/appkit/mcp'` | Your app as an MCP server for AI agents |
| `verifyClass` | `from '@bloomneo/appkit/verify'` | Proves the app doesn't leak across tenants |

Plus the server layer (not a `xxxClass`, plain functions):

| Export | Import | Purpose |
|---|---|---|
| `createApiRouter({ featuresDir })` | `from '@bloomneo/appkit/server'` | Mounts `features/<name>/<name>.route.ts` at `/api/<name>` |
| `route(contract, handler)`, `contractRouter([...])` | `from '@bloomneo/appkit/server'` | Serves `defineRoute()` contracts with auth, tenant scope and validation applied |
| `requestId()` | `from '@bloomneo/appkit/server'` | Request id on `req`, the response header and every log line |

For full method signatures and examples, read `llms.txt` in this same directory.

## Pick your starting point (task → files)

If you know *what you want to build*, jump straight to the files that demonstrate it.
Every file path below ships inside the npm tarball at `node_modules/@bloomneo/appkit/`.

| Goal | Start here |
|---|---|
| Authenticate a user with password + JWT | [`examples/auth.ts`](./examples/auth.ts) |
| Protect a route by login | [`examples/auth.ts`](./examples/auth.ts) → [`cookbook/auth-protected-crud.ts`](./cookbook/auth-protected-crud.ts) |
| Protect a route by role | [`cookbook/auth-protected-crud.ts`](./cookbook/auth-protected-crud.ts) |
| Issue and verify API keys (service-to-service) | [`cookbook/api-key-service.ts`](./cookbook/api-key-service.ts) |
| Query a tenant-aware database | [`examples/database.ts`](./examples/database.ts) |
| Build a multi-tenant SaaS (auth + db + tenant scoping) | [`cookbook/multi-tenant-saas.ts`](./cookbook/multi-tenant-saas.ts) |
| Upload + process files in the background | [`cookbook/file-upload-pipeline.ts`](./cookbook/file-upload-pipeline.ts) |
| Send email (dev → SMTP → Resend) | [`examples/email.ts`](./examples/email.ts) |
| Cache DB queries (memory → Redis) | [`examples/cache.ts`](./examples/cache.ts) |
| Background jobs with retries | [`examples/queue.ts`](./examples/queue.ts) |
| Structured logging with components | [`examples/logger.ts`](./examples/logger.ts) |
| Type-safe env vars | [`examples/config.ts`](./examples/config.ts) |
| Rate limit / encrypt fields | [`examples/security.ts`](./examples/security.ts) |
| Error-handling middleware | [`examples/error.ts`](./examples/error.ts) |
| Mount the API / serve route contracts | `llms.txt` → "Server" |
| Postgres row-level security | `llms.txt` → "Row-level security" |
| Expose the app to AI agents (MCP) | [`examples/mcp.ts`](./examples/mcp.ts) |
| Gate CI on tenant isolation | [`examples/verify.ts`](./examples/verify.ts) |

## Environment variables

AppKit reads env vars with the `BLOOM_*` prefix.

Required for production:

```bash
BLOOM_AUTH_SECRET=<min 32 chars>          # JWT signing key
DATABASE_URL=postgresql://...              # any Prisma-supported URL
BLOOM_SECURITY_ENCRYPTION_KEY=<64 hex>     # AES-256-GCM key (if you encrypt fields)
```

Optional (auto-scaling kicks in when set):

```bash
REDIS_URL=redis://...                  # → distributed cache
AWS_S3_BUCKET=...                      # → cloud storage
RESEND_API_KEY=re_...                  # → professional email
BLOOM_DB_TENANT=auto                   # → multi-tenant mode (filter in the app)
BLOOM_DB_TENANT=rls                    # → + Postgres row-level security
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
- **Use `loggerClass.get('component-name')`** so logs are tagged.
- **Mount `requestId()` first** (`@bloomneo/appkit/server`); every log line in
  the request then carries `req=<id>`. Don't thread request ids by hand.
- **Mount the API with `createApiRouter({ featuresDir })`**; don't copy an
  api-router into the app.
- **Let TypeScript see Express's types.** appkit middleware returns
  `RequestHandler`, and `req.user`, `req.token`, `req.requestId` and
  `req.requestMetadata` are declared on `Express.Request`. Never write
  `as any` around appkit middleware or `(req as any).user`.
- **Match appkit errors with `instanceof`** (`AppError`, `AppKitError`) and
  `err.code`, never by message text.

### Never

- **Never write your own JWT helper.** `auth.generateLoginToken()`,
  `auth.generateApiToken()`, and `auth.verifyToken()` cover every case.
  (`signToken` is a private internal — don't reach for it.)
- **Never instantiate Prisma directly.** `databaseClass.get()` returns the
  shared, tenant-aware client.
- **Never call `databaseClass.get()` for tenant data outside a tenant context.**
  In tenant mode it throws there because it cannot prove a tenant was applied.
  Use `database.tenant(req, db => ...)`, mount `database.context()` (after
  `auth.requireLoginToken()`) so `get()` is scoped for the whole request, or
  `database.bypass('reason', db => ...)` when crossing tenants deliberately.
  Single-tenant apps keep using `get()`.
  The tenant comes only from `req.user.tenantId` (the login token); headers,
  route params and subdomains are ignored.
- **Never hand-roll rate limiting.** Use `security.requests(maxRequests, windowMs)`.
- **Never write a custom file-upload-to-S3 wrapper.** `storage.put()` /
  `storage.get()` / `storage.url()` handle local + S3 (and S3-compatible endpoints) with the same API.
- **Never read `process.env.X` directly** in business code. Go through
  `config.get('section.key')` so the value is validated and typed.
- **Never `throw new Error(...)` in a route handler.** Use `error.badRequest(...)`,
  `error.unauthorized(...)`, etc. — they include the right HTTP status code.
- **Never gate data access on the role alone.** The role answers "may they do
  this?"; `tenantId`/`clientId` answer "on whose data?". Two users can both be
  `admin.tenant` and must not see each other's rows — spread
  `auth.scopedWhere(req)` into the query.

## Multi-tenant apps

Roles are one linear 9-level ladder (`BLOOM_AUTH_ROLES` to customise). Matrix
mode (`BLOOM_AUTH_SCOPES` / `BLOOM_AUTH_TIERS`), the permissions model and the
PII helpers were removed in 6.0.

- Put `tenantId` in the token at login; read it back with `auth.scopedWhere(req)`
  or let `database.tenant(req, fn)` apply it.
- **Prefer `BLOOM_DB_TENANT=rls`** for multi-tenant apps on Postgres: apply
  `database.rlsPolicyStatements({ table })` to every tenant table and mount
  `database.context()` after `auth.requireLoginToken()`. The database then
  refuses cross-tenant rows even where code forgets a filter.
- **Never return a query out of `database.tenant(req, fn)` un-awaited from
  somewhere else** — write `db => db.x.findMany()` (fine: appkit awaits it
  inside the tenant context), not code that stores the query and awaits it
  after `tenant()` returns.
- Decide which fields a role may see in the app's own serializer.
- **The tenant follows the request.** Inside `database.tenant()`,
  `database.context()` or a contract route: `databaseClass.get()` returns the
  scoped client, jobs added with `queue.add()` run their handler in the same
  tenant, and cache keys are stored per tenant (`t:<tenant>:` prefix). Don't
  put the tenant in cache keys or job data yourself. Storage keys are NOT
  prefixed: put the tenant in the key (`${tenantId}/…`).
- **Gate CI on `verifyClass`.** It generates the cross-tenant attack matrix
  from the app itself — no per-endpoint tests to write. `report.ok` is true
  only when checks ran and nothing was skipped, so an incomplete run fails
  rather than going green.

Child tables with no tenant column of their own are scoped through their parent: `rlsPolicyStatements({ table: 'deployments', via: { parent: 'deploy_targets', foreignKey: 'targetId' } })` — a row is visible and writable only when its parent row is the caller's tenant's. For a grandchild whose parent has no tenant column, add `column: false`: the parent's own policy decides. `bloom check` reports child tables left without one (`RLS_CHILD_UNPROTECTED`).

## Route contracts on the server (6.0)

Declare routes with `defineRoute()` from `@bloomneo/bloom` and serve them with
`route(contract, handler)` from `@bloomneo/appkit/server`. The contract's
`auth`, tenant scope and schemas are applied for you — don't add
`requireLoginToken()`, `database.context()` or manual validation to a contract
route. Mount the app's API with `createApiRouter({ featuresDir })` instead of
copying an api-router into the app.

```ts
import { createApiRouter, contractRouter, route, requestId } from '@bloomneo/appkit/server';

// server.ts
app.use(requestId());
app.use('/api', await createApiRouter({ featuresDir: join(__dirname, 'features') }));
app.use(error.handleErrors());

// features/invoices/invoices.route.ts
export default await contractRouter([
  route(getInvoice, async ({ params }) => {
    const db = await databaseClass.get();          // scoped to the caller's tenant
    return db.invoice.findUniqueOrThrow({ where: { id: params.id } });
  }),
]);
```

- Return the body; don't call `res.json()`. 201 for POST, 204 for `undefined`.
- A failed validation is a 400 `VALIDATION_ERROR` with an `issues` list.
- `auth: 'public'` routes need no auth configured at all.
- Query-string values are strings: use coercing schemas (`z.coerce.number()`).

## MCP — exposing your app to AI agents

```ts
const mcp = mcpClass.get();
await mcp.discover(join(__dirname, 'features'));   // features/<n>/<n>.mcp.ts

const { wellKnown, mcp: mcpRouter } = await mcp.routers({
  serviceName,
  authenticate,
  resolveRoles,      // REQUIRED: (sub) => 'role.level' | null
  resolveTenant,     // REQUIRED when BLOOM_DB_TENANT is on: (sub) => tenantId | null
});
app.use(wellKnown);            // ROOT — before any SPA catch-all
app.use('/mcp', mcpRouter);
```

- **Always mount `wellKnown` at the root**, before the SPA. Connector clients
  probe `/.well-known/oauth-authorization-server/mcp` at the root; if that path
  returns your SPA's HTML the client reports "couldn't register" even though
  `/mcp/register` works.
- `inputSchema` on a tool is a **Zod raw shape**, not JSON Schema.
- **Every tool declares `roles`** (`['role.level', ...]`), like a route
  contract's `auth` — required by `McpTool`, and `register()` throws
  `MCP_TOOL_NO_ROLES` without it. Use `['user.basic']` for a tool any
  signed-in caller may use; there are no unrestricted tools.
- **Always pass `resolveRoles`** — `routers()` throws `MCP_NO_ROLE_RESOLVER`
  without it. A caller resolved to null (or whose resolver throws) sees no
  tools. `authenticate()` still decides whether the connection exists at all.
- **Tools run in the caller's tenant.** With `BLOOM_DB_TENANT` on, pass
  `resolveTenant` (`MCP_NO_TENANT_RESOLVER` otherwise); every handler runs
  inside that tenant like a route behind `database.context()`, and
  `ctx.tenantId` names it. Don't set tenant context by hand in a tool. A null
  tenant (platform staff) gets none, so cross-tenant reads need
  `database.bypass('reason', fn)`.

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

## Scaffolding

appkit has no CLI. To start a project, use `bloom create <name>` from
`@bloomneo/bloom`, which scaffolds the backend with appkit already wired.

## Migration notes

**Current release: 6.0.0-rc.3.** Pre-release of 6.0; 5.1.4 is the stable line.
Upgrading from 5.x: [`MIGRATION-6.md`](./MIGRATION-6.md) lists every removal
with its replacement, every addition and every behaviour change. Older
release history is in [`CHANGELOG.md`](./CHANGELOG.md).

What 6.0 means for code you generate:

- **Gone — never generate these:** `eventClass`, `utilClass`, the `appkit`
  CLI, `auth.hasPermission()` / `requireUserPermissions()` / `requireScope()`
  / `requireTier()` / `canSeePII()` / `maskPII()`, `security.forms()` /
  `input()` / `html()` / `escape()`, `email.sendTemplate()`,
  `databaseClass.org()`, the logger's database / HTTP / webhook transports,
  the queue's Redis transport, the R2 storage strategy, Mongoose. Tenants
  never come from headers, route params or subdomains.
- **Typed errors everywhere:** every module throws only `AppKitError`
  subclasses (`AuthError`, `ConfigError`, `DatabaseError`, `QueueError`,
  `StorageError`, `EmailError`, `VerifyError`, `ServerError`, …) with a
  stable `err.code`. `handleErrors()` hides non-`AppError` messages in
  production and logs 4xx `AppError`s as one warning line.
- **Express types:** no casts around appkit middleware.
- **Tenant context** reaches `get()`, queued jobs and cache keys; Postgres
  row-level security is one env var (`BLOOM_DB_TENANT=rls`) plus
  `database.rlsPolicyStatements({ table })` per tenant table.
- **5.0 still applies:** in tenant mode `databaseClass.get()` throws outside a
  tenant context; use `database.tenant(req, fn)`, `database.context()` or
  `database.bypass('reason', fn)`. Single-tenant apps are unaffected.
- **4.0 still applies:** teardown is `xxxClass.disconnectAll()` on every
  stateful module.

## Where to look next

- **Full API reference**: [`llms.txt`](./llms.txt) (in this directory)
- **Module source code**: `node_modules/@bloomneo/appkit/dist/` (TypeScript types)
- **CHANGELOG**: [`CHANGELOG.md`](./CHANGELOG.md) for release history
- **Issues**: https://github.com/bloomneo/appkit/issues
