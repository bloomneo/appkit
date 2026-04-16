---
name: appkit
description: >-
  Use when writing or reviewing code that imports `@bloomneo/appkit` or any of
  its sub-paths (`@bloomneo/appkit/auth`, `/cache`, `/database`, etc.). Covers
  the single-pattern entry rule, required env setup, and module picker so agents
  pick the canonical API first try instead of inventing one.
---

# @bloomneo/appkit

`@bloomneo/appkit` is a framework-agnostic Node.js toolkit with 12 modules
(auth, cache, config, database, email, error, event, logger, queue, security,
storage, util). Every public method an agent will invoke goes through one
consistent pattern.

## The one rule

```ts
const auth     = authClass.get();          // never: new AuthClass()
const cache    = cacheClass.get('users');  // ditto
const database = await databaseClass.get();
const logger   = loggerClass.get('api');
```

Every module exports a `<module>Class` constant with a `.get()` entry point.
No other construction path is supported. If you find yourself typing
`new XxxClass()` in consumer code, stop — you're off the canonical path.

## Environment setup (must do before first import)

AppKit does NOT auto-load `.env`. Host app owns its lifecycle.

1. `package.json` must have `"type": "module"` (or use `.mjs` files).
2. Env vars must be in `process.env` **before** any appkit import runs.
3. Load dotenv yourself, at the very top of the entry file:
   ```ts
   import 'dotenv/config';                       // FIRST
   import { authClass } from '@bloomneo/appkit/auth';
   ```
   Or preload on the CLI: `node --import=dotenv/config ./server.mjs`.
4. Copy `.env.example` → `.env` and fill in the variables your app uses.

The single env var every app needs is `BLOOM_AUTH_SECRET` (≥32 random chars).
Everything else is opt-in and auto-detected.

## Module picker

| Need | Module | Import |
|---|---|---|
| Sign/verify tokens, hash passwords, protect routes | auth | `@bloomneo/appkit/auth` |
| Hit Postgres/MySQL/SQLite/Mongo via Prisma | database | `@bloomneo/appkit/database` |
| Cache data (Memory → Redis auto-switch on `REDIS_URL`) | cache | `@bloomneo/appkit/cache` |
| Run background jobs | queue | `@bloomneo/appkit/queue` |
| Send email | email | `@bloomneo/appkit/email` |
| Upload files / presign URLs | storage | `@bloomneo/appkit/storage` |
| Publish/subscribe events | event | `@bloomneo/appkit/event` |
| Structured logging | logger | `@bloomneo/appkit/logger` |
| Typed HTTP errors + middleware | error | `@bloomneo/appkit/error` |
| CSRF, rate limit, encryption | security | `@bloomneo/appkit/security` |
| Config lookup helpers | config | `@bloomneo/appkit/config` |
| String/date/array utilities | util | `@bloomneo/appkit/util` |

## Non-negotiable conventions

- **No synonym drift.** `clear`/`clearAll` (not `flush`), `disconnectAll` (not `shutdown`).
- **No bare-noun methods.** `auth.getUser(req)` — never `auth.user(req)`.
- **Errors carry the full prefix.** Every thrown `Error` starts with
  `[@bloomneo/appkit/<module>]` and ends with a `README.md#anchor` link.
- **Graceful shutdown is opt-in.** Library does not register `process.on`
  handlers. Host app wires `SIGTERM` → `xxxClass.disconnectAll()` itself.
  One teardown verb across every module — `disconnectAll()`. There is no
  `xxxClass.shutdown()` on any module in 3.0.2+.

## Before writing code

1. Open `AGENTS.md` at the package root — it has the always-do / never-do list.
2. Open `src/<module>/README.md` for the module you're using — it has worked
   examples and copy-pasteable patterns.
3. Open `examples/<module>.ts` for a minimal verified snippet.
4. Only reach for the class source (`src/<module>/<module>.ts`) if the README
   is ambiguous. The README is authoritative for public API.

## Common first-run mistakes to skip

- `ERR_REQUIRE_ESM` — forgot `"type": "module"` in `package.json`.
- `BLOOM_AUTH_SECRET must be set` — forgot to load `.env` before appkit import.
- `new AuthClass()` — use `authClass.get()`.
- `auth.user(req)` — method is `auth.getUser(req)` (returns `T | null`).
- `auth.requireRole('admin')` — method is `auth.requireUserRoles(['admin.system'])`.
