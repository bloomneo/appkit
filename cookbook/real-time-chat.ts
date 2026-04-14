/**
 * COOKBOOK — Real-time chat fan-out with presence.
 *
 * Modules:    auth + event + cache + error + logger
 * Required:   BLOOM_AUTH_SECRET
 * Optional:   REDIS_URL (enables cross-process fan-out; required in multi-worker prod)
 *
 * Transport selection:
 *   • With REDIS_URL, every Node process that subscribes to 'chat:*' sees
 *     every emit across the cluster. Without it, fan-out is in-process only.
 *
 * Pattern:
 *   • One event namespace per chat room ('chat-<roomId>') keeps keyspaces clean.
 *   • Presence cached with a short TTL; each client refresh extends it.
 *   • WebSocket wiring is intentionally abstract — plug in ws / socket.io.
 */

import { randomUUID } from 'crypto';
import {
  authClass,
  eventClass,
  cacheClass,
  errorClass,
  loggerClass,
} from '@bloomneo/appkit';

const auth   = authClass.get();
const logger = loggerClass.get('chat');

// Presence TTL — clients must "ping" within this window to stay online.
const PRESENCE_TTL_SECONDS = 30;

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  text: string;
  at: string; // ISO timestamp
}

function roomEvents(roomId: string) {
  // Namespace is alphanumeric + `_-` only; sanitize the id.
  const safe = roomId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return eventClass.get(`chat-${safe}`);
}

function presenceCache() {
  return cacheClass.get('chat-presence');
}

// ── Server-side API used by your WebSocket layer ────────────────────

/** Authenticate a socket by validating the bearer token they sent. */
export function verifySocket(token: string) {
  try {
    return auth.verifyToken(token);
  } catch {
    throw errorClass.unauthorized('Invalid chat token');
  }
}

/** Subscribe a socket to a room. Returns an unsubscribe function. */
export function joinRoom(
  roomId: string,
  userId: string,
  deliver: (msg: ChatMessage) => void,
) {
  const events = roomEvents(roomId);

  const handler = (payload: ChatMessage) => deliver(payload);
  events.on('message', handler);

  presenceCache().set(`${roomId}:${userId}`, Date.now(), PRESENCE_TTL_SECONDS)
    .catch((err) => logger.warn('presence set failed', { err: err.message }));

  logger.info('room joined', { roomId, userId });

  return () => events.off('message', handler);
}

/** Heartbeat — extends presence. Call on every client ping. */
export async function heartbeat(roomId: string, userId: string) {
  await presenceCache().set(`${roomId}:${userId}`, Date.now(), PRESENCE_TTL_SECONDS);
}

/** Publish a chat message to every subscriber of the room. */
export async function postMessage(roomId: string, userId: string, text: string) {
  if (!text?.trim()) throw errorClass.badRequest('text required');
  if (text.length > 2000) throw errorClass.badRequest('text too long');

  const msg: ChatMessage = {
    id: randomUUID(),
    roomId,
    userId,
    text,
    at: new Date().toISOString(),
  };
  await roomEvents(roomId).emit('message', msg);
  logger.debug('message posted', { roomId, userId, id: msg.id });
  return msg;
}

/** Replay the last N messages (best-effort — transport may cap history). */
export async function recent(roomId: string, limit = 50) {
  const history = await roomEvents(roomId).history('message', limit);
  return history.map(h => h.data as ChatMessage);
}

/** Graceful shutdown — call from SIGTERM handler in worker processes. */
export async function shutdownChat() {
  await eventClass.shutdown();
  await cacheClass.disconnectAll();
}
