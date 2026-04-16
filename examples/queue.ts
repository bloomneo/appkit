/**
 * examples/queue.ts
 *
 * Runnable tour of the @bloomneo/appkit/queue module.
 *
 * Transport auto-selection (highest-priority match wins):
 *   • REDIS_URL set                               → Redis
 *   • BLOOM_QUEUE_DB=true  + DATABASE_URL set     → Database
 *   • neither                                     → in-process Memory
 *
 * Run: tsx examples/queue.ts
 */

import { queueClass } from '../src/queue/index.js';

async function main() {
  const queue = queueClass.get();

  // 1. Register a worker. Each job type has exactly one handler per process.
  queue.process<{ to: string; body: string }>('send-email', async (data) => {
    // real work would live here
    console.log('worker: send-email →', data.to);
    return { messageId: `msg_${Date.now()}` };
  });

  queue.process<{ userId: string }>('sync-profile', async ({ userId }) => {
    console.log('worker: sync-profile →', userId);
  });

  // 2. Enqueue immediately, with optional retry/backoff controls.
  const jobId = await queue.add(
    'send-email',
    { to: 'user@example.com', body: 'hi' },
    { attempts: 3, backoff: 'exponential', priority: 10, removeOnComplete: 100 },
  );
  console.log('enqueued:', jobId);

  // 3. Delay a job (runs ~5s from now).
  await queue.schedule('sync-profile', { userId: 'u_1' }, 5_000);

  // 4. Pause / resume a single type, or the whole queue (no arg).
  await queue.pause('send-email');
  await queue.resume('send-email');

  // 5. Introspection.
  const stats = await queue.getStats();              // all types
  const emailStats = await queue.getStats('send-email');
  console.log('stats all  =', stats);
  console.log('stats mail =', emailStats);

  const waiting = await queue.getJobs('waiting', 'send-email');
  console.log('waiting send-email jobs:', waiting.length);

  // 6. Retry / remove specific jobs by id.
  // await queue.retry(jobId);
  // await queue.remove(jobId);

  // 7. Cleanup old completed jobs (grace in ms).
  await queue.clean('completed', 60_000);

  // 8. Debug.
  console.log('transport =', queueClass.getActiveTransport());
  console.log('config    =', queueClass.getConfig());
  console.log('health    =', queueClass.getHealth());

  // 9. Teardown.
  await queueClass.disconnectAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
