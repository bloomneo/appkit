---
name: appkit-queue
description: >-
  Use when writing code that adds, processes, or schedules background jobs via
  `@bloomneo/appkit/queue`. Covers `queueClass.get()`, the
  Memory → Database transport auto-detection, and the
  `disconnectAll()` teardown pattern.
---

# @bloomneo/appkit/queue

Single-entry job queue: `queueClass.get()` returns a queue scoped to the
active transport. Transport is auto-detected from env. No explicit setup
beyond the env vars.

## Canonical flow

```ts
import { queueClass } from '@bloomneo/appkit/queue';

const queue = queueClass.get();

// Producer — anywhere in your code
await queue.add('send-email', { to: 'user@x.com', body: 'Welcome!' });

// Scheduler — run N ms in the future
await queue.schedule('reminder', { userId: 42 }, 60_000);

// Consumer — register once at startup
queue.process('send-email', async (data) => {
  await sendEmail(data.to, data.body);
});
```

## Transport auto-detection

| Env | Transport |
|---|---|
| `DATABASE_URL` set | Database table (Postgres) |
| unset | In-process Memory (dev default) |

Override explicitly: `BLOOM_QUEUE_TRANSPORT=database` or `memory`. `REDIS_URL`
does not select a queue transport; the Redis transport was removed in 6.0.

## Jobs keep their tenant (6.0)

A job added inside a tenant context (`database.tenant()`, `database.context()`,
a contract route) runs its handler in that tenant, so database calls in the
handler stay scoped; a job added during `database.bypass()` runs as that
bypass. The marker is removed before the handler sees `data`. Don't pass
`tenantId` in job data just to re-scope the handler.

## Worker mode — jobs don't process by default

In `NODE_ENV=test` the memory transport's processing loop is off by default,
so `queue.process()` registers the handler but nothing runs. Flip `BLOOM_QUEUE_WORKER=true`
before loading the module when you need handlers to execute in tests.

In production, set `BLOOM_QUEUE_WORKER=true` on the dyno/pod/service you want
processing jobs. Web dynos typically leave it off so they don't compete for
queue work with dedicated workers.

## Teardown

```ts
await queueClass.disconnectAll();   // close transports + reset singleton
```

Use at end of test suite, or from your own `SIGTERM` handler (opt-in — library
does not auto-register).

## Public API

### Queue instance (from `queueClass.get()`)

```ts
queue.add(jobType, data, options?)            // → Promise<jobId>
queue.process(jobType, handler)               // register a worker
queue.schedule(jobType, data, delayMs)        // → Promise<jobId>
queue.pause(jobType?) / queue.resume(jobType?)
queue.getStats(jobType?)                      // → {waiting, active, completed, failed, ...}
queue.getJobs(status, jobType?)               // → JobInfo[]
queue.retry(jobId) / queue.remove(jobId) / queue.clean(status, grace?)
queue.close()                                  // → Promise<void> (instance-level)
```

### queueClass

```ts
queueClass.get(overrides?)                    // → Queue
queueClass.disconnectAll()                    // teardown — canonical
queueClass.reset(newConfig?)                  // close + reinitialize (tests only)
queueClass.getActiveTransport()               // 'memory' | 'database' | 'none'
queueClass.hasTransport(name)                 // → boolean
queueClass.getConfig()                        // → diagnostic object
queueClass.getHealth()                        // → { status, transport, message? }
```

## Env vars

- `DATABASE_URL` — selects the database transport
- `BLOOM_QUEUE_TRANSPORT` — force `memory` / `database`
- `BLOOM_QUEUE_WORKER=true` — enable the processing loop on this process
- `BLOOM_QUEUE_CONCURRENCY` — default 5 (dev) / 10 (prod)
- `BLOOM_QUEUE_MAX_ATTEMPTS` — default 3
- `BLOOM_QUEUE_RETRY_BACKOFF` — `exponential` | `fixed`

## Methods that DO NOT exist

- `queueClass.clear()` — renamed to `disconnectAll()` (NAMING.md §70)
- `queueClass.add()` / `.process()` / `.close()` — class-level; wrong, these
  are instance methods: `queueClass.get().add(...)`
- `queue.enqueue()` / `.subscribe()` / `.cron()` — never existed
