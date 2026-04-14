# Cookbook

Multi-module recipes that compose `@bloomneo/appkit` into complete features.
Each file is a reference implementation — copy the shape, adjust to your schema
and your framework conventions.

For single-module tours, see [`examples/`](../examples/README.md) first.

## Recipes

| File                          | Modules                                            | What it builds                                                              |
| ----------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `auth-protected-crud.ts`      | auth, database, error, logger                      | Express CRUD router gated by login + role middleware                        |
| `multi-tenant-saas.ts`        | auth, database, cache, error, logger               | Row-level tenant filtering, per-org admin, per-tenant cached dashboards     |
| `file-upload-pipeline.ts`     | auth, security, storage, queue, event, error, log  | Rate-limited upload → storage → queue worker → event fan-out                |
| `real-time-chat.ts`           | auth, event, cache, error, logger                  | Namespaced room fan-out over Redis pub/sub + TTL-based presence             |
| `api-key-service.ts`          | auth, security, database, error, logger            | JWT-backed API keys with encrypted DB copies, revocation, and auth middleware |

## Environment

Copy `examples/.env.example` to `.env` and fill in:

- `BLOOM_AUTH_SECRET` — required by every recipe
- `DATABASE_URL` — required by any recipe that persists state
- `BLOOM_SECURITY_ENCRYPTION_KEY` — required by `api-key-service.ts`
- `BLOOM_DB_TENANT=auto` — enables row-level multi-tenancy in `multi-tenant-saas.ts`
- `REDIS_URL` — upgrades cache/event/queue transports from in-process to distributed

## Running

These recipes are written as Express routers / service modules. Wire them into
your own bootstrap:

```ts
import express from 'express';
import { errorClass } from '@bloomneo/appkit';
import products from './cookbook/auth-protected-crud.js';
import tenants  from './cookbook/multi-tenant-saas.js';

const app = express();
app.use(express.json());
app.use('/api/products', products);
app.use('/api/tenants',  tenants);
app.use(errorClass.handleErrors());   // must be LAST
app.listen(3000);
```

Swap `'@bloomneo/appkit'` for relative `../src/<module>/index.js` imports if
you're running against the source checkout instead of the published package.
