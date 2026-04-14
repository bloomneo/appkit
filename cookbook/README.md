# Cookbook

> ⚠️ **Under review — may reference outdated APIs until the module-by-module review completes.** Do not copy-paste recipes verbatim; verify each `auth.*` / `security.*` / etc. call against the current module README first.

Composed multi-module recipes. Whole-pattern files showing how the 12 modules
work together for common backend scenarios. Copy a recipe, swap the data
source, ship.

For single-module examples (one canonical file per module), see
[`../examples/`](../examples/).

## Recipes

| File | Pattern |
|---|---|
| [`auth-protected-crud.ts`](./auth-protected-crud.ts) | Auth + database + error + logger — full CRUD endpoint with role-based access |
| [`multi-tenant-saas.ts`](./multi-tenant-saas.ts) | Multi-tenant database + cache + per-tenant rate limiting |
| [`file-upload-pipeline.ts`](./file-upload-pipeline.ts) | Storage + queue + logger — upload → background processing → result |
| [`real-time-chat.ts`](./real-time-chat.ts) | Event + auth + database — WebSocket-friendly real-time event flow |
| [`api-key-service.ts`](./api-key-service.ts) | Auth (API tokens) + security (encryption) + rate limiting — third-party API key management |

## Conventions

- All recipes use **flat imports** from `@bloomneo/appkit`.
- All recipes follow the canonical `xxxClass.get()` pattern.
- All recipes wrap async route handlers in `error.asyncRoute(...)`.
- All recipes mount `error.handleErrors()` last in the Express middleware stack.
- All recipes use `BLOOM_*` env vars (the `VOILA_*` prefix was removed in 1.5.2).
