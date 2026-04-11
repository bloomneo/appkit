/**
 * CANONICAL PATTERN — pub/sub events with auto-scaling backend.
 *
 * Copy this file when you need events. Default is in-process memory (single
 * Node process). Set REDIS_URL to distribute events across processes / servers
 * — same code works in both modes.
 *
 * Use namespaces (eventClass.get('users')) to isolate event streams.
 */

import { eventClass, loggerClass } from '@bloomneo/appkit';

const events = eventClass.get('users');  // namespaced
const logger = loggerClass.get('events');

// ── Subscribe to a single event ─────────────────────────────────────
events.on('user.created', async (data) => {
  logger.info('New user', { userId: data.userId });
  // ...trigger welcome email, analytics, etc.
});

// ── Subscribe to a wildcard pattern ─────────────────────────────────
events.on('user.*', async (eventName, data) => {
  logger.debug(`User event: ${eventName}`, data);
});

// ── Emit an event from a route handler ──────────────────────────────
import { errorClass } from '@bloomneo/appkit';
const error = errorClass.get();

export const createUserRoute = error.asyncRoute(async (req, res) => {
  // ...create the user in the database
  const newUser = { id: 123, email: req.body.email };

  await events.emit('user.created', {
    userId: newUser.id,
    email: newUser.email,
    timestamp: new Date(),
  });

  res.json({ user: newUser });
});
