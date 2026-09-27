---
name: appkit-logger
description: >-
  Use when writing code that emits structured logs via `@bloomneo/appkit/logger`.
  Covers the `loggerClass.get(component)` pattern, the console and file
  transports, and child-logger composition.
---

# @bloomneo/appkit/logger

Single-entry logger: `loggerClass.get('api')` returns a logger tagged with the
component name. Levels + transports are auto-configured from env; you write
`logger.info(...)` and the right transports receive it.

## Canonical flow

```ts
import { loggerClass } from '@bloomneo/appkit/logger';

const logger = loggerClass.get('api');

logger.info('User signed up', { userId: 42, plan: 'pro' });
logger.warn('Retry attempt', { attempt: 3, url });
logger.error('Payment failed', { orderId, error: err.message });
logger.debug('Cache miss', { key });

// Child loggers — bind context that every call inherits
const jobLog = logger.child({ jobId: job.id });
jobLog.info('Job started');                    // → includes jobId automatically
```

Request ids need no child logger: mount `requestId()` from
`@bloomneo/appkit/server` first, and every line written while handling a
request carries `req=<id>` (6.0).

## Levels

`debug` → `info` → `warn` → `error`. The active level is set by
`BLOOM_LOGGER_LEVEL` (default: `info` in prod, `debug` in dev).

Calls below the active level are no-ops (not written, not evaluated — meta
objects passed to `logger.debug(...)` in prod don't allocate).

## Transports

| Transport | Activation | What it does |
|---|---|---|
| Console | on unless `BLOOM_LOGGER_CONSOLE=false` or `NODE_ENV=test` | stdout/stderr |
| File | on unless `BLOOM_LOGGER_FILE=false` or `NODE_ENV=test` | writes to `logs/app.log` with rotation |

These are the only two. The database, HTTP and webhook transports were removed
in 6.0; ship logs elsewhere by collecting stdout or the log file.

## Public API

### Logger instance (from `loggerClass.get(component?)`)

```ts
logger.debug(msg, meta?)
logger.info(msg, meta?)
logger.warn(msg, meta?)
logger.error(msg, meta?)
logger.child(bindings)                         // → Logger with bound meta
logger.flush()                                 // → Promise<void> — drain the file write buffer
logger.setLevel(level)                         // per-instance override
```

### loggerClass

```ts
loggerClass.get(component?)                    // → Logger (default component: service name)
loggerClass.disconnectAll()                    // close transports + flush (tests/teardown)
loggerClass.getActiveTransports()              // → string[]
loggerClass.hasTransport(name)                 // → boolean
loggerClass.getConfig()                        // → diagnostic object
```

## Env vars

- `BLOOM_LOGGER_LEVEL` — `debug` | `info` | `warn` | `error`
- `BLOOM_LOGGER_SCOPE` — `minimal` | `standard` | `full`
- `BLOOM_LOGGER_CONSOLE=false` — disable stdout
- `BLOOM_LOGGER_CONSOLE_COLOR=false` — disable ANSI
- `BLOOM_LOGGER_FILE=false` — disable file transport
- `BLOOM_LOGGER_DIR` — default `logs`
- `BLOOM_LOGGER_FILE_NAME` — default `app.log`
- `BLOOM_LOGGER_FILE_SIZE` — rotate threshold (bytes)
- `BLOOM_LOGGER_FILE_RETENTION` — days

## Common mistakes

- Stringifying meta before passing it: `logger.info('x ' + JSON.stringify(data))` —
  defeats structured logging. Pass the meta object: `logger.info('x', { data })`.
- `loggerClass.info(...)` — wrong, logger methods are instance methods.
  Use `loggerClass.get().info(...)` or keep a module-scoped `const logger = loggerClass.get(...)`.
- Setting `BLOOM_LOGGER_HTTP_URL`, `BLOOM_LOGGER_WEBHOOK_URL` or
  `BLOOM_LOGGER_DATABASE` — those transports no longer exist (6.0); the vars are ignored.
