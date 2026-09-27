# Examples

Single-module, runnable tours of `@bloomneo/appkit`. Each file is self-contained
and demonstrates the public API surface of exactly one module. Use them as
**reference recipes** — copy the shape into your own app, tweak the inputs.

## Setup

```bash
cp examples/.env.example .env
# fill in the REQUIRED values
```

Minimum for any example to run:

- `BLOOM_AUTH_SECRET` — required by `auth`
- `DATABASE_URL`      — required by `database`
- `BLOOM_SECURITY_ENCRYPTION_KEY` — required by `security`

Everything else (Redis / S3 / Resend / SMTP) is **optional** and
enables a stronger transport when present.

## Run

```bash
npx tsx examples/<module>.ts
```

Examples assume the files can import `'../src/<module>/index.js'`. If you're
using the published package, swap those imports for `'@bloomneo/appkit/<module>'`.

## Files

| File              | Module   | What it shows                                                                   |
| ----------------- | -------- | ------------------------------------------------------------------------------- |
| `auth.ts`         | auth     | hashing, login + API tokens, getUser, role checks, middleware                   |
| `cache.ts`        | cache    | namespaced caches, getOrSet, clear vs clearAll vs disconnectAll                 |
| `config.ts`       | config   | dotted lookups, getRequired, validateRequired, env helpers                      |
| `database.ts`     | database | single-tenant, row-level multi-tenant, tenant admin ops                         |
| `email.ts`        | email    | sendText / sendHtml / send / sendBatch, validateConfig, health status           |
| `error.ts`        | error    | typed HTTP errors, asyncRoute, handleErrors                                     |
| `logger.ts`       | logger   | component loggers, child bindings, levels, flush                                |
| `queue.ts`        | queue    | add / process / schedule, pause / resume, stats, retry                          |
| `security.ts`     | security | rate-limit middleware, encrypt / decrypt, generateKey                           |
| `storage.ts`      | storage  | put / get / url / signedUrl / copy / list, convenience upload / download       |

For end-to-end recipes that combine modules, see [`cookbook/`](../cookbook/README.md).
