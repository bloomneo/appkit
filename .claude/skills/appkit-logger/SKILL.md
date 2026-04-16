---
name: appkit-logger
description: >-
  Use when writing code that emits structured logs via `@bloomneo/appkit/logger`.
  Covers the `loggerClass.get(component)` pattern, transport auto-detection
  (console / file / db / http / webhook), and child-logger composition.
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
const reqLog = logger.child({ requestId: req.id });
reqLog.info('Route hit');                      // → includes requestId automatically
```

## Levels

`debug` → `info` → `warn` → `error`. The active level is set by
`BLOOM_LOGGER_LEVEL` (default: `info` in prod, `debug` in dev).

Calls below the active level are no-ops (not written, not evaluated — meta
objects passed to `logger.debug(...)` in prod don't allocate).

## Transports

Transports activate independently based on env:

| Transport | Activation | What it does |
|---|---|---|
| Console | always (unless `BLOOM_LOGGER_CONSOLE=false`) | stdout/stderr |
| File | `BLOOM_LOGGER_FILE=true` | writes to `logs/app.log` with rotation |
| Database | `BLOOM_LOGGER_DATABASE=true` + `DATABASE_URL` | inserts to `logs` table |
| HTTP | `BLOOM_LOGGER_HTTP_URL` set | POSTs batches to the URL |
| Webhook | `BLOOM_LOGGER_WEBHOOK_URL` set | POSTs errors-only to webhook (Slack, etc.) |

Multiple transports can be active simultaneously; each log goes to all.

## Public API

### Logger instance (from `loggerClass.get(component?)`)

```ts
logger.debug(msg, meta?)
logger.info(msg, meta?)
logger.warn(msg, meta?)
logger.error(msg, meta?)
logger.child(bindings)                         // → Logger with bound meta
logger.flush()                                 // → Promise<void> — force-drain batch transports
logger.setLevel(level)                         // per-instance override
```

### loggerClass

```ts
loggerClass.get(component?)                    // → Logger (default component: service name)
loggerClass.clear()                            // remove all transports (tests)
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
- `BLOOM_LOGGER_DATABASE=true` + `DATABASE_URL` — opt-in DB transport
- `BLOOM_LOGGER_HTTP_URL` + `BLOOM_LOGGER_HTTP_BATCH` + `BLOOM_LOGGER_HTTP_TIMEOUT`
- `BLOOM_LOGGER_WEBHOOK_URL` + `BLOOM_LOGGER_WEBHOOK_LEVEL` (default `error`)

## Common mistakes

- Stringifying meta before passing it: `logger.info('x ' + JSON.stringify(data))` —
  defeats structured logging. Pass the meta object: `logger.info('x', { data })`.
- `loggerClass.info(...)` — wrong, logger methods are instance methods.
  Use `loggerClass.get().info(...)` or keep a module-scoped `const logger = loggerClass.get(...)`.
- Expecting HTTP/webhook transports to be synchronous — they batch. Call
  `logger.flush()` before process exit if you need delivery confirmation.
