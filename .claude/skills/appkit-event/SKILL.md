---
name: appkit-event
description: >-
  Use when writing code that publishes or subscribes to application events via
  `@bloomneo/appkit/event`. Covers `eventClass.get(namespace)`, Memory → Redis
  auto-detection, wildcard handlers, and the `broadcast()` cross-namespace op.
---

# @bloomneo/appkit/event

Single-entry pub/sub: `eventClass.get('orders')` returns a namespaced event
bus. Memory in dev (in-process), Redis in prod (cross-process). Same API
either way.

## Canonical flow

```ts
import { eventClass } from '@bloomneo/appkit/event';

const events = eventClass.get('orders');

// Subscriber
events.on('order.placed', async (data) => {
  await notifyWarehouse(data.orderId);
});

// One-shot subscriber
events.once('order.first-ever', () => console.log('We made a sale!'));

// Wildcard — matches `order.*`
events.on('order.*', (data, eventName) => {
  auditLog.write({ eventName, data });
});

// Publisher
await events.emit('order.placed', { orderId: 42, total: 99.99 });

// Batch
await events.emitBatch([
  { name: 'order.placed',  data: { orderId: 42 } },
  { name: 'invoice.issued', data: { orderId: 42 } },
]);
```

## Memory vs Redis

| Env | Strategy | Cross-process? |
|---|---|---|
| `REDIS_URL` | Redis | ✅ Yes |
| unset | Memory | ❌ Only this process |

In dev you'll likely run Memory, so events fired in `api/` don't reach
listeners in `worker/`. Set `REDIS_URL` when you need multi-process fanout.

## Broadcast — cross-namespace

`eventClass.broadcast('system.ping')` fires a named event across **every
active namespace**. Useful for "shut everything down" or "config changed,
reload" notifications.

## Public API

### Event instance (from `eventClass.get(ns)`)

```ts
events.on(name, handler)                       // subscribe
events.once(name, handler)                     // subscribe, auto-unsub after first fire
events.off(name, handler?)                     // unsubscribe
events.emit(name, data)                        // → Promise<void>
events.emitBatch(batch)
events.history(name?, limit?)                  // → EventHistoryEntry[]
events.onAny(handler)                          // wildcard (synonym for `on('*', ...)`)
events.listenerCount(name)                     // → number
```

### eventClass

```ts
eventClass.get(namespace?)                     // → Event (default 'default')
eventClass.broadcast(eventName, data?)         // fires across all namespaces
eventClass.clear() / eventClass.reset(cfg?)    // tests
eventClass.getStrategy()                       // 'memory' | 'redis'
eventClass.getActiveNamespaces()               // → string[]
eventClass.hasRedis()                          // → boolean
eventClass.getStats()                          // → diagnostic
eventClass.validateProduction()
eventClass.getHealthStatus()
eventClass.shutdown()                          // graceful close (call from SIGTERM)
```

## Env vars

- `REDIS_URL` + `REDIS_PASSWORD` — opt-in Redis
- `BLOOM_EVENT_NAMESPACE` — default namespace for `get()` with no arg
- `BLOOM_EVENT_REDIS_PREFIX` — default `events`
- `BLOOM_EVENT_HISTORY_ENABLED` — default true
- `BLOOM_EVENT_HISTORY_SIZE` — events retained per namespace
- `BLOOM_EVENT_STRATEGY` — force `memory` / `redis`

## Common mistakes

- Subscribing inside a request handler — handlers leak one subscription per
  request. Subscribe once at startup.
- `emit` without `await` — if you need confirmation the event was delivered
  (Redis), await the promise.
- Assuming cross-process delivery in dev — it's Memory by default. Set
  `REDIS_URL` or tests will pass locally and fail in prod.
