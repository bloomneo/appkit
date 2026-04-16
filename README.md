# Bloomneo AppKit 🚀

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AI Ready](https://img.shields.io/badge/AI-Optimized-purple.svg)](https://github.com/bloomneo/appkit)

> Minimal, framework-agnostic Node.js toolkit designed for AI agentic backend development.

**12 integrated modules. One pattern. Zero config to start, enterprise scaling on demand.**

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
| **[`cookbook/`](./cookbook)** | Composed recipes for whole patterns (CRUD, multi-tenant, file upload, real-time). |
| **[`.claude/skills/`](./.claude/skills)** | Claude Code skills (`appkit`, `appkit-auth`, `appkit-cache`, `appkit-database`, `appkit-error`) that auto-trigger when agents work on code that imports this package. Copy the directory into your own repo's `.claude/skills/` to activate. |

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
    "@bloomneo/appkit": "^2.0.0",
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

### As a complete scaffold (CLI)

```bash
npm install -g @bloomneo/appkit
appkit generate app myproject
cd myproject && npm run dev:api
```

→ Production-ready Express API at `http://localhost:3000` with auth, database,
logging, error handling all wired.

For full-stack scaffolding (frontend + backend), use [`@bloomneo/bloom`](https://www.npmjs.com/package/@bloomneo/bloom)
which assembles AppKit + UIKit + FBCA convention into one CLI.

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
| 1 | **Auth** | JWT tokens, role.level permissions, middleware | — |
| 2 | **Database** | Prisma/Mongoose with multi-tenant filtering | per-org databases |
| 3 | **Security** | CSRF, rate limiting, AES-256-GCM, input sanitization | — |
| 4 | **Error** | HTTP errors with semantic types + middleware | — |
| 5 | **Cache** | Memory → Redis | `REDIS_URL` |
| 6 | **Storage** | Local → S3/R2 | `AWS_S3_BUCKET` |
| 7 | **Queue** | Memory → Redis → DB | `REDIS_URL` / `BLOOM_QUEUE_DB` |
| 8 | **Email** | Console → SMTP → Resend | `RESEND_API_KEY` |
| 9 | **Event** | Memory → Redis pub/sub | `REDIS_URL` |
| 10 | **Logger** | Console → File → HTTP | `BLOOM_LOGGER_*` |
| 11 | **Config** | Type-safe env var access | — |
| 12 | **Util** | Safe property access, debounce, chunk, uuid, slugify | — |

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
REDIS_URL=redis://prod-cache:6379         # → distributed cache + queue
AWS_S3_BUCKET=prod-assets                 # → cloud storage + CDN
RESEND_API_KEY=re_production_key          # → professional email
BLOOM_DB_TENANT=auto                      # → multi-tenant filtering
BLOOM_LOGGER_HTTP_URL=https://logs.example.com  # → centralized logging
```

See [`examples/.env.example`](./examples/.env.example) for the full canonical template.

---

## 🛠️ AppKit CLI

Project generation:

```bash
appkit generate app myproject       # full backend scaffold (Express + auth + db + error + logger)
```

Feature generation:

```bash
appkit generate feature product     # basic feature (route + service + types)
appkit generate feature order --db  # database-enabled feature (+ model + HTTP tests)
appkit generate feature user        # complete authentication system (9-role hierarchy)
```

Generated project structure:

```
myproject/
├── AGENTS.md                       # ← copied from @bloomneo/appkit at scaffold time
├── llms.txt                        # ← copied from @bloomneo/appkit at scaffold time
├── src/api/
│   ├── server.ts                   # Express bootstrap
│   ├── lib/api-router.ts           # auto-discovery routing
│   └── features/
│       ├── welcome/
│       └── [your-features]/
└── package.json

# `.env` is created on demand — `generate feature user` (or any `--db` feature)
# drops DATABASE_URL, BLOOM_AUTH_SECRET, and DEFAULT_USER_PASSWORD into it.
```

---

## 🏗️ Migration

### From `@bloomneo/appkit@1.5.x` → `2.0.0`

2.0.0 is the stable API reference after a compatibility break. Renames are
final, no aliases kept. Any further breaking change requires a new major.
Project-wide find-and-replace:

- `auth.user(req)` → `auth.getUser(req)`
- `auth.can(user, perm)` → `auth.hasPermission(user, perm)`
- `security.csrf()` → `security.forms()`
- `error.handleErrors({ includeStack })` → `error.handleErrors({ showStack })`

If your code called `auth.requireLogin()` or `auth.requireRole(...)`, it
was already broken — those methods never existed. Use
`auth.requireLoginToken()` and `auth.requireUserRoles([...])`.

See [`CHANGELOG.md`](./CHANGELOG.md#200---2026-04-15) for the full list.

---

## 📚 Resources

- **[`AGENTS.md`](./AGENTS.md)** — agent-facing rules and conventions
- **[`llms.txt`](./llms.txt)** — full machine-readable API reference
- **[`examples/`](./examples)** — one minimal example per module
- **[`cookbook/`](./cookbook)** — composed recipes (auth + crud, multi-tenant, file upload, real-time)
- **[`CHANGELOG.md`](./CHANGELOG.md)** — release history
- **[Per-module READMEs](https://github.com/bloomneo/appkit/tree/main/src)** — long-form human docs (also shipped in the tarball at `node_modules/@bloomneo/appkit/src/<module>/README.md`)
- **Issues**: https://github.com/bloomneo/appkit/issues

---

## 📄 License

MIT © [Krishna Teja GS](https://github.com/ktvoilacode)

---

<p align="center">
  <strong>🚀 Built for the AI-first future of backend development</strong><br>
  <strong>Where enterprise applications are generated, not written</strong><br><br>
  <a href="https://github.com/bloomneo/appkit">⭐ Star on GitHub</a>
</p>
