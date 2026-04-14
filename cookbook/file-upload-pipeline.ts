/**
 * COOKBOOK — Authenticated file upload → background processing pipeline.
 *
 * Modules:    auth + security + storage + queue + event + error + logger
 * Required:   BLOOM_AUTH_SECRET
 * Optional:   AWS_S3_BUCKET | R2_BUCKET (else local disk),
 *             REDIS_URL (else in-process queue + events)
 *
 * Flow:
 *   1. POST /upload → rate-limit (security.requests) → auth required
 *   2. storage.upload() persists the file and returns { key, url }.
 *   3. queue.add('process-upload', …) enqueues a worker job.
 *   4. Worker downloads, processes, and emits 'upload.processed'.
 *   5. Consumers of events.on('upload.processed') react (notify, index, …).
 */

import { Router } from 'express';
import {
  authClass,
  securityClass,
  storageClass,
  queueClass,
  eventClass,
  errorClass,
  loggerClass,
} from '@bloomneo/appkit';

const auth     = authClass.get();
const security = securityClass.get();
const logger   = loggerClass.get('uploads');
const events   = eventClass.get('uploads');

// ── HTTP endpoint ───────────────────────────────────────────────────
const router = Router();

router.post(
  '/upload',
  security.requests(30, 60_000),                 // 30 req / min per client
  auth.requireLoginToken(),
  errorClass.asyncRoute(async (req, res) => {
    const user = auth.getUser(req as any);
    // Upstream middleware (e.g. multer) puts the file on req.file.
    const file = (req as any).file;
    if (!file?.buffer) throw errorClass.badRequest('file required');
    if (file.size > 10 * 1024 * 1024) throw errorClass.badRequest('file too large (10MB max)');

    const { key, url } = await storageClass.upload(file.buffer, {
      folder: `uploads/${user?.userId ?? 'anon'}`,
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const jobId = await queueClass.get().add(
      'process-upload',
      { key, userId: user?.userId, contentType: file.mimetype },
      { attempts: 3, backoff: 'exponential', removeOnComplete: 100 },
    );

    logger.info('upload accepted', { key, jobId, userId: user?.userId });
    res.status(202).json({ key, url, jobId });
  }),
);

export default router;

// ── Worker ───────────────────────────────────────────────────────────
// Run from your worker bootstrap (or the same process for dev):
//   import './cookbook/file-upload-pipeline.js';  (side-effect registers handler)

type UploadJob = { key: string; userId?: string; contentType?: string };

queueClass.get().process<UploadJob>('process-upload', async ({ key, userId, contentType }) => {
  const storage = storageClass.get();

  // 1. Download the raw upload.
  const bytes = await storage.get(key);

  // 2. Do real work here (thumbnails, AV scan, OCR, …). Placeholder:
  const processedKey = key.replace(/^uploads\//, 'processed/');
  await storage.put(processedKey, bytes, { contentType, cacheControl: 'public, max-age=31536000' });

  // 3. Notify everyone listening — in-process or across Redis.
  await events.emit('upload.processed', {
    originalKey: key,
    processedKey,
    userId,
    url: storage.url(processedKey),
  });

  logger.info('upload processed', { originalKey: key, processedKey });
});

// ── Downstream consumer (example) ───────────────────────────────────
events.on('upload.processed', async (payload: any) => {
  logger.info('downstream consumer saw upload.processed', payload);
  // e.g. send email via emailClass, invalidate cache, write an audit record…
});
