# Bloomneo AppKit 🚀

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AI Ready](https://img.shields.io/badge/AI-Optimized-purple.svg)](https://github.com/bloomneo/appkit)

> Bloomneo makes business apps safe, consistent and maintainable, however much of the code AI writes.

AppKit is the backend half: auth, tenant isolation, errors, logging, jobs and
the rest, each behind one `xxxClass.get()` call, so the code an agent writes
takes the safe path by default. The tenant comes only from the login token,
Postgres row-level security can back it up, and route contracts apply auth,
tenant scope and validation for you.

**12 modules plus a server layer. One pattern. Zero config to start, scales by env var.**

```ts
import { authClass, databaseClass, errorClass, loggerClass } from '@bloomneo/appkit';

const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();
const logger = loggerClass.get('api');

app.post(
  '/api/users',
  auth.requireLoginToken(),                    // 1. authenticate the user
  auth.requireUserRoles(['admin.tenant']),     // 2. check the role (always chained)
  error.asyncRoute(async (req, res) => {
    if (!req.body?.email) throw error.badRequest('Email required');
    const user = await database.user.create({ data: req.body });
    logger.info('User created', { userId: user.id });
    res.json({ user });
  })
);

app.use(error.handleErrors());  // last middleware
```

**Production-ready API with auth, database, error handling, logging. Zero config files.**

---

## 🤖 For AI coding agents — read these first

Five locations at the package root tell agents everything they need to know:

| File | Purpose |
|---|---|
| **[`AGENTS.md`](./AGENTS.md)** | Rules: always-do, never-do, canonical patterns. Read first. |
| **[`llms.txt`](./llms.txt)** | Reference: every export, every method, signatures + examples. |
| **[`examples/`](./examples)** | 12 minimal `.ts` files, one per module. Copy and modify. |
| **[`cookbook/`](./cookbook)** | Composed recipes for whole patterns (CRUD, multi-tenant, file upload, API keys). |
| **[`.claude/skills/`](./.claude/skills)** | Claude Code skills — one `appkit` overview + one per module (`appkit-auth`, `appkit-cache`, `appkit-config`, `appkit-database`, `appkit-email`, `appkit-error`, `appkit-logger`, `appkit-mcp`, `appkit-queue`, `appkit-security`, `appkit-storage`, `appkit-verify`). Auto-trigger when agents work on code that imports this package. Copy the directory into your own repo's `.claude/skills/` to activate. |

All of the above ship inside the npm tarball. AI agents installing `@bloomneo/appkit`
can read them directly from `node_modules/@bloomneo/appkit/`.

---

## 🚀 Quick start

### As a library (in any Node.js project)

```bash
npm install @bloomneo/appkit
```

**Three things your project needs** before the first `import` works — these are
the most common first-run stumbles, so do them up front:

1. **ESM.** AppKit is ESM-only. Your `package.json` must have `"type": "module"`,
   or your source files must use the `.mjs` extension. Without this, `import`
   throws `ERR_REQUIRE_ESM`.
2. **Required env vars** must exist in `process.env` before you call any
   `xxxClass.get()`. The minimum for auth:
   ```bash
   BLOOM_AUTH_SECRET=<at least 32 random chars>
   ```
   Full list: [`.env.example`](./.env.example) — copy it to `.env` and fill in
   what your app uses.
3. **AppKit does NOT auto-load `.env`.** Load it yourself, before any AppKit
   import. Either preload on the command line:
   ```bash
   node --import=dotenv/config ./server.mjs
   ```
   or import at the very top of your entry file:
   ```ts
   import 'dotenv/config';   // MUST be the first import
   import { authClass } from '@bloomneo/appkit/auth';
   ```

### Minimum working example

`package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "@bloomneo/appkit": "^6.0.0-rc.2",
    "dotenv": "^16.0.0",
    "express": "^5.0.0"
  }
}
```

`.env`:

```bash
BLOOM_AUTH_SECRET=change-me-to-at-least-32-random-characters
```

`server.mjs`:

```ts
import 'dotenv/config';
import express from 'express';
import { authClass } from '@bloomneo/appkit/auth';

const auth = authClass.get();
const app = express();
app.use(express.json());

app.post('/login', async (req, res) => {
  // ... verify user ...
  const token = auth.generateLoginToken({ userId: 1, role: 'user', level: 'basic' });
  res.json({ token });
});

app.get('/me', auth.requireLoginToken(), (req, res) => {
  res.json(auth.getUser(req));
});

app.listen(3000, () => console.log('http://localhost:3000'));
```

Run it:

```bash
npm install
node server.mjs
```

### As part of a full app

For a scaffolded project with appkit already wired in (and UIKit on the
frontend), use [`@bloomneo/bloom`](https://www.npmjs.com/package/@bloomneo/bloom):
`bloom create my-app`.

---

## ✨ The one rule that matters most

```ts
const auth = authClass.get();   // ALWAYS .get(), NEVER `new AuthClass()`
```

Every module follows this exact pattern. There are no exceptions, no
constructors, no factories with custom names.

```ts
const auth     = authClass.get();
const database = await databaseClass.get();
const error    = errorClass.get();
const cache    = cacheClass.get();           // default 'app' namespace
const userCache = cacheClass.get('users');   // custom namespace
const logger   = loggerClass.get('api');     // component-tagged
```

**One function per module. Predictable. Non-ambiguous. AI-agent friendly.**

---

## 🎭 The 12 modules

| # | Module | Purpose | Auto-scales |
|---|---|---|---|
| 1 | **Auth** | JWT tokens, role.level hierarchy, middleware | — |
| 2 | **Database** | Prisma with multi-tenant filtering (tenant from the login token), optional Postgres row-level security | `BLOOM_DB_TENANT=auto` / `rls` |
| 3 | **Security** | Rate limiting, AES-256-GCM encryption | — |
| 4 | **Error** | HTTP errors with semantic types + middleware | — |
| 5 | **Cache** | Memory → Redis | `REDIS_URL` |
| 6 | **Storage** | Local → S3 (R2 / MinIO via endpoint) | `AWS_S3_BUCKET` / `S3_ENDPOINT` |
| 7 | **Queue** | Memory → Database | `DATABASE_URL` / `BLOOM_QUEUE_TRANSPORT` |
| 8 | **Email** | Console → SMTP → Resend | `RESEND_API_KEY` |
| 9 | **Logger** | Console + rotating file | `BLOOM_LOGGER_*` |
| 10 | **Config** | Type-safe env var access | — |
| 11 | **MCP** | Your app as an MCP server — OAuth 2.1 + FBCA tool discovery | optional peers |
| 12 | **Verify** | Generates the cross-tenant attack matrix and fails CI on a leak | — |
| + | **Server** (`@bloomneo/appkit/server`) | `createApiRouter()` feature discovery, `route(contract, handler)` for `@bloomneo/bloom` contracts, `requestId()` | — |

Every middleware takes and returns Express's own types (`req.user` is typed,
no casts), and every error appkit throws is an `AppKitError` with a stable
`code`.

For full method signatures and per-module examples, read [`llms.txt`](./llms.txt).

---

## 🌍 Environment-driven progressive scaling

Same code. Different `.env`. Enterprise features automatically enabled.

```bash
# Day 1 — local development (zero config)
BLOOM_AUTH_SECRET=<min 32 chars>
DATABASE_URL=postgresql://localhost/myapp
# → Memory cache, local file storage, console logs, console email

# Month 6 — production (just add env vars, no code changes)
REDIS_URL=redis://prod-cache:6379         # → distributed cache
AWS_S3_BUCKET=prod-assets                 # → cloud storage + CDN
RESEND_API_KEY=re_production_key          # → professional email
BLOOM_DB_TENANT=rls                       # → multi-tenant filtering + Postgres row-level security
BLOOM_LOGGER_DIR=/var/log/my-app          # → log files outside the release dir
```

See [`.env.example`](./.env.example) at the repo root for the full canonical template — every BLOOM_* var, organized by module.

---

## 🏗️ Migration

**Current release: 6.0.0-rc.2.** Pre-release; stable is 5.1.4.

**From 5.x to 6.0:** read [`MIGRATION-6.md`](./MIGRATION-6.md). It lists every
removal with its replacement (event, util, the CLI, the logger's database /
HTTP / webhook transports, the queue's Redis transport, the R2 strategy,
Mongoose, per-org databases, header/subdomain tenants, auth permissions and
matrix mode, CSRF and sanitizers, `sendTemplate`), every addition, and every
behaviour change.

**From 4.x or earlier:** apply the tables in [`CHANGELOG.md`](./CHANGELOG.md)
(4.0.0 unified teardown on `xxxClass.disconnectAll()`; 5.0.0 made
`databaseClass.get()` throw in tenant mode), then `MIGRATION-6.md`.

---

## 📚 Resources

- **[`AGENTS.md`](./AGENTS.md)** — agent-facing rules and conventions
- **[`llms.txt`](./llms.txt)** — full machine-readable API reference
- **[`examples/`](./examples)** — one minimal example per module
- **[`cookbook/`](./cookbook)** — composed recipes (auth + crud, multi-tenant, file upload, API keys)
- **[`MIGRATION-6.md`](./MIGRATION-6.md)** — upgrading from 5.x
- **[`CHANGELOG.md`](./CHANGELOG.md)** — release history
- **[Per-module READMEs](https://github.com/bloomneo/appkit/tree/main/src)** — long-form human docs (also shipped in the tarball at `node_modules/@bloomneo/appkit/src/<module>/README.md`)
- **Issues**: https://github.com/bloomneo/appkit/issues

---

## 📄 License

MIT © [Krishna Teja GS](https://github.com/ktvoilacode)

---

<p align="center">
  <strong>Business apps that stay safe, consistent and maintainable,</strong><br>
  <strong>however much of the code AI writes</strong><br><br>
  <a href="https://github.com/bloomneo/appkit">⭐ Star on GitHub</a>
</p>
