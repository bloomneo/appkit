# Naming Policy — `@bloomneo/appkit`

**Status:** pre-v1. Breaking renames are acceptable and expected. Lock-in happens at v1.0.

This document defines the naming conventions every module in `@bloomneo/appkit`
must follow. The goal is **predictability for LLM agents and human developers**:
when an agent reads one module, the naming patterns it learns should transfer
cleanly to the next module. Inconsistency is the #1 source of agent misuse.

---

## Table of Contents

- [Method Name Patterns](#method-name-patterns)
- [Property vs Method](#property-vs-method)
- [Bulk and Lifecycle Operations](#bulk-and-lifecycle-operations)
- [Module-Level Exports](#module-level-exports)
- [Error Names and Codes](#error-names-and-codes)
- [Environment Variables](#environment-variables)
- [Forbidden Patterns](#forbidden-patterns)
- [Checklist for Each Module](#checklist-for-each-module)

---

## Method Name Patterns

| Pattern          | Use for                                                                                             | Example                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `get<Thing>()`   | **Nullable extractor.** Returns `Thing \| null`. Never throws on "not found." Read like a function. | `getUser(req)`, `getToken(req)`, `getConfig()`                             |
| `has<Thing>()`   | **Boolean check.** Returns `boolean`. Never throws.                                                 | `hasRole()`, `hasRedis()`, `hasPermission()`                               |
| `is<State>()`    | **State boolean.** Returns `boolean`. Describes a *current* state, not a capability.                | `isProduction()`, `isConnected()`, `isExpired()`                           |
| `create<Thing>()`| **Factory** that constructs a domain object. Does not touch external state.                         | `createSession()`, `createMiddleware()`                                    |
| `generate<Thing>()` | **Producer** of tokens, ids, secrets, or cryptographic output. May be async; may have side effects. | `generateLoginToken()`, `generateApiKey()`                                 |
| `require<Thing>()` | **Middleware factory** or guard that throws / rejects / sends 4xx on failure.                     | `requireLoginToken()`, `requireUserRoles()`, `requireApiToken()`           |
| `can(<action>)`  | **Permission check.** Domain-standard short form is acceptable here.                                | `can(user, 'edit:tenant')`                                                 |
| `<verb><Thing>()` | **Imperative single action.** Default for everything not covered above.                            | `hashPassword()`, `verifyToken()`, `clearNamespace()`                      |
| `<verb>All()`    | **Bulk op across all entities** the instance knows about.                                           | `clearAll()`, `disconnectAll()`, `shutdownAll()`                           |

### Rule of thumb

An agent reading `authClass.get()` should be able to guess the **return shape**
and **failure mode** from the name alone:
- `getUser(req)` → nullable, no throw
- `hasRole(user, 'admin.org')` → boolean, no throw
- `requireUserRoles(['admin.org'])` → middleware, rejects with 4xx
- `generateLoginToken({...})` → produces a string, throws on invalid input

Names must not lie about the contract.

---

## Property vs Method

- If a value is **stored state** (no computation, no I/O), expose it as a property: `instance.namespace`, `instance.config`.
- If a value is **computed** or **nullable on miss**, expose it as a method: `getUser(req)`, `getConfig()`.

**Do not** expose a nullable extractor as a bare property name (`auth.user`)
— this is the single most common LLM-agent misread: agents read
`auth.user` as a property access and skip the call.

---

## Bulk and Lifecycle Operations

Pick **one** word per verb family per module and use it consistently:

- **Data reset** (flush cached entries, keep connections): `clear()` / `clearAll()`
  → **Not**: `flush`, `flushAll`, `purge`, `reset`, `invalidate`.
- **Teardown** (close connections, stop intervals, release resources): `disconnect()` / `disconnectAll()` / `shutdown()`
  → Pick `disconnect` for per-instance, `shutdown` for module-level. Do not mix within one module.
- **Full re-init** (for tests): `reset(newConfig?)`
  → Rebuilds the singleton. Not a data clear.

Each module's README must have a 3-line table clarifying:

```
clear()        - removes cached data, keeps connection
disconnect()   - closes connection, keeps data intact (where applicable)
reset()        - full re-init with optional new config (tests only)
```

---

## Module-Level Exports

Every module exports a single const named `<module>Class`:

```ts
export const authClass = { get, reset, getRoles, ... } as const;
export const cacheClass = { get, reset, clearAll, ... } as const;
```

- The **only** entry point the agent needs to learn is `<module>Class.get()`.
- Utility methods hang off the same `<module>Class` const — no second import.
- Instance methods live on the object returned by `get()`.

No default exports except the class itself (for test convenience).

---

## Error Names and Codes

All thrown `Error` objects must:

1. **Prefix the message** with `[@bloomneo/appkit/<module>]`.
2. **End with a docs link**: `See: https://github.com/bloomneo/appkit/blob/main/src/<module>/README.md#<anchor>`.
3. For domain errors, extend a named class (`CacheError`, `AuthError`) and expose a `code` string.

Error `code` convention: `<MODULE>_<ACTION>_<RESULT>` — e.g. `CACHE_GET_FAILED`, `AUTH_TOKEN_EXPIRED`.

---

## Environment Variables

- Prefix: `BLOOM_<MODULE>_<KEY>` (e.g. `BLOOM_AUTH_SECRET`, `BLOOM_CACHE_TTL`).
- Every env var declared in `defaults.ts` **must** be consumed somewhere in the runtime path. Dead env vars are a blocking bug (agents read the README, set the var, and get silent no-op behavior).
- Document the full set in each module's README under a **Configuration** section.

---

## Forbidden Patterns

These cause consistent agent misuse and are banned:

- **Bare nouns as methods**: `auth.user()`, `cache.config()` → use `getUser()`, `getConfig()`.
- **Synonym drift within one module**: `flush` alongside `clear`, `shutdown` alongside `disconnect`.
- **Abbreviations**: `cfg`, `ns`, `idx`, `tkn`. Full words always — `config`, `namespace`, `index`, `token`.
- **`manage<X>` for data operations**: ambiguous — use the specific verb (`createUser`, `deleteUser`, not `manageUser`).
- **Boolean returns from non-`is`/`has` methods**: if a method returns `boolean`, its name must start with `is` / `has` / `can`.
- **Module-import side effects**: registering `process.on()` handlers, opening connections, writing files. Lifecycle hooks must be explicit calls the consumer makes.
- **Docstring claims not backed by source**: every `@llm-rule NOTE` must describe actual runtime behavior. If the implementation changes, the docstring changes in the same commit.

---

## Checklist for Each Module

Before a module is considered "reviewed" and marked for v1:

- [ ] Entry point is `<module>Class.get()`.
- [ ] All nullable extractors use `get<Thing>`.
- [ ] All booleans use `has` / `is` / `can`.
- [ ] All middleware factories use `require<Thing>`.
- [ ] No synonym drift (`flush`/`clear`, `shutdown`/`disconnect`).
- [ ] No bare-noun methods.
- [ ] Every env var declared in `defaults.ts` is actually consumed.
- [ ] Every `@llm-rule` docstring reflects real behavior.
- [ ] All thrown errors carry the `[@bloomneo/appkit/<module>]` prefix and a docs link.
- [ ] README has a **Method Index** — a one-line list of every public method, near the top.
- [ ] No process-level side effects on import.

---

## Version

- **v1.0** — 2026-04-14. Initial policy derived from the auth + cache module reviews.

Changes to this document are themselves API contracts: bumping it after v1.0
of the package requires a major version.
