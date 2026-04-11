/**
 * CANONICAL PATTERN — background job queue with auto-scaling backend.
 *
 * Copy this file when you need background jobs. Default backend is in-process
 * memory (good for dev). Set REDIS_URL to upgrade to distributed Redis.
 *
 * Same code works for all backends — no changes needed.
 *
 * queue.add(jobType, data, options)   — enqueue immediately or with a fixed delay
 * queue.schedule(jobType, data, delayMs) — alias: enqueue with a delay in ms
 * queue.process(jobType, handler)     — register a worker for that job type
 *
 * For cron-style recurring jobs: use a cron library (node-cron, etc.) to call
 * queue.add() at the right interval — there is no built-in cron scheduler.
 */

import { queueClass, loggerClass, errorClass } from '@bloomneo/appkit';

const queue = queueClass.get();
const logger = loggerClass.get('queue');
const error = errorClass.get();

// ── Producer: enqueue jobs from a route ─────────────────────────────
export const enqueueEmailRoute = error.asyncRoute(async (req, res) => {
  const { to, subject, body } = req.body;

  await queue.add(
    'send-email',
    { to, subject, body },
    {
      delay: 0,       // run immediately (ms)
      attempts: 3,    // retry up to 3 times on failure (not "retries")
      priority: 1,    // lower number = higher priority
    },
  );

  res.json({ queued: true });
});

// ── Consumer: process jobs (run in a worker process or main app) ────
queue.process('send-email', async (data) => {
  const { to, subject, body } = data as { to: string; subject: string; body: string };
  logger.info('Email sent', { to, subject });
  return { sent: true };
});

// ── Delayed job (run once after N ms, not cron-style) ───────────────
// To run cleanup every day at 03:00, use node-cron to call queue.add() at the
// right time — queue.schedule() accepts a delay in milliseconds, not a cron expression.
await queue.schedule(
  'cleanup-expired-tokens',
  {},
  8 * 60 * 60 * 1000,   // run once, 8 hours from now
);

queue.process('cleanup-expired-tokens', async () => {
  logger.info('Token cleanup ran');
});
