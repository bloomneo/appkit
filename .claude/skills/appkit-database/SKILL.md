---
name: appkit-database
description: >-
  Use when writing code that queries Postgres, MySQL, SQLite, or MongoDB via
  `@bloomneo/appkit/database`. Covers the canonical `await databaseClass.get()`
  pattern, provider auto-detection from `DATABASE_URL`, and multi-tenant
  filtering via `BLOOM_DB_TENANT`.
---

# @bloomneo/appkit/database

Single-entry DB access: `await databaseClass.get()` returns a Prisma-style
client scoped to the right tenant context. Provider is auto-detected from the
`DATABASE_URL` scheme.

## Canonical flow

```ts
import { databaseClass } from '@bloomneo/appkit/database';

// Always `await` — DB client construction is async (connect + schema introspect).
const db = await databaseClass.get();

const users = await db.user.findMany();
const user = await db.user.create({ data: { email: 'x@y.com' } });
```

## Provider auto-detection

| `DATABASE_URL` scheme | Provider |
|---|---|
| `postgresql://…` / `postgres://…` | Postgres (via `pg`) |
| `mysql://…` | MySQL (via `mysql2`) |
| `mongodb://…` | MongoDB (via `mongoose`) |
| `file:./…` / `sqlite://…` | SQLite (via `sqlite3`) |

No extra config. Don't import Prisma/Mongoose directly — let the module pick.

## Multi-tenant mode

Set `BLOOM_DB_TENANT=auto` and the module injects `WHERE tenant_id = ?` into
every query automatically. `req.tenant_id` is expected to be set (by auth
middleware or your own). You do NOT write the filter manually.

```ts
// With BLOOM_DB_TENANT=auto, this is auto-scoped to req.tenant_id:
const orders = await db.order.findMany();
```

Leave `BLOOM_DB_TENANT` unset (or `false`) for single-tenant apps.

## Public API

```ts
await databaseClass.get()                 // → DB client (singleton per tenant)
await databaseClass.get(tenantId)         // → DB client for explicit tenant
databaseClass.getActiveTenantIds()        // → string[] (debug)
databaseClass.getProvider()               // → 'postgres' | 'mysql' | 'sqlite' | 'mongoose'
databaseClass.disconnectAll()             // → Promise<void> (teardown; closes every cached org/tenant connection)
databaseClass.reset(newConfig?)           // → void (tests only)
```

## Env vars

- `DATABASE_URL` — **required** (format defines provider)
- `BLOOM_DB_TENANT` — `auto` | `false` (default: `false`)

## Common mistakes

- `databaseClass.get()` without `await` — returns a Promise, not the client.
- Importing Prisma directly — bypasses tenant scoping.
- Writing `WHERE tenant_id = ?` manually when `BLOOM_DB_TENANT=auto` — double
  filter, returns zero rows.
