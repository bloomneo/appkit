/**
 * COOKBOOK RECIPE — Real-time chat with pub/sub events.
 *
 * Demonstrates the eventClass pattern for real-time features. Same code
 * works in single-process mode (memory backend) or distributed mode
 * (Redis pub/sub when REDIS_URL is set).
 *
 * Pair with a WebSocket library (Socket.IO, ws, etc.) for the actual
 * client transport. This file shows the bloomneo backend half — the
 * WebSocket layer just calls events.emit() / events.on() under the hood.
 *
 * Modules used: event, auth, database, error
 * Required env: BLOOM_AUTH_SECRET, DATABASE_URL
 * Optional env: REDIS_URL (for cross-process event distribution)
 */

import {
  eventClass,
  authClass,
  databaseClass,
  errorClass,
} from '@bloomneo/appkit';

// Namespaced events: 'chat' isolates these events from other event streams
// in the same app.
const events = eventClass.get('chat');
const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();

// ── EVENT HANDLERS (subscribe at startup) ───────────────────────────

// User connects (called from your WebSocket onConnection handler)
events.on('user.connected', async (data: { userId: number; socketId: string }) => {
  const { userId, socketId } = data;

  // Look up the user's rooms from the database
  const memberships = await database.roomMember.findMany({
    where: { userId },
    select: { roomId: true },
  });

  // Tell the WebSocket layer to join this socket to its rooms
  await events.emit('socket.join-rooms', {
    socketId,
    rooms: [
      `user:${userId}`,
      ...memberships.map((m) => `room:${m.roomId}`),
    ],
  });
});

// User sends a message
events.on('message.send', async (data: {
  userId: number;
  roomId: number;
  content: string;
}) => {
  // Persist the message
  const message = await database.message.create({
    data: {
      content: data.content,
      userId: data.userId,
      roomId: data.roomId,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  // Broadcast to everyone in the room
  await events.emit('message.broadcast', {
    roomId: data.roomId,
    message: {
      id: message.id,
      content: message.content,
      user: message.user,
      timestamp: message.createdAt.toISOString(),
    },
  });
});

// Wildcard subscriber for analytics / logging
events.on('*', async (eventName: string, data: any) => {
  // Log every chat event for analytics
  // (in production, send to a queue instead of logging inline)
  console.log(`[chat] ${eventName}`, JSON.stringify(data));
});

// ── REST API: send message via HTTP (alternative to WebSocket) ──────
import { Router } from 'express';
const router = Router();

router.post(
  '/rooms/:roomId/messages',
  auth.requireLoginToken(),
  error.asyncRoute(async (req, res) => {
    const u = auth.user(req);
    if (!u) throw error.unauthorized();

    const roomId = Number(req.params.roomId);
    const { content } = req.body;
    if (!content) throw error.badRequest('content required');

    // Verify membership
    const membership = await database.roomMember.findFirst({
      where: { userId: u.userId, roomId },
    });
    if (!membership) throw error.forbidden('Not a member of this room');

    // Emit the event — WebSocket layer + persistence both happen via the
    // events.on('message.send') handler above.
    await events.emit('message.send', {
      userId: u.userId,
      roomId,
      content,
    });

    res.status(202).json({ queued: true });
  }),
);

export default router;
