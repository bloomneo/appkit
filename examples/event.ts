/**
 * examples/event.ts
 *
 * Runnable tour of the @bloomneo/appkit/event module.
 *
 * Strategy auto-selection:
 *   • REDIS_URL set → Redis pub/sub (cross-process fan-out)
 *   • unset         → in-process Memory
 *
 * Namespaces isolate events. A handler on events namespace 'billing'
 * will never receive events emitted on namespace 'notifications'.
 *
 * Run: tsx examples/event.ts
 */

import { eventClass } from '../src/event/index.js';

async function main() {
  const events = eventClass.get('orders');

  // 1. Subscribe. on() stays subscribed; once() auto-unsubscribes.
  events.on('order.created', (data: any) => {
    console.log('order.created handler:', data);
  });

  events.once('order.shipped', (data: any) => {
    console.log('order.shipped (once) :', data);
  });

  // 2. Wildcard handler — fires for every event in the namespace.
  events.on('*', (eventName: string, data: any) => {
    console.log('[wildcard]', eventName, data);
  });

  // 3. Emit — works the same whether strategy is Memory or Redis.
  await events.emit('order.created', { id: 'ord_1', total: 9900 });
  await events.emit('order.shipped', { id: 'ord_1', tracking: 'ZZ123' });
  await events.emit('order.shipped', { id: 'ord_1', tracking: 'ZZ123' }); // handler gone (once)

  // 4. Batch emit for throughput.
  const results = await events.emitBatch([
    { event: 'order.created', data: { id: 'ord_2' } },
    { event: 'order.created', data: { id: 'ord_3' } },
  ]);
  console.log('batch results:', results);

  // 5. Replay recent history (best-effort; subject to strategy limits).
  const history = await events.history('order.created', 10);
  console.log('history entries:', history.length);

  // 6. Listener introspection.
  console.log('listeners for order.created =', events.getListeners('order.created'));

  // 7. Unsubscribe. Passing no handler removes all handlers for the event.
  const handler = (d: any) => console.log('unused', d);
  events.on('noop', handler as any);
  events.off('noop', handler as any);

  // 8. Health + debug.
  console.log('strategy         =', eventClass.getStrategy());
  console.log('active namespaces=', eventClass.getActiveNamespaces());
  console.log('stats            =', eventClass.getStats());
  console.log('health           =', eventClass.getHealthStatus());

  // 9. Broadcast to every namespace at once (rare; admin-style).
  await eventClass.broadcast('shutdown', { reason: 'deploy' });

  // 10. Teardown.
  await eventClass.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
