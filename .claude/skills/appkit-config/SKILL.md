---
name: appkit-config
description: >-
  Use when writing code that reads environment-derived configuration via
  `@bloomneo/appkit/config`. Covers `configClass.get()` + dotted lookups,
  `getRequired` vs safe `get`, and environment predicates.
---

# @bloomneo/appkit/config

Single-entry config reader: `configClass.get()` returns the resolved app
config object. Use dotted paths for nested lookups; use `getRequired` for
values that must exist or the app should crash at boot.

## Canonical flow

```ts
import { configClass } from '@bloomneo/appkit/config';

const config = configClass.get();

config.get('service.name');                    // → string
config.get('service.port', 3000);              // → number (with default)
config.getRequired('DATABASE_URL');            // throws if unset — use at boot

// Environment predicates
configClass.isProduction();                    // → boolean
configClass.isDevelopment();
configClass.isTest();
configClass.getEnvironment();                  // → 'production' | 'development' | 'test'
```

## `get` vs `getRequired`

- **`config.get(path, default?)`** — safe. Returns the default (or `undefined`)
  if the path is missing. Use for optional settings.
- **`config.getRequired(path)`** — strict. Throws `ConfigError` if missing.
  Use at boot for values the app cannot run without. Fail loud, fail fast.

## Dotted paths

The shape is flat at top level, nested under `service`, `auth`, `database`, etc:

```ts
config.get('service.name')                     // from BLOOM_SERVICE_NAME
config.get('service.environment')              // from NODE_ENV
config.get('service.port')                     // from PORT
```

For raw env access, `configClass.getEnvVars()` returns the BLOOM_*-shaped
object. `process.env` still works — the config module layers structure on top
of it, doesn't replace it.

## Public API

### Config instance (from `configClass.get()`)

```ts
config.get(path, default?)                     // → ConfigValue | undefined
config.getRequired(path)                       // → ConfigValue | throws
config.has(path)                               // → boolean
config.getAll()                                // → full AppConfig
```

### configClass

```ts
configClass.get(overrides?)                    // → Config instance
configClass.reset(cfg?)                        // tests
configClass.getEnvironment()                   // → 'production' | 'development' | 'test'
configClass.isDevelopment() / isProduction() / isTest()
configClass.getEnvVars()                       // → sanitized env snapshot
configClass.validateRequired(paths)            // throws if any missing
configClass.getModuleConfig(moduleName)        // → per-module config slice
```

## Env vars

- `NODE_ENV` — environment predicate source
- `BLOOM_SERVICE_NAME` — service name, falls back to `npm_package_name`
- `BLOOM_SERVICE_VERSION` — service version, falls back to `npm_package_version`
- `PORT` / `HOST` — standard HTTP listen config

All other BLOOM_* vars belong to their respective modules.

## Common mistakes

- `config.get('DATABASE_URL')` — wrong. That's a raw env var; use
  `process.env.DATABASE_URL` or `configClass.getEnvVars().databaseUrl`.
  `config.get` operates on the structured config tree (`service.port`, etc.).
- Using `config.get()` for secrets that should be required — use
  `config.getRequired()` so missing secrets crash at boot, not at first use.
- Calling `configClass.isProduction()` as `config.isProduction()` — env
  predicates live on the class, not the instance.
