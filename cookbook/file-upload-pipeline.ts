/**
 * COOKBOOK RECIPE — File upload → background processing pipeline.
 *
 * Demonstrates the producer-consumer pattern: upload route stores the file
 * and enqueues a job, a worker process picks up the job and processes the
 * file in the background. Same code works against local disk + memory queue
 * (dev) or S3 + Redis queue (production).
 *
 * Modules used: storage, queue, logger, security, error, auth
 * Required env: BLOOM_AUTH_SECRET
 * Optional env: AWS_S3_BUCKET (cloud storage), REDIS_URL (distributed queue)
 *
 * Note: this example uses multer-style req.file which means you need
 * `import multer from 'multer'` and `app.use(multer().single('file'))`
 * — multer is a peerDependency of @bloomneo/appkit.
 */

import { Router, Request, Response } from 'express';
import {
  storageClass,
  queueClass,
  loggerClass,
  securityClass,
  errorClass,
  authClass,
} from '@bloomneo/appkit';

const storage = storageClass.get();
const queue = queueClass.get();
const logger = loggerClass.get('uploads');
const security = securityClass.get();
const error = errorClass.get();
const auth = authClass.get();

const router = Router();

// ── PRODUCER: upload route ──────────────────────────────────────────
router.post(
  '/upload',
  auth.requireLoginToken(),
  security.requests(10, 60 * 1000),  // 10 uploads / minute / IP
  error.asyncRoute(async (req: Request & { file?: any }, res: Response) => {
    if (!req.file) throw error.badRequest('File required');

    // Sanitize filename
    const safeName = security.input(req.file.originalname);
    const key = `uploads/${Date.now()}-${safeName}`;

    // Store the file (auto-detects local vs S3 from env)
    await storage.put(key, req.file.buffer, {
      contentType: req.file.mimetype,
    });

    // Enqueue background processing
    await queue.add('process-upload', {
      key,
      userId: auth.user(req)?.userId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    }, {
      attempts: 3,
    });

    logger.info('File uploaded, queued for processing', {
      key,
      userId: auth.user(req)?.userId,
      size: req.file.size,
    });

    res.status(202).json({
      key,
      url: storage.url(key),
      status: 'processing',
    });
  }),
);

// ── CONSUMER: background worker (run in same process or separate worker) ──
queue.process('process-upload', async (data) => {
  const { key, userId, originalName } = data;
  const workerLogger = loggerClass.get('upload-worker');

  try {
    workerLogger.info('Processing upload', { key, userId });

    // Fetch the file
    const buffer = await storage.get(key);

    // ...do something with it (resize, OCR, virus scan, transcode, etc.)
    // const processed = await processImage(buffer);

    // Store the processed result
    const processedKey = key.replace(/(\.[^.]+)$/, '-processed$1');
    await storage.put(processedKey, buffer);

    workerLogger.info('Upload processed', {
      original: key,
      processed: processedKey,
      userId,
    });

    return { processedKey, originalName };
  } catch (err) {
    workerLogger.error('Upload processing failed', {
      key,
      error: (err as Error).message,
    });
    throw err;  // queue will retry per the attempts: 3 setting above
  }
});

export default router;
