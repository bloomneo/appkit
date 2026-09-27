# @bloomneo/appkit - Database Module 💾

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> Ultra-simple Prisma wrapper with automatic tenant isolation

**One simple function** - `databaseClass.get()` - covers single-tenant apps;
`database.tenant(req, fn)` and `database.bypass(reason, fn)` cover multi-tenant
ones. **Zero configuration needed**, production-ready by default, with
**mandatory future-proofing** built in.

> **See also:** [AGENTS.md](../../AGENTS.md) (agent rules) · [llms.txt](../../llms.txt) (full API reference) · [examples/database.ts](../../examples/database.ts) · cookbook: [auth-protected-crud.ts](../../cookbook/auth-protected-crud.ts), [multi-tenant-saas.ts](../../cookbook/multi-tenant-saas.ts)

## 🚀 Why Choose AppKit Database?

- **⚡ One Function** - `databaseClass.get()` handles all use cases, environment
  controls behavior
- **🔧 Zero Configuration** - Just `DATABASE_URL`, everything else is optional
- **📈 Progressive Scaling** - Start single-tenant, turn on tenant scoping with
  one env var
- **🛡️ Future-Proof Schema** - Mandatory `tenant_id` field prevents migration
  pain
- **🔐 Token-Sourced Tenants** - The tenant comes only from the verified login
  token (`req.user.tenantId`), never from headers or URLs
- **🤖 LLM-Optimized** - Clear variable naming patterns for AI code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

### Database-Specific Dependencies

```bash
# PostgreSQL / MySQL / SQLite with Prisma (the only adapter)
npm install @bloomneo/appkit @prisma/client
```

The Mongoose adapter was removed in 6.0. For MongoDB, use Prisma's `mongodb`
provider.

## 🏃‍♂️ Quick Start (30 seconds)

### Single Database (Day 1)

```typescript
import { databaseClass } from '@bloomneo/appkit/database';

// PostgreSQL / MySQL / SQLite with Prisma
const database = await databaseClass.get();
const users = await database.user.findMany();
```

### Multi-Tenant (Month 6)

```bash
# Add to .env file, then route tenant data through tenant(req, fn)
BLOOM_DB_TENANT=auto
```

```typescript
// Request-scoped: every query in the callback is filtered to the caller's tenant
const users = await databaseClass.tenant(req, (db) => db.user.findMany());

// Admin access to all tenants, on purpose
const allUsers = await databaseClass.bypass('admin user list', (db) => db.user.findMany());
```

**That's it!** The tenant comes from `req.user.tenantId`, which
`auth.requireLoginToken()` puts on the request from the login token.

## 🔒 Multi-tenant mode (5.0)

**Single-tenant apps: nothing here applies.** Leave `BLOOM_DB_TENANT` unset (or
`false`) and `databaseClass.get()` behaves exactly as it always has. Everything
below is opt-in and only affects apps that asked for multi-tenancy.

### The problem this replaces

Before 5.0, a call that failed to resolve a tenant returned **every row** and
looked like it worked. A missing `req`, a token without the claim — the query
succeeded, the page rendered, and the leak was invisible. A production audit
found 4 of 44 route files in exactly that state.

So in tenant mode the unscoped call is no longer available by accident:

```ts
// ✅ Scoped. The tenant comes from req.user.tenantId (the login-token claim).
//    Headers, route params, query strings and subdomains are NOT read (6.0):
//    they are caller-controlled, so reading them let a client pick its tenant.
const clients = await database.tenant(req, (db) => db.client.findMany());

// ✅ Cross-tenant, on purpose. The reason is mandatory and logged.
const firms = await database.bypass('platform admin firm list', (db) => db.firm.findMany());

// ❌ Throws in tenant mode — it cannot prove a tenant was applied.
const db = await databaseClass.get();
```

`grep -rn "bypass(" src/` is therefore the **complete** list of places your app
reads across tenants. That is the property worth having: not that scoping is
applied, but that its absence is enumerable.

### Which one to use

| Situation | Call |
|---|---|
| Any request-scoped query in a multi-tenant app | `database.tenant(req, fn)` |
| Platform/admin route that is cross-tenant by design | `database.bypass(reason, fn)` |
| Pre-login lookup (no user yet) | `database.bypass(reason, fn)` |
| Single-tenant app | `databaseClass.get()` |

### Failure modes, and what each one means

| Error code | Meaning |
|---|---|
| `DATABASE_UNSCOPED_IN_TENANT_MODE` | `get()` called with no resolvable tenant. Usually a call site that forgot to pass `req`. |
| `DATABASE_NO_TENANT` | `tenant()` ran but nothing resolved — most often the login token has no `tenantId` claim. |
| `DATABASE_TENANT_MODE_OFF` | `tenant()` called in a single-tenant app. Use `get()`. |
| `DATABASE_BYPASS_NO_REASON` | `bypass()` without a specific reason. An unexplained bypass is indistinguishable from a forgotten scope. |
| `DATABASE_NO_TENANT_CONTEXT` | A scoped client was used outside `tenant()`, `context()` or `bypass()`, so there is no tenant to filter by. |

Put the claim in the token at login and the whole thing composes:

```ts
auth.generateLoginToken({ userId: user.id, role: user.role, level: user.level, tenantId: user.firmId });
```

## 🧱 Row-level security

`auto` filters in the app: every Prisma model operation gets
`tenant_id = <tenant>`. `rls` adds the database's own check: each operation
runs in a short transaction that first sets `app.tenant_id`, and a Postgres
policy on each tenant table only shows (and only accepts) that tenant's rows.
The policy also covers raw SQL run in the transaction, and code that forgot
the filter. Outside any context `app.tenant_id` is unset and the policy
returns nothing — it fails closed.

```ts
// 1. Once per tenant table, in a migration:
for (const sql of database.rlsPolicyStatements({ table: 'invoices' })) {
  await db.$executeRawUnsafe(sql);
}

// 2. Bind the tenant for a whole request (after the login check):
router.use(auth.requireLoginToken(), database.context());
//    …then any database call in the request is scoped, including get():
const db = await databaseClass.get();
await db.invoice.findMany();              // only this tenant's invoices

// 3. Audit every deliberate cross-tenant read:
database.onBypass(({ reason }) => audit.log('tenant.bypass', { reason }));
```

- One client serves every tenant; the tenant for each operation comes from the
  request context, so concurrent requests never mix.
- One transaction per operation (not per request), so parallel reads in a
  request still run in parallel.
- The setting is transaction-local (`set_config(..., true)`), so it is safe
  behind pgbouncer in transaction pooling.
- **Cost:** each operation adds three round trips (begin, set tenant,
  commit). Measured on a local Postgres (2,000 reads): 0.13 → 0.41 ms per
  query sequentially, 0.06 → 0.14 ms at 20 in parallel. Against a database
  ~1 ms away expect roughly +3 ms per query — fine for most apps; for hot,
  chatty endpoints keep the database close or batch the reads.
- `BLOOM_DB_TENANT_COLUMN` names the tenant column (default `tenant_id`).
- Superusers and roles with `BYPASSRLS` skip policies. Connect the app as an
  ordinary role. A backup role needs `BYPASSRLS` (and `CONNECT`), or
  `pg_dump` fails on every table with a policy.
- `BLOOM_PRISMA_CLIENT` points appkit at a Prisma client generated to a
  custom `output` path.

## 🎯 Core API

### **One Function Rule: `databaseClass.get()`**

```typescript
// Normal user access (single tenant or their specific tenant)
const database = await databaseClass.get();

// Tenant-scoped access (multi-tenant apps)
const users = await databaseClass.tenant(req, (db) => db.user.findMany());

// Admin access to all tenants — a specific reason is required and logged
const allUsers = await databaseClass.bypass('admin user list', (db) => db.user.findMany());
```

### **LLM-Friendly Variable Naming**

```typescript
// Standard patterns for AI code generation:
const database = await databaseClass.get(); // Single-tenant apps
await databaseClass.tenant(req, (db) => db.user.findMany()); // One tenant's data
await databaseClass.bypass('specific reason', (db) => db.user.findMany()); // All tenants (admin)
```

## 🛡️ Mandatory Future-Proofing

### **Required Schema Pattern**

**EVERY table MUST include `tenant_id` field from Day 1:**

#### **SQL Databases (Prisma)**

```sql
-- ✅ CORRECT: Future-proof schema
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  name text,
  tenant_id text,  -- MANDATORY: nullable for future compatibility
  created_at timestamp DEFAULT now(),

  INDEX idx_users_tenant (tenant_id)  -- MANDATORY: performance index
);

CREATE TABLE posts (
  id uuid PRIMARY KEY,
  title text,
  content text,
  user_id uuid REFERENCES users(id),
  tenant_id text,  -- MANDATORY: on EVERY table
  created_at timestamp DEFAULT now(),

  INDEX idx_posts_tenant (tenant_id)  -- MANDATORY: on EVERY table
);
```

```prisma
// Prisma schema example
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  tenant_id String?  // MANDATORY: nullable for future use
  createdAt DateTime @default(now())

  @@index([tenant_id])  // MANDATORY: performance index
  @@map("users")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  userId    String
  tenant_id String?  // MANDATORY: on EVERY table
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([tenant_id])  // MANDATORY: on EVERY table
  @@map("posts")
}
```

### **Why Mandatory `tenant_id`?**

- ✅ **Zero Migration Pain** - Enable multi-tenancy later with just environment
  variables
- ✅ **Performance Ready** - Indexes in place from day 1
- ✅ **No Data Restructuring** - Never need to alter table schemas
- ✅ **Gradual Adoption** - Start single-tenant, scale when needed

## 🌍 Environment Configuration

### **Minimal Setup (2 Variables)**

```bash
# Required: Main database connection
DATABASE_URL=postgresql://localhost:5432/myapp  # PostgreSQL
# OR
DATABASE_URL=mysql://localhost:3306/myapp       # MySQL
# OR
DATABASE_URL=file:./dev.db                      # SQLite (Prisma)

# Optional: Enable tenant mode (tenant read from req.user.tenantId)
BLOOM_DB_TENANT=auto
```

### **App Discovery (Monorepo)**

```bash
# Optional: Override the apps directory used by the Prisma adapter for
# auto-discovering per-app clients.
# Defaults to searching upwards from process.cwd() for an `apps/` folder.
BLOOM_APPS_DIR=/absolute/path/to/apps
```

## 💡 Real-World Examples

### **Progressive Scaling Journey**

```typescript
/**
 * Day 1: Simple blog application
 */
async function getBlogPosts() {
  const database = await databaseClass.get();
  return await database.posts.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Month 6: Add team workspaces
 * Add BLOOM_DB_TENANT=auto to .env and pass the request through.
 */
async function getBlogPosts(req) {
  return await databaseClass.tenant(req, (db) =>
    db.posts.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

/**
 * Admin dashboard (any time)
 */
async function getAllPosts() {
  return await databaseClass.bypass('admin dashboard: all posts', (db) =>
    db.posts.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    }),
  );
}
```

### **Multi-Tenant API Endpoints**

```typescript
import { databaseClass } from '@bloomneo/appkit/database';

// User endpoints - filtered to the tenant in the login token
app.get('/api/users', auth.requireLoginToken(), async (req, res) => {
  const users = await databaseClass.tenant(req, (db) => db.user.findMany());
  res.json(users); // Only user's tenant data
});

app.post('/api/users', auth.requireLoginToken(), async (req, res) => {
  const user = await databaseClass.tenant(req, (db) =>
    db.user.create({ data: req.body }), // tenant_id added automatically
  );
  res.json(user);
});

// Admin endpoints - see all tenant data
app.get('/api/admin/users', requireUserRoles(['admin']), async (req, res) => {
  const users = await databaseClass.bypass('admin user list', (db) =>
    db.user.findMany({
      include: { _count: { select: { posts: true } } },
    }),
  );
  res.json(users); // All tenants data
});
```

## 🔧 Automatic Context Detection

### **Tenant Source** (when `BLOOM_DB_TENANT=auto`)

```typescript
// The only sources AppKit reads:
const tenantId =
  req.user?.tenantId || // login-token claim (auth 4.2.0+)
  req.user?.tenant_id || // pre-4.2 claim shape
  null; // no tenant → tenant() and get() throw
```

`x-tenant-id` headers, `:tenantId` route params, `?tenant=` and subdomains are
not read (removed in 6.0). Any client can set those, so trusting them let a
caller choose someone else's tenant. Put `tenantId` in the login token and mount
`auth.requireLoginToken()` before tenant routes.

## 🚀 Framework Integration

### **Express.js**

```typescript
import express from 'express';
import { databaseClass } from '@bloomneo/appkit/database';

const app = express();

// Simple route - auto-detects tenant from request
app.get('/users', async (req, res) => {
  const database = await databaseClass.get();
  const users = await database.user.findMany();
  res.json(users);
});

// Admin route - access all tenants
app.get('/admin/users', requireAdmin, async (req, res) => {
  const users = await databaseClass.bypass('admin user list', (db) => db.user.findMany());
  res.json(users);
});
```

### **Fastify**

```typescript
import Fastify from 'fastify';
import { databaseClass } from '@bloomneo/appkit/database';

const fastify = Fastify();

fastify.get('/users', async (request, reply) => {
  const database = await databaseClass.get();
  const users = await database.user.findMany();
  return users;
});

fastify.get(
  '/admin/users',
  { preHandler: requireAdmin },
  async (request, reply) => {
    return databaseClass.bypass('admin user list', (db) => db.user.findMany());
  }
);
```

### **Next.js API Routes**

```typescript
// pages/api/users.ts
import { databaseClass } from '@bloomneo/appkit/database';

export default async function handler(req, res) {
  const database = await databaseClass.get();

  if (req.method === 'GET') {
    const users = await database.user.findMany();
    res.json(users);
  } else if (req.method === 'POST') {
    const user = await database.user.create({ data: req.body });
    res.json(user);
  }
}

// pages/api/admin/users.ts
import { databaseClass } from '@bloomneo/appkit/database';

export default async function handler(req, res) {
  const users = await databaseClass.bypass('admin user list', (db) => db.user.findMany());
  res.json(users);
}
```

## 🛠️ Advanced Features

### **Health Monitoring**

```typescript
// System health check
const health = await databaseClass.health();
console.log(health);
// {
//   healthy: true,
//   connections: 3,
//   timestamp: "2024-01-15T10:30:00.000Z"
// }
```

### **Tenant Management**

appkit keeps no tenant registry. Tenants are rows in your own table (a
`Customer`, `Organization` or `Firm` model), read and written inside
`bypass()` because that table is not scoped to one tenant. The 5.x helpers
`getTenants()`, `list()`, `exists()`, `create()` and `delete()` were removed in
6.0 (see MIGRATION-6.md).

```typescript
// List tenants
const tenants = await databaseClass.bypass('admin tenant list', (db) =>
  db.organization.findMany({ select: { id: true, name: true } }),
);

// Create a tenant
const org = await databaseClass.bypass('provision tenant', (db) =>
  db.organization.create({ data: { name: 'New Team' } }),
);

// Deleting a tenant's rows is an explicit app migration or job, not a framework call.
```

### **Connection Management**

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await databaseClass.disconnectAll();
  process.exit(0);
});
```

## 📊 Performance & Scaling

### **Connection Pooling**

- **Automatic caching** - Connections reused per tenant
- **Memory efficient** - Connections shared across requests

### **Database Performance**

- **Mandatory indexes** - `tenant_id` indexed on all tables from day 1
- **Query optimization** - Automatic tenant filtering at database level
- **Connection limits** - Respects database provider connection pools

### **Scaling Characteristics**

- **Single tenant**: 1 connection per app
- **Multi-tenant**: 1 connection (shared filtering)

## 🔍 Migration Guide

### **From Direct Prisma**

```typescript
// Before: Direct Prisma usage
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.user.findMany();

// After: AppKit Database
import { databaseClass } from '@bloomneo/appkit/database';
const database = await databaseClass.get();
const users = await database.user.findMany();
```

### **From Manual Multi-Tenancy**

```typescript
// Before: Manual tenant filtering everywhere
const users = await prisma.user.findMany({
  where: { tenant_id: getTenantId(req) },
});

// After: Automatic tenant filtering
const users = await databaseClass.tenant(req, (db) => db.user.findMany()); // tenant_id added automatically
```

### **Schema Migration**

```sql
-- Add tenant_id to existing tables
ALTER TABLE users ADD COLUMN tenant_id text;
ALTER TABLE posts ADD COLUMN tenant_id text;
ALTER TABLE comments ADD COLUMN tenant_id text;

-- Add performance indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_posts_tenant ON posts(tenant_id);
CREATE INDEX idx_comments_tenant ON comments(tenant_id);

-- Set existing data to null (single tenant mode)
-- No data changes needed - null = single tenant
```

## 🤖 LLM Guidelines

### **Variable Naming Patterns**

```typescript
// ✅ Standard patterns for AI code generation:

// Normal user access (single or tenant mode)
const database = await databaseClass.get();

// Tenant-scoped access (multi-tenant apps)
const users = await databaseClass.tenant(req, (db) => db.user.findMany());

// Admin access to all tenants (reason required, logged)
const allUsers = await databaseClass.bypass('admin user list', (db) => db.user.findMany());
```

### **Common Patterns**

```typescript
// ✅ User data access
const database = await databaseClass.get();
const users = await database.user.findMany();

// ✅ Admin functionality
const allUsers = await databaseClass.bypass('admin user list', (db) => db.user.findMany());

// ✅ Cross-tenant analytics (admin)
const analytics = await databaseClass.bypass('tenant usage report', (db) => db.user.groupBy({
  by: ['tenant_id'],
  _count: true,
}));
```

### **Schema Requirements**

```typescript
// ✅ ALWAYS include in ALL models (SQL):
model AnyTable {
  id        String   @id @default(cuid())
  // ... your fields ...
  tenant_id String?  // MANDATORY: nullable for future use

  @@index([tenant_id])  // MANDATORY: performance index
}

```

## 🚨 Common Mistakes to Avoid

### **❌ Schema Mistakes**

```sql
-- ❌ DON'T: Missing tenant_id field
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text,
  name text
  -- Missing tenant_id - will need painful migration later
);

-- ✅ DO: Always include tenant_id (SQL)
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text,
  name text,
  tenant_id text,  -- Future-proof from day 1
  INDEX idx_tenant (tenant_id)
);
```

### **❌ API Usage Mistakes**

```typescript
// ❌ DON'T: Hard-code tenant access (any database)
const users = await prisma.user.findMany({
  where: { tenant_id: 'hardcoded-tenant' },
});

// ✅ DO: Use databaseClass.tenant() for automatic filtering
const users = await databaseClass.tenant(req, (db) => db.user.findMany()); // Auto-filtered

// ❌ DON'T: Take the tenant from a header or URL
const users = await databaseClass.tenant({ user: { tenantId: req.headers['x-tenant-id'] } }, fn); // caller picks the tenant

// ❌ DON'T: Hold an unscoped client and hope nobody reuses it
const database = await databaseClass.get();
const users = await database.user.findMany(); // Which tenant am I in?

// ✅ DO: Say which kind of access each call is
const mine = await databaseClass.tenant(req, (db) => db.user.findMany()); // One tenant
const all = await databaseClass.bypass('admin user list', (db) => db.user.findMany()); // Admin, logged
```

## 🔧 Troubleshooting

### **Database Connection Issues**

```typescript
// Check configuration
import { databaseClass } from '@bloomneo/appkit/database';

const health = await databaseClass.health();
if (!health.healthy) {
  console.error('Database issue:', health.error);
}
```

### **Missing tenant_id Fields**

```bash
# Development warning will show:
# Model 'User' missing required field 'tenant_id'
# Add: tenant_id String? @map("tenant_id") to your Prisma schema
```

### **Health Checks**

```typescript
import { databaseClass } from '@bloomneo/appkit/database';

// Use in a health endpoint — pings the database and reports open connections.
const status = await databaseClass.health();
// { healthy: true, connections: 3, timestamp: '...' }
```

## 📈 Roadmap

- **Vector Search Support** - Built-in pgvector integration
- **Read Replicas** - Automatic read/write splitting
- **Connection Pooling** - Advanced connection management
- **Schema Migrations** - Automated tenant-aware migrations
- **Analytics Dashboard** - Built-in multi-tenant analytics

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built for developers who value simplicity and future-proof architecture</strong><br>
  <a href="https://github.com/bloomneo/appkit">⭐ Star us on GitHub</a> •
  <a href="https://discord.gg/bloomneo">💬 Join our Discord</a> •
  <a href="https://twitter.com/bloomneo">🐦 Follow on Twitter</a>
</p>

---

## Agent-Dev Friendliness Score

> Snapshot from before 6.0. `org()`, per-org databases, the Mongoose adapter and the tenant helpers (`getTenants`, `list`, `exists`, `create`, `delete`) it mentioned have since been removed; the method lists below are trimmed to what still exists.

**Score: 75/100 — 🟡 Solid** *(capped at 75: module README has zero pointers to `AGENTS.md`, `examples/`, or `llms.txt`; weighted raw = 75.5)*
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../docs/AGENT_DEV_SCORING_ALGORITHM.md) v1.1*
*Delta vs previous (2026-04-13, 68/100): **+7***

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **10** | All public methods (`get`, `health`, `disconnect`) exist as documented. README / `examples/database.ts` / `cookbook/*.ts` / `llms.txt` / root `README.md` all use `databaseClass`. Drift-check test (`database.test.ts`) enforces both the presence list and a hallucination blocklist (`query`, `transaction`, `model`, `findMany`, …). |
| 2 | Doc consistency | **9** | Every surface uses `databaseClass.get(req)`. `cookbook/auth-protected-crud.ts` and `multi-tenant-saas.ts` pass `req` consistently for tenant scoping. One minor gap: module README body has no explicit pointer to `AGENTS.md` / `examples/` / `llms.txt`. |
| 3 | Runtime verification | **6** | `database.test.ts` verifies all 9 methods exist + blocks 9 hallucinated names + checks `org()` contract. `examples/database.ts` is runtime-verified today. Still no behaviour tests for the tenant middleware itself (no fake Prisma/Mongoose harness). |
| 4 | Type safety | **5** | Unchanged from previous: `req: any`, `options: any`, `DatabaseClientUnion` contains `[key: string]: any`. Return type is a `PrismaClient \| MongooseConnection` union; autocomplete is best-effort at the call site. |
| 5 | Discoverability | **7** | `package.json` description + README hero give one canonical import in the first 30 lines. `databaseClass` is the only exported entry symbol. Still no explicit "See also" block pointing at `AGENTS.md` / `llms.txt` / `examples/database.ts` from the top of the README. |
| 6 | Example completeness | **9** | `examples/database.ts` now exercises `get`, `get(req)`, `health`, `disconnect`. Runtime-verified 2026-04-14. |
| 7 | Composability | **9** | Two cookbook recipes compose `databaseClass` with the rest of the stack and typecheck clean: `cookbook/auth-protected-crud.ts` (auth + database + error + logger) and `cookbook/multi-tenant-saas.ts` (auth + database + cache + error + logger). Both call `databaseClass.get(req)` — the canonical tenant-aware pattern. |
| 8 | Educational errors | **8** | Every throw site is prefixed `[@bloomneo/appkit/database]`, names the missing/invalid input, and appends `See: ${DOCS_URL}#<anchor>`. Examples: `Database URL required. Set DATABASE_URL environment variable. See …#environment-variables`, `No database URL found for organization 'X'`, `No database URL found for organization 'X'`. |
| 9 | Convention enforcement | **8** | One canonical pattern per task: `get(req)` for user data. Variable-name convention (`database`) is documented and matches examples + cookbook + llms.txt. |
| 10 | Drift prevention | **5** | `database.test.ts` is the drift gate and runs under `vitest`. No dedicated CI job asserts the doc ↔ source mapping; the gate is only "did someone run the test suite". |
| 11 | Reading order | **4** | Module README still has no pointer block to `AGENTS.md`, `llms.txt`, `examples/database.ts`, or the cookbook. A fresh agent landing here has to guess where to go next. This is what triggers the 75 anti-pattern cap. |
| **12** | **Simplicity** | **7** | 80% case is one call (`await databaseClass.get(req)`) with one optional arg. |
| **13** | **Clarity** | **9** | Every method reads as its behaviour: `get`, `health`, `disconnect`. No vague verbs (`process`, `handle`, `run`). Parameter names are self-describing. |
| **14** | **Unambiguity** | **5** | Unchanged. `get()` can return a Prisma client *or* a Mongoose connection — the caller has to runtime-probe (`db.$queryRaw` vs `db.db`). |
| **15** | **Learning curve** | **6** | Fresh dev hits a working snippet in the first 60 lines of README. Progressive story (single → multi-tenant → multi-org via env vars only) is well-told. Friction remains around (a) the Prisma vs Mongoose return union, and (b) the "pass `req` to enable tenant filtering" implicit contract. |

### Weighted (v1.1)

```
(10×.12)+(9×.08)+(6×.09)+(5×.06)+(7×.06)+(9×.08)+(9×.06)+(8×.05)+(8×.05)+(5×.04)+(4×.03)
+(7×.09)+(9×.09)+(5×.05)+(6×.05) = 7.55 → 75.5 → 75/100 (after README-pointer cap)
```

### Cap status

- **Active cap:** 75/100 — "README has zero pointers to AGENTS.md, examples, or llms.txt" (anti-pattern table).
- Raw weighted score (75.5) is already under the cap, so the cap costs ~0.5 points here. Landing a pointer block lifts the ceiling and takes D11 to ~8, pushing the raw score toward 78.

### Gaps to reach 🟢 85+

1. **D11 Reading order → 8 + lift cap**: Add a "See also" block near the top of this README pointing to `AGENTS.md`, `llms.txt`, `examples/database.ts`, `cookbook/auth-protected-crud.ts`, `cookbook/multi-tenant-saas.ts`. Removes the 75 cap.
2. **D3 Runtime verification → 8**: Add a fake adapter that records `$use` middleware calls so tenant-filter behaviour (create stamping, findMany filter injection, OR/AND rewrite) is exercised under vitest without a real DB.
3. **D4 Type safety → 8**: Narrow `req` to `{ headers?, user?, params?, query?, hostname? }`, and add an adapter-aware return generic (`databaseClass.get<'prisma'>(req)` → `PrismaClient`).
4. **D14 Unambiguity → 7**: Expose `client._adapter: 'prisma' | 'mongoose'` publicly and document it as the supported runtime discriminator.
5. **D10 Drift prevention → 7**: Wire `database.test.ts` (plus a doc-ref scan) into a dedicated CI job so a README rename breaks the build, not just the test suite.

**Realistic ceiling with fixes 1–5:** ~84/100. Breaking past that requires typed adapter generics propagated through `get` and `org().get` at the call site.
