# Migrating to @bloomneo/appkit 6

appkit 6 keeps every API the production apps call, with the same names:
`auth.requireLoginToken / requireUserRoles / hashPassword / comparePassword /
generateLoginToken / getUser / verifyToken / hasRole / generateApiToken /
scopedWhere`, `error.*`, `database.get() / tenant() / bypass()`,
`logger.get()`, `security.requests()`, `email.send`, `config.get`,
`queue.add / process / schedule / repeat`, `storage.*`, `cache.*`, `mcpClass`,
`verifyClass`, and the subpath imports.

What 6.0 does: removes what no production app used, makes every error typed,
types middleware with Express's own types, moves the api-router every app
copied into the package (`@bloomneo/appkit/server`), and carries the tenant
and the request id through the whole request — the database, the cache, the
jobs it queues and its log lines.

## Upgrade in this order

1. Bump `@bloomneo/appkit`, `@bloomneo/uikit` and `@bloomneo/bloom` to 6.0.0
   together.
2. Search the app for every name in [Removed](#removed) and apply the
   replacement. Most apps have none.
3. TypeScript apps: install `@types/express` and delete the casts around
   appkit middleware ([Express types](#middleware-uses-expresss-own-types)).
4. Delete duck-typing of appkit errors by message text
   ([Typed errors](#every-appkit-error-is-an-appkiterror)).
5. Replace the app's `src/api/lib/api-router.ts` with `createApiRouter()`
   and mount `requestId()` first ([Added](#added)).
6. Multi-tenant apps: check the tenant comes from the login token only, then
   read [Tenant context](#the-tenant-follows-the-request).
7. Apps exposing MCP tools: add `roles` to every tool and pass
   `resolveRoles` (and `resolveTenant` in tenant mode) —
   [MCP tools](#mcp-tools-declare-roles-and-run-in-the-callers-tenant).

## Versioning

appkit, uikit and bloom now release together on one version number. 6.0.0 of
each is designed to be used with 6.0.0 of the others.

## Removed

Nothing below was used by any of the four production apps (counted
2026-09-26). Each removal is also banned by the drift check.

| Removed | Use instead |
|---|---|
| `eventClass` (`@bloomneo/appkit/event`), `EventError`, `BLOOM_EVENT_*` | `queueClass` jobs for async work; Redis pub/sub directly if you need fan-out |
| `utilClass` (`@bloomneo/appkit/util`) | Node built-ins (`crypto.randomUUID()`, `structuredClone`, optional chaining) or a small local helper |
| The `appkit` CLI (`appkit generate app / feature`) and the `bin` entry | `bloom create <name>` scaffolds a project; add features by creating files |
| Logger database, HTTP and webhook transports (`BLOOM_LOGGER_DATABASE`, `BLOOM_LOGGER_DB_*`, `BLOOM_LOGGER_HTTP_*`, `BLOOM_LOGGER_WEBHOOK_*`) | Console and file only. Collect stdout or the log file with your platform's log agent; the old vars are ignored. The logger no longer reads `DATABASE_URL` |
| Queue Redis transport (`REDIS_URL` selecting the queue, `BLOOM_QUEUE_TRANSPORT=redis`, `BLOOM_QUEUE_REDIS_*`) | The database transport: set `DATABASE_URL` (auto) or `BLOOM_QUEUE_TRANSPORT=database`. `BLOOM_QUEUE_TRANSPORT=redis` now throws at startup. Jobs left in Redis are not migrated. `REDIS_URL` still switches the cache |
| Storage R2 strategy (`CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_*`, `BLOOM_STORAGE_STRATEGY=r2`) | The S3 strategy with an endpoint: `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `AWS_REGION=auto`; `BLOOM_STORAGE_CDN_URL` for public URLs |
| Database Mongoose adapter (`mongodb://` URLs routed to Mongoose) | Prisma is the only adapter; use Prisma's `mongodb` provider if you need MongoDB |
| Per-org databases: `databaseClass.org(id)`, `ORG_<NAME>` URLs, `{org}` in `DATABASE_URL`, `x-org-id` detection | One `DATABASE_URL` per app; tenants are rows (`tenant_id`) in it |
| Tenant from `x-tenant-id` header, `:tenantId` route param, `?tenant=` query or subdomain | `req.user.tenantId` from the login token only: `auth.generateLoginToken({ …, tenantId })` + `auth.requireLoginToken()` before tenant routes |
| `databaseClass.getTenants()` (unscoped client, no reason) | `databaseClass.bypass('specific reason', (db) => …)` — named, logged and reported to `onBypass` listeners. For scoped access: `databaseClass.tenant(req, (db) => …)`, or `databaseClass.context()` middleware then `databaseClass.get()`, or route contracts |
| `databaseClass.list()`, `exists(tenantId)`, `create(tenantId)`, `delete(tenantId, { confirm })` (they hard-coded a `tenant_id` column, so apps with `BLOOM_DB_TENANT_COLUMN` got wrong answers; `delete` wiped a tenant's rows). The org-only `req` argument went with them | Your app's own tenants table (e.g. a `Customer` or `Organization` model), queried inside `bypass()`. Deleting a tenant's rows is an explicit app migration or job, not a framework call |
| Auth permissions model: `auth.hasPermission()`, `auth.requireUserPermissions()`, `authClass.getPermissions()`, `BLOOM_AUTH_PERMISSIONS`, the `permissions` token field, the `PermissionDefaults` type | `auth.requireUserRoles([...])` / `auth.hasRole()` on the role ladder (`BLOOM_AUTH_ROLES` to customise). A `permissions` field in a payload is still signed but nothing reads it |
| Auth matrix mode: `BLOOM_AUTH_SCOPES`, `BLOOM_AUTH_TIERS`, `auth.requireScope()`, `auth.requireTier()`, `auth.roleParts()`, `tier` / `scope` token fields | The linear 9-level ladder; the env vars are ignored |
| `auth.canSeePII()`, `auth.maskPII()` | Decide and mask fields in the app's own serializer |
| `security.forms()` (CSRF), `BLOOM_SECURITY_CSRF_*`, `quickSetup({ csrf })`, `validateRequired({ csrf })`, `getStatus().csrf`, the `CSRFConfig` / `CSRFOptions` types | Bearer-token APIs need no CSRF token. Cookie-session HTML forms: `SameSite=Lax/Strict` session cookies or a maintained CSRF middleware. `BLOOM_SECURITY_CSRF_SECRET` is no longer required anywhere |
| `security.input()`, `security.html()`, `security.escape()`, `BLOOM_SECURITY_MAX_INPUT_LENGTH`, `BLOOM_SECURITY_ALLOWED_TAGS`, `BLOOM_SECURITY_STRIP_ALL_TAGS`, the `InputOptions` / `HTMLOptions` / `SanitizationConfig` types | Validate input with a schema (zod, valibot); let the template engine or React escape output; a dedicated sanitizer (e.g. DOMPurify) if you must accept HTML |
| `email.sendTemplate()` and its built-in `welcome` / `reset` templates | Render `html` / `text` in the app (template literal, React Email, MJML) and call `email.send()` |
| Declared dependencies appkit no longer imports: `ioredis`, `commander`, `pg`, `mysql2`, `sqlite`, `sqlite3`, `mongoose`, `bull`, `memcached`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, and the optional peers `express-session`, `fastify`, `@fastify/*`, `multer` | If your app imports any of these itself, add it to your own `package.json` |
| appkit's own `ExpressRequest` / `ExpressResponse` / `ExpressNextFunction` / `ExpressMiddleware` / `ExpressErrorHandler` shapes | The same names still export, as aliases of Express's types (see below) |
| `dist/` in git | Built in CI and by `prepublishOnly`. Installing appkit from a git URL now needs a build step; install from npm |

## Added

- **`@bloomneo/appkit/server`** (also exported from the package root):
  - `createApiRouter({ featuresDir, log? })` replaces the
    `src/api/lib/api-router.ts` every app copied. It mounts
    `features/<name>/<name>.route.ts` at `/api/<name>`, mounts a feature that
    default-exports a `contractRouter()` at its contracts' paths, answers
    `GET /api` with every endpoint (what `verifyClass` reads), answers
    unmatched `/api/*` with a JSON 404, and warns once at boot about
    unguarded features, unmounted `*.route.ts` siblings, load failures and
    folders with no route file. Its guard check recognises app wrappers such
    as `requireLoginOrApiToken`.

    ```ts
    import { createApiRouter, requestId } from '@bloomneo/appkit/server';

    app.use(requestId());
    app.use('/api', await createApiRouter({ featuresDir: join(__dirname, 'features') }));
    ```

  - `route(contract, handler)` + `contractRouter([...])` serve
    `defineRoute()` contracts from `@bloomneo/bloom`. From the contract alone
    they apply the auth decision (`'public'`, `'user'`, `'apiToken'`,
    `{ roles }`), the tenant context (`database.context()` for tenant-scoped
    routes) and params / query / body validation (400 `VALIDATION_ERROR` with
    an `issues` list). The handler returns the body: 201 for POST, 204 for
    `undefined`, otherwise 200. Outside production a response that doesn't
    match `contract.response` is logged. Schemas are any Standard Schema
    (Zod 3.24+, Valibot, ArkType); query values arrive as strings, so use
    coercing schemas.
  - `requestId()` middleware: reuses a safe incoming `X-Request-Id` or makes
    one, echoes it in the response header, sets `req.requestId` and
    `req.requestMetadata.requestId`, and tags every log line written during
    the request (see below).
  - `isTenantScoped(contract)`, `ServerError`, and the types `RouteContract`,
    `RouteAuth`, `StandardSchema`, `ContractRoute`, `ContractHandler`,
    `HandlerContext`, `ApiRouterOptions`, `DiscoveredEndpoint`, `Params`,
    `Query`, `Body`, `Response`.

- **Row-level security** (`BLOOM_DB_TENANT=rls`, Postgres): each model
  operation runs in its own short transaction that sets `app.tenant_id`
  (parameterised, transaction-local, safe behind pgbouncer), and Postgres
  policies enforce the tenant boundary for code that forgot the filter and
  for raw SQL run in the transaction. New API:
  - `database.context()` — Express middleware; mount after
    `auth.requireLoginToken()`. Every database call for the rest of the
    request runs in the caller's tenant, including `get()`.
  - `database.rlsPolicyStatements({ table, column?, policy?, schema? })` / Child tables without a tenant column: `rlsPolicyStatements({ table, via: { parent, foreignKey } })` (`column: false` for grandchildren).
    `database.rlsPolicySql(...)` — the idempotent policy SQL for one table.
  - `database.onBypass(listener)` — audit hook for `bypass()`; returns an
    unsubscribe function.
  - `currentTenant()`, `tenantStore`, `BYPASS_TOKEN` exported from
    `@bloomneo/appkit/database`.
  - `BLOOM_DB_TENANT_COLUMN` (default `tenant_id`) and `BLOOM_PRISMA_CLIENT`
    (a Prisma client generated to a custom `output`).

  Apps that built this themselves (midhuna's `shared/prisma.ts` +
  `shared/rls.ts`) can delete their copy. Cost: three extra round trips per
  operation; measured locally 0.13 → 0.41 ms per query sequentially and
  0.06 → 0.14 ms at 20 in parallel. Connect as an ordinary role: superusers
  and `BYPASSRLS` roles skip policies.

- **`AppError` details:** `new AppError(message, statusCode, type, details?)`.
  `handleErrors()` merges `details` into the response body in every
  environment, so write them for the client.

- **New error classes:** `AuthError` (`/auth`), `ConfigError` (`/config`),
  `VerifyError` (`/verify`), `ServerError` (`/server`), all exported from the
  package root too.

- **Request typing:** `req.user` (login token claims), `req.token` (API token
  claims), `req.requestId` and `req.requestMetadata` are declared on
  `Express.Request`.

- **Newly documented:** `emailClass.reset(config)` applies email settings
  saved in the database at runtime (call it at boot and whenever they change;
  no argument goes back to the environment). Use it instead of rewriting
  `.env`, which fails on read-only hosts.

## Queue: jobs run by default

`queue.process()` handlers now run in production without `BLOOM_QUEUE_WORKER=true`
(it used to be off unless a worker-looking env var was set, so jobs silently
never ran). If you run separate web and worker processes, set
`BLOOM_QUEUE_WORKER=false` on the web ones. `queue.repeat()` is idempotent
across pm2 workers and restarts, so an "only instance 0 schedules" guard can
go.

## Changed

### Every appkit error is an `AppKitError`

In 5.x some modules threw typed errors and others threw plain `Error`, so
apps wrapped appkit in their api-router with duck-typing (`err.message
.startsWith('[@bloomneo/appkit/')`, checking `err.statusCode` / `err.code`
by hand). In 6.0 every module throws an `AppKitError` subclass with
`module` and a stable `code`; message text is unchanged. The database module
has one `DatabaseError` (5.x had a second, plain-`Error` class of the same
name).

**Delete the duck-typing.** Either let `error.handleErrors()` handle it, or:

```ts
import { AppKitError, AppError } from '@bloomneo/appkit';

if (err instanceof AppError) { /* HTTP error: err.statusCode, err.type */ }
else if (err instanceof AppKitError) { /* appkit misuse/config: err.module, err.code → 500 */ }
```

Codes per module are listed in `llms.txt` → "Error Types". Token
verification still throws `TokenError`.

### `error.handleErrors()`

- `AppError` / `SecurityError` keep their status and message, as before.
- Any other error becomes a 500, and **in production its message is
  replaced** by the generic server-error message (`Server error`). Outside
  production the response also carries the appkit `code`. If a client
  depended on seeing a raw internal message in production, throw an
  `AppError` (`error.badRequest(...)`, `error.serverError(...)`) instead.
- A 4xx `AppError` (validation, not found, forbidden) is logged as **one
  warning line** without a stack
  (`[@bloomneo/appkit/error] 404 NOT_FOUND: …`). Server errors are logged
  with the stack as before. Log alerts that matched 4xx on `console.error`
  need to look at warnings.

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
  `req.token` is the API token's `JwtPayload`; `req.requestId` and
  `req.requestMetadata?.requestId` are strings. If the app declared its own
  `user` on `Express.Request`, remove it, or add extra fields to
  `Express.User` instead.
- `error.asyncRoute()` returns a `RequestHandler`; the handler it wraps may
  return anything (`AsyncRouteHandler` returns `unknown`).
- `ExpressRequest`, `ExpressResponse`, `ExpressNextFunction`,
  `ExpressMiddleware`, `ExpressErrorHandler` still export, now as aliases
  of the Express types.

### Request ids reach every log line

Mount `requestId()` first. Every logger line written while handling the
request then carries a `req` field with the id (`req=<id>`), with no id
passed around. A `req` you pass in `meta` yourself wins. Without
`requestId()` nothing changes.

### The tenant follows the request

The tenant comes only from `req.user.tenantId` (or the pre-4.2 `tenant_id`)
set by the login token; headers, route params, query and subdomain are not
read (see Removed). Inside a tenant context — `database.tenant()`,
`database.context()`, a contract route, or a job queued from one — in tenant
mode (`BLOOM_DB_TENANT` set):

- **One client serves every tenant.** The tenant comes from AsyncLocalStorage,
  not from a Prisma client and pool per tenant, so `get()` inside the context
  returns the scoped client and concurrent requests never mix.
- **Jobs keep their tenant.** A job added inside a tenant context runs its
  handler in that tenant; a job added during `bypass()` runs as that bypass.
  appkit stores this as a marker on the job data and strips it before the
  handler sees `data`. In 5.x such a job ran with no tenant (refused in tenant
  mode). Jobs queued before the upgrade have no marker and run as before.
- **Cache keys are per tenant.** Keys become
  `<prefix>:<namespace>:t:<tenantId>:<key>`, so a value cached for one tenant
  never answers another. `bypass()` and code outside any context keep the
  global key space. Values cached inside a tenant context before the upgrade
  are no longer read and expire on their TTL; drop any tenant id you added to
  keys or namespaces by hand.
- **Storage keys are not prefixed** (existing files would move). Keep putting
  the tenant in the key yourself.

### MCP tools declare roles and run in the caller's tenant

`@bloomneo/appkit/mcp` now follows the same rules a route contract enforces:
an auth decision for every tool, and the caller's tenant for every call. In
5.x `roles` was optional and ignored unless the router had `resolveRoles`, so
by default every tool was offered to every connection; and tools ran outside
any tenant context.

- **Add `roles` to every tool.** It is required by the `McpTool` type and
  `register()` throws `MCP_TOOL_NO_ROLES` without a non-empty array of
  `role.level` strings. Use `['user.basic']` for a tool any signed-in caller
  may use (it admits every role); `['admin.tenant']` etc. as for
  `requireUserRoles()`.
- **Pass `resolveRoles` to `mcp.routers()`.** Without it the router throws
  `MCP_NO_ROLE_RESOLVER` at boot. Return the caller's `'role.level'`, or null —
  a null (or throwing) resolver means the caller sees no tools.
- **Tenant mode (`BLOOM_DB_TENANT` set): pass `resolveTenant`** (otherwise
  `MCP_NO_TENANT_RESOLVER`). Each handler runs inside the returned tenant, like
  a route behind `database.context()`; `ctx.tenantId` names it. Delete any
  code in a tool that set the tenant by hand.
- **Replace per-tool cross-tenant access with `database.bypass(reason, fn)`.**
  A caller resolved to a null tenant (platform staff) gets no tenant context,
  so their tools' queries fail closed unless the tool names a bypass.

```ts
const { wellKnown, mcp: mcpRouter } = await mcp.routers({
  serviceName: 'My App',
  authenticate,
  resolveRoles: async (sub) => {
    const user = await getUser(sub);
    return user ? `${user.role}.${user.level}` : null;
  },
  resolveTenant: async (sub) => (await getUser(sub))?.tenantId ?? null,
});
```

Apps that built their own MCP server (their own OAuth endpoints and
Streamable-HTTP transport, as midhuna did) can move onto
`@bloomneo/appkit/mcp`: tools become `features/<name>/<name>.mcp.ts` files,
the OAuth server and transport come from `mcp.routers()`, and the app keeps
only `authenticate`, `resolveRoles` and `resolveTenant`.

### Public contracts don't need auth configured

`route()` only initialises auth for non-public contracts, so an app with no
auth layer (no `BLOOM_AUTH_SECRET`) can serve `auth: 'public'` routes.

### Smaller changes

- `security.quickSetup()` returns just the rate limiter; `getStatus()` has no
  `csrf` field; production validation no longer asks for a CSRF secret.
- `storageClass` detects only Local and S3.
- The queue detects only Memory and Database.
- `loggerClass.getConfig()` no longer reports database / HTTP / webhook URLs.
- `.env.example` documents `BLOOM_DB_TENANT=rls`, `BLOOM_DB_TENANT_COLUMN` and
  `BLOOM_PRISMA_CLIENT`, and drops every removed variable.
