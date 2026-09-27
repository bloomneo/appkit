/**
 * requestId() — give every request a correlation id.
 *
 * Reuses a safe incoming `X-Request-Id` (so a proxy's or client's id carries
 * through), otherwise makes a short one; echoes it in the `X-Request-Id`
 * response header; sets `req.requestId` and `req.requestMetadata.requestId`
 * (what Bloom apps read); and runs the rest of the request in a context the
 * logger reads, so every log line names the request.
 *
 * ```ts
 * app.use(requestId());   // first, before routes
 * ```
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { requestStore } from '../internal/request-context.js';

const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get?.('x-request-id');
    const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID().slice(0, 8);
    res.setHeader('X-Request-Id', id);
    req.requestId = id;
    req.requestMetadata = { ...(req.requestMetadata ?? {}), requestId: id, startTime: Date.now() };
    requestStore.run({ requestId: id }, () => next());
  };
}
