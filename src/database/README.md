# @bloomneo/appkit - Database Module 💾

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> Ultra-simple database wrapper with automatic tenant isolation and progressive
> multi-organization support that grows with your needs

**One simple function** - `databaseClass.get()` - handles everything from single
databases to complex multi-org, multi-tenant architectures. **Zero configuration
needed**, production-ready by default, with **mandatory future-proofing** built
in.

## 🚀 Why Choose AppKit Database?

- **⚡ One Function** - `databaseClass.get()` handles all use cases, environment
  controls behavior
- **🔧 Zero Configuration** - Just `DATABASE_URL`, everything else is optional
- **📈 Progressive Scaling** - Start simple, add tenants/orgs with zero code
  changes
- **🛡️ Future-Proof Schema** - Mandatory `tenant_id` field prevents migration
  pain
- **🔥 Hot Reload** - Change `.env` file, connections update instantly
- **🌍 Multi-Cloud Ready** - Each org can use different cloud providers
- **🤖 LLM-Optimized** - Clear variable naming patterns for AI code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

### Database-Specific Dependencies

```bash
# PostgreSQL/MySQL/SQLite with Prisma
npm install @bloomneo/appkit @prisma/client

# MongoDB with Mongoose
npm install @bloomneo/appkit mongoose

# Multi-database setup (both ORMs)
npm install @bloomneo/appkit @prisma/client mongoose
```

## 🏃‍♂️ Quick Start (30 seconds)

### Single Database (Day 1)

```typescript
import { databaseClass } from '@bloomneo/appkit/database';

// PostgreSQL/MySQL with Prisma
const database = await databaseClass.get();
const users = await database.user.findMany();

// MongoDB with Mongoose
const database = await databaseClass.get();
const users = await database.User.find();
```

### Multi-Tenant (Month 6 - Zero Code Changes!)

```bash
# Add to .env file - code stays exactly the same
BLOOM_DB_TENANT=auto
```

```typescript
// Same code, now tenant-filtered automatically
const database = await databaseClass.get(); // User's tenant data only

// Prisma (SQL databases)
const users = await database.user.findMany(); // Auto-filtered by tenant

// Mongoose (MongoDB)
const users = await database.User.find(); // Auto-filtered by tenant

// Admin access to all tenants
const dbTenants = await databaseClass.getTenants();
const allUsers = await dbTenants.user.findMany(); // Prisma - All tenant data
const allUsers = await dbTenants.User.find(); // Mongoose - All tenant data
```

### Multi-Organization (Year 1 - Still Zero Code Changes!)

```bash
# Add org-specific databases to .env
ORG_ACME=postgresql://acme.aws.com/prod      # PostgreSQL on AWS
ORG_TECH=mongodb://tech.azure.com/prod       # MongoDB on Azure
ORG_STARTUP=mysql://startup.gcp.com/prod     # MySQL on GCP
```

```typescript
// Same code, now org-aware with auto-adapter detection
const acmedatabase = await databaseClass.org('acme').get(); // Uses Prisma for PostgreSQL
const techdatabase = await databaseClass.org('tech').get(); // Uses Mongoose for MongoDB
const startupdatabase = await databaseClass.org('startup').get(); // Uses Prisma for MySQL

// Different database queries, same simple API
const acmeUsers = await acmedatabase.user.findMany(); // Prisma syntax
const techUsers = await techdatabase.User.find(); // Mongoose syntax
const startupUsers = await startupdatabase.user.findMany(); // Prisma syntax

// Org admin access
const acmeDbTenants = await databaseClass.org('acme').getTenants();
const techDbTenants = await databaseClass.org('tech').getTenants();
```

**That's it!** Your code never changes, only your environment evolves.

## 🎯 Core API

### **One Function Rule: `databaseClass.get()`**

```typescript
// Normal user access (single tenant or their specific tenant)
const database = await databaseClass.get();

// Admin access to all tenants
const dbTenants = await databaseClass.getTenants();

// Organization-specific access
const acmedatabase = await databaseClass.org('acme').get();
const acmeDbTenants = await databaseClass.org('acme').getTenants();
```

### **LLM-Friendly Variable Naming**

```typescript
// Standard patterns for AI code generation:
const database = await databaseClass.get(); // Single/tenant user data
const dbTenants = await databaseClass.getTenants(); // All tenants (admin)
const acmedatabase = await databaseClass.org('acme').get(); // Acme org data
const acmeDbTenants = await databaseClass.org('acme').getTenants(); // All Acme tenants
```

## 🛡️ Mandatory Future-Proofing

### **Required Schema Pattern**

**EVERY table/collection MUST include `tenant_id` field from Day 1:**

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

#### **MongoDB (Mongoose)**

```javascript
// Mongoose schema example
const userSchema = new Schema({
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  tenant_id: { type: String, index: true }, // MANDATORY: indexed for performance
  createdAt: { type: Date, default: Date.now },
});

// MANDATORY: Index for performance
userSchema.index({ tenant_id: 1 });

const postSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tenant_id: { type: String, index: true }, // MANDATORY: on EVERY schema
  createdAt: { type: Date, default: Date.now },
});

// MANDATORY: Index on every schema
postSchema.index({ tenant_id: 1 });

export const User = model('User', userSchema);
export const Post = model('Post', postSchema);
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
DATABASE_URL=mongodb://localhost:27017/myapp    # MongoDB
# OR
DATABASE_URL=mysql://localhost:3306/myapp       # MySQL

# Optional: Enable tenant mode (auto-detects from requests)
BLOOM_DB_TENANT=auto
```

### **Multi-Database & Multi-Organization Setup**

```bash
# Fallback database
DATABASE_URL=postgresql://localhost:5432/main

# Organization-specific databases (any provider)
ORG_ACME=postgresql://acme.aws.com/prod         # PostgreSQL on AWS
ORG_TECH=mongodb://tech.azure.com/db            # MongoDB on Azure
ORG_STARTUP=mysql://startup.gcp.com/prod        # MySQL on GCP
ORG_LOCAL=sqlite:///local/dev.db                # SQLite for development
ORG_LEGACY=mongodb://legacy.onprem.com/data     # On-premise MongoDB

# Enable tenant mode within each org
BLOOM_DB_TENANT=auto
```

### **Hot Reload Magic**

```bash
# Change .env file while app is running:
echo "ORG_NEWCLIENT=postgresql://newclient.com/db" >> .env

# Connections update instantly - no server restart needed! 🔥
```

### **App Discovery (Monorepo)**

```bash
# Optional: Override the apps directory used by the Prisma / Mongoose
# adapters for auto-discovering per-app clients and models.
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
 * Month 6: Add team workspaces (zero code changes!)
 * Just add: BLOOM_DB_TENANT=auto to .env
 */
async function getBlogPosts() {
  const database = await databaseClass.get(); // Now auto-filters by tenant
  return await database.posts.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Year 1: Multi-organization SaaS (still zero code changes!)
 * Just add org URLs to .env
 */
async function getBlogPosts() {
  const database = await databaseClass.get(); // Now org + tenant aware
  return await database.posts.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Admin dashboard (any time)
 */
async function getAllOrgPosts(orgId) {
  const dbTenants = await databaseClass.org(orgId).getTenants();
  return await dbTenants.posts.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
}
```

### **Multi-Tenant API Endpoints**

```typescript
import { databaseClass } from '@bloomneo/appkit/database';

// User endpoints - auto-filtered by tenant
app.get('/api/users', async (req, res) => {
  const database = await databaseClass.get();
  const users = await database.user.findMany();
  res.json(users); // Only user's tenant data
});

app.post('/api/users', async (req, res) => {
  const database = await databaseClass.get();
  const user = await database.user.create({
    data: req.body, // tenant_id added automatically
  });
  res.json(user);
});

// Admin endpoints - see all tenant data
app.get('/api/admin/users', requireUserRoles(['admin']), async (req, res) => {
  const dbTenants = await databaseClass.getTenants();
  const users = await dbTenants.user.findMany({
    include: { _count: { select: { posts: true } } },
  });
  res.json(users); // All tenants data
});

// Organization management
app.get('/api/orgs/:orgId/users', requireUserRoles(['admin']), async (req, res) => {
  const { orgId } = req.params;
  const orgDatabase = await databaseClass.org(orgId).get();
  const users = await orgDatabase.user.findMany();
  res.json(users); // Specific org data
});
```

### **Multi-Cloud Enterprise Setup**

```typescript
/**
 * Enterprise deployment with different cloud providers and databases per organization
 */

// Environment configuration supports any database provider:
const envConfig = `
# System/Admin database
DATABASE_URL=postgresql://admin.company.com/system

# Customer organizations on different clouds and databases
ORG_ENTERPRISE_CORP=postgresql://enterprise.dedicated.aws.com/prod
ORG_TECH_STARTUP=mongodb://tech.shared.azure.com/startup_db  
ORG_LOCAL_BUSINESS=mysql://local.gcp.com:3306/business_db
ORG_DEV_TESTING=sqlite:///tmp/testing.db

# Enable tenant mode across all orgs
BLOOM_DB_TENANT=auto
`;

// Code remains identical regardless of backend:
async function getUserData(orgId, userId) {
  const database = await databaseClass.org(orgId).get();

  // Works with any database type - AppKit handles the differences
  if (database.user?.findUnique) {
    // Prisma client (PostgreSQL, MySQL, SQLite)
    return await database.user.findUnique({
      where: { id: userId },
      include: { posts: true, profile: true },
    });
  } else if (database.User?.findOne) {
    // Mongoose client (MongoDB)
    return await database.User.findOne({ _id: userId })
      .populate('posts')
      .populate('profile');
  }
}
```

## 🔧 Automatic Context Detection

### **Tenant Detection Sources** (when `BLOOM_DB_TENANT=auto`)

```typescript
// AppKit automatically detects tenant from:
const tenantId =
  req.headers['x-tenant-id'] || // API header (recommended)
  req.user?.tenant_id || // Authenticated user metadata
  req.params?.tenantId || // URL parameter
  req.query?.tenant || // Query parameter
  req.subdomain || // Subdomain (team.app.com)
  null; // Single tenant mode
```

### **Organization Detection Sources**

```typescript
// AppKit automatically detects organization from:
const orgId =
  req.headers['x-org-id'] || // API header (recommended)
  req.user?.org_id || // Authenticated user metadata
  req.params?.orgId || // URL parameter
  req.query?.org || // Query parameter
  req.subdomain || // Subdomain (acme.app.com)
  null; // Single org mode
```

### **Manual Override** (when needed)

```typescript
// Override auto-detection by passing a request-like object with the
// expected headers. databaseClass.get(req) reads x-tenant-id / x-org-id.
const specificTenantDatabase = await databaseClass.get({
  headers: { 'x-tenant-id': 'specific-tenant' },
});
const specificOrgDatabase = await databaseClass.org('specific-org').get();
```

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
  const dbTenants = await databaseClass.getTenants();
  const users = await dbTenants.user.findMany();
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
    const dbTenants = await databaseClass.getTenants();
    const users = await dbTenants.user.findMany();
    return users;
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
  const dbTenants = await databaseClass.getTenants();
  const users = await dbTenants.user.findMany();
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

```typescript
// List all tenants
const tenants = await databaseClass.list();
console.log(tenants); // ['team-alpha', 'team-beta', 'team-gamma']

// Check if tenant exists
const exists = await databaseClass.exists('team-alpha');
console.log(exists); // true

// Create tenant (validates ID format)
await databaseClass.create('new-team');

// Delete tenant (requires confirmation)
await databaseClass.delete('old-team', { confirm: true });
```

### **Connection Management**

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await databaseClass.disconnect();
  process.exit(0);
});
```

## 📊 Performance & Scaling

### **Connection Pooling**

- **Automatic caching** - Connections reused per org/tenant combination
- **Hot reload** - New .env configurations picked up instantly
- **Memory efficient** - Connections shared across requests

### **Database Performance**

- **Mandatory indexes** - `tenant_id` indexed on all tables from day 1
- **Query optimization** - Automatic tenant filtering at database level
- **Connection limits** - Respects database provider connection pools

### **Scaling Characteristics**

- **Single tenant**: 1 connection per app
- **Multi-tenant**: 1 connection (shared filtering)
- **Multi-org**: 1 connection per organization
- **Multi-org + tenant**: 1 connection per org (shared tenant filtering)

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
const database = await databaseClass.get();
const users = await database.user.findMany(); // tenant_id added automatically
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

// Admin access to all tenants
const dbTenants = await databaseClass.getTenants();

// Organization-specific access (use org name in variable)
const acmedatabase = await databaseClass.org('acme').get();
const techdatabase = await databaseClass.org('tech').get();
const startupdatabase = await databaseClass.org('startup').get();

// Organization admin access (use org name + DbTenants)
const acmeDbTenants = await databaseClass.org('acme').getTenants();
const techDbTenants = await databaseClass.org('tech').getTenants();
```

### **Common Patterns**

```typescript
// ✅ User data access
const database = await databaseClass.get();
const users = await database.user.findMany();

// ✅ Admin functionality
const dbTenants = await databaseClass.getTenants();
const allUsers = await dbTenants.user.findMany();

// ✅ Organization management
const acmedatabase = await databaseClass.org('acme').get();
const acmeUsers = await acmedatabase.user.findMany();

// ✅ Cross-tenant analytics (admin)
const acmeDbTenants = await databaseClass.org('acme').getTenants();
const analytics = await acmeDbTenants.user.groupBy({
  by: ['tenant_id'],
  _count: true,
});
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

// ✅ ALWAYS include in ALL schemas (MongoDB):
const anySchema = new Schema({
  // ... your fields ...
  tenant_id: { type: String, index: true } // MANDATORY: indexed
});
anySchema.index({ tenant_id: 1 }); // MANDATORY: performance index
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

```javascript
// ❌ DON'T: Missing tenant_id field (MongoDB)
const userSchema = new Schema({
  email: String,
  name: String,
  // Missing tenant_id - will need painful migration later
});

// ✅ DO: Always include tenant_id (MongoDB)
const userSchema = new Schema({
  email: String,
  name: String,
  tenant_id: { type: String, index: true }, // Future-proof from day 1
});
userSchema.index({ tenant_id: 1 });
```

### **❌ API Usage Mistakes**

```typescript
// ❌ DON'T: Hard-code tenant access (any database)
const users = await prisma.user.findMany({
  where: { tenant_id: 'hardcoded-tenant' },
});
const users = await User.find({ tenant_id: 'hardcoded-tenant' });

// ✅ DO: Use databaseClass.get() for automatic filtering
const database = await databaseClass.get();
const users = await database.user.findMany(); // Prisma - Auto-filtered
const users = await database.User.find(); // Mongoose - Auto-filtered

// ❌ DON'T: Mix access patterns
const database = await databaseClass.get();
const admindatabase = await databaseClass.getTenants();
const users = await database.user.findMany(); // Which database am I using?

// ✅ DO: Clear variable naming
const database = await databaseClass.get(); // User data
const dbTenants = await databaseClass.getTenants(); // Admin data
const users = await database.user.findMany(); // Clear intent (Prisma)
const users = await database.User.find(); // Clear intent (Mongoose)
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

**Score: 75/100 — 🟡 Solid** *(capped at 75: module README has zero pointers to `AGENTS.md`, `examples/`, or `llms.txt`; weighted raw = 75.5)*
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../AGENT_DEV_SCORING_ALGORITHM.md) v1.1*
*Delta vs previous (2026-04-13, 68/100): **+7***

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **10** | All 9 public methods (`get`, `getTenants`, `org`, `health`, `list`, `exists`, `create`, `delete`, `disconnect`) exist as documented. README / `examples/database.ts` / `cookbook/*.ts` / `llms.txt` / root `README.md` all use `databaseClass`. Drift-check test (`database.test.ts`) enforces both the presence list and a hallucination blocklist (`query`, `transaction`, `model`, `findMany`, …). |
| 2 | Doc consistency | **9** | Every surface uses `databaseClass.get(req)` / `.getTenants()` / `.org(id).get()`. `cookbook/auth-protected-crud.ts` and `multi-tenant-saas.ts` pass `req` consistently for tenant scoping. One minor gap: module README body has no explicit pointer to `AGENTS.md` / `examples/` / `llms.txt`. |
| 3 | Runtime verification | **6** | `database.test.ts` verifies all 9 methods exist + blocks 9 hallucinated names + checks `org()` contract. `examples/database.ts` is runtime-verified today. Still no behaviour tests for the tenant middleware itself (no fake Prisma/Mongoose harness). |
| 4 | Type safety | **5** | Unchanged from previous: `req: any`, `options: any`, `DatabaseClientUnion` contains `[key: string]: any`. Return type is a `PrismaClient \| MongooseConnection` union; autocomplete is best-effort at the call site. |
| 5 | Discoverability | **7** | `package.json` description + README hero give one canonical import in the first 30 lines. `databaseClass` is the only exported entry symbol. Still no explicit "See also" block pointing at `AGENTS.md` / `llms.txt` / `examples/database.ts` from the top of the README. |
| 6 | Example completeness | **9** | `examples/database.ts` now exercises `get`, `get(req)`, `getTenants`, `org().get`, `org().getTenants`, `health`, `list`, `exists`, `create`, `disconnect`. `delete` is shown as a commented destructive opt-in (intentional — it wipes tenant data). Runtime-verified 2026-04-14. |
| 7 | Composability | **9** | Two cookbook recipes compose `databaseClass` with the rest of the stack and typecheck clean: `cookbook/auth-protected-crud.ts` (auth + database + error + logger) and `cookbook/multi-tenant-saas.ts` (auth + database + cache + error + logger, with `databaseClass.create` / `exists` / `delete` on the admin path). Both call `databaseClass.get(req)` — the canonical tenant-aware pattern. |
| 8 | Educational errors | **8** | Every throw site is prefixed `[@bloomneo/appkit/database]`, names the missing/invalid input, and appends `See: ${DOCS_URL}#<anchor>`. Examples: `Database URL required. Set DATABASE_URL environment variable. See …#environment-variables`, `No database URL found for organization 'X'`, `Tenant deletion requires explicit confirmation. Pass { confirm: true }`, `Invalid tenant ID format. Use alphanumeric characters, underscores, and hyphens only`. Weakest spot: `_getDistinctTenantIds` wraps the underlying ORM error verbatim. |
| 9 | Convention enforcement | **8** | One canonical pattern per task: `get(req)` for user data, `getTenants(req)` for admin, `org(id).get(req)` for per-org. Variable-name convention (`database` / `dbTenants` / `<org>database` / `<org>DbTenants`) is documented and matches examples + cookbook + llms.txt. |
| 10 | Drift prevention | **5** | `database.test.ts` is the drift gate and runs under `vitest`. No dedicated CI job asserts the doc ↔ source mapping; the gate is only "did someone run the test suite". |
| 11 | Reading order | **4** | Module README still has no pointer block to `AGENTS.md`, `llms.txt`, `examples/database.ts`, or the cookbook. A fresh agent landing here has to guess where to go next. This is what triggers the 75 anti-pattern cap. |
| **12** | **Simplicity** | **7** | 9 public methods on `databaseClass`; 2 on the `OrgDatabase` returned by `.org()`. 80% case is one call (`await databaseClass.get(req)`) with one optional arg. Tenant admin methods (`list` / `exists` / `create` / `delete`) are secondary and rarely needed in app code. |
| **13** | **Clarity** | **9** | Every method reads as its behaviour: `get`, `getTenants`, `org`, `health`, `list`, `exists`, `create`, `delete`, `disconnect`. No vague verbs (`process`, `handle`, `run`). Parameter names (`req`, `tenantId`, `orgId`, `options.confirm`) are self-describing. |
| **14** | **Unambiguity** | **5** | Unchanged. `get()` can return a Prisma client *or* a Mongoose connection — the caller has to runtime-probe (`db.$queryRaw` vs `db.db`). `create(tenantId)` is a format-validation no-op under the row-level strategy; the name suggests registration. |
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
3. **D4 Type safety → 8**: Tighten `delete(tenantId, options: { confirm: true })`, narrow `req` to `{ headers?, user?, params?, query?, hostname? }`, and add an adapter-aware return generic (`databaseClass.get<'prisma'>(req)` → `PrismaClient`).
4. **D14 Unambiguity → 7**: Expose `client._adapter: 'prisma' | 'mongoose'` publicly and document it as the supported runtime discriminator; rename `create()` docs to make the "validate-only" semantics unmistakable.
5. **D10 Drift prevention → 7**: Wire `database.test.ts` (plus a doc-ref scan) into a dedicated CI job so a README rename breaks the build, not just the test suite.

**Realistic ceiling with fixes 1–5:** ~84/100. Breaking past that requires typed adapter generics propagated through `get` and `org().get` at the call site.
