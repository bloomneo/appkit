---
name: appkit-database
description: >-
  Use when writing code that queries Postgres, MySQL, SQLite, or MongoDB via
  `@bloomneo/appkit/database`. Covers `database.tenant(req, fn)` for
  multi-tenant apps, `databaseClass.get()` for single-tenant ones, and
  provider auto-detection from `DATABASE_URL`.
---

# @bloomneo/appkit/database

Which call you use depends on one thing: whether the app is multi-tenant.

| App | Call |
|---|---|
| Single-tenant (`BLOOM_DB_TENANT` unset or `false`) | `await databaseClass.get()` |
| Multi-tenant, request-scoped query | `await database.tenant(req, fn)` |
| Multi-tenant, deliberate cross-tenant access | `await database.bypass(reason, fn)` |

## Single-tenant — unchanged

```ts
import { databaseClass } from '@bloomneo/appkit/database';

// Always `await` — client construction is async.
const db = await databaseClass.get();
const users = await db.user.findMany();
```

## Multi-tenant (5.0+) — `get()` fails closed

With `BLOOM_DB_TENANT` enabled, `databaseClass.get()` **throws** when no tenant
resolves, instead of returning an unscoped client. Before 5.0 it returned every
row and looked like it worked; a production audit found 4 of 44 route files in
exactly that state.

```ts
// ✅ Scoped. Tenant comes from req.user.tenantId (the login-token claim),
//    x-tenant-id, a :tenantId param, or the subdomain.
const clients = await database.tenant(req, (db) => db.client.findMany());

// ✅ Cross-tenant on purpose. The reason is mandatory and logged.
const firms = await database.bypass('platform admin firm list', (db) => db.firm.findMany());

// ❌ Throws: DATABASE_UNSCOPED_IN_TENANT_MODE
const db = await databaseClass.get();
```

`grep -rn "bypass(" src/` is the complete list of cross-tenant reads in the app.
That enumerability is the point.

Put the claim in the token at login and it all composes:

```ts
auth.generateLoginToken({ userId, role, level, tenantId: user.firmId });
```

## Provider auto-detection

| `DATABASE_URL` scheme | Provider | Adapter |
|---|---|---|
| `postgresql://…` / `postgres://…` | postgresql | Prisma |
| `mysql://…` | mysql | Prisma |
| `mongodb://…` / `mongodb+srv://…` | mongodb | Mongoose |
| `file:./…` (Prisma's SQLite form) / `sqlite://…` | sqlite | Prisma |

Don't import Prisma or Mongoose directly — let the module pick.

## Public API

Verified against `src/database/index.ts`.

```ts
await databaseClass.get(req?)                  // client (throws unscoped in tenant mode)
await databaseClass.tenant(req, fn)            // scoped callback
await databaseClass.bypass(reason, fn)         // unscoped callback, logged
await databaseClass.getTenants(req?)           // unfiltered client (admin)
databaseClass.org(orgId)                       // per-org database handle
await databaseClass.health()
await databaseClass.list() / .exists(id) / .create(id) / .delete(id)
await databaseClass.disconnectAll()            // teardown
```

There is no `getProvider()`, no `getActiveTenantIds()`, and no
`databaseClass.reset()` — earlier versions of this file listed all three and
none has ever existed.

## Env vars

- `DATABASE_URL` — **required** (format defines the provider)
- `BLOOM_DB_TENANT` — `auto` | `false` (default: unset = single-tenant)

## Error codes

| Code | Meaning |
|---|---|
| `DATABASE_UNSCOPED_IN_TENANT_MODE` | `get()` with no tenant — usually a missing `req` |
| `DATABASE_NO_TENANT` | `tenant()` resolved nothing — usually no `tenantId` claim |
| `DATABASE_TENANT_MODE_OFF` | `tenant()` in a single-tenant app — use `get()` |
| `DATABASE_BYPASS_NO_REASON` | `bypass()` without a specific reason |

## Common mistakes

- `databaseClass.get()` without `await` — returns a Promise, not the client.
- Using `get()` for tenant data in a multi-tenant app — it cannot prove a
  tenant was applied, so it throws. Use `tenant(req, fn)`.
- Reaching for `bypass()` because `tenant()` threw — that throw usually means
  the login token is missing its `tenantId` claim. Fix the token.
- Importing Prisma directly — bypasses every scoping guarantee above.
