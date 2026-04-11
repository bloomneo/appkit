/**
 * CANONICAL PATTERN — file upload + retrieval with auto-scaling backend.
 *
 * Copy this file when you need to store files. The same code works against
 * local disk (default), AWS S3 (set AWS_S3_BUCKET), or Cloudflare R2
 * (set R2_BUCKET). No code changes needed — just .env.
 */

import { storageClass, errorClass, securityClass } from '@bloomneo/appkit';
import type { Request, Response } from 'express';

const storage = storageClass.get();
const error = errorClass.get();
const security = securityClass.get();

// ── Upload (with rate limit + filename sanitization) ────────────────
export const uploadRoute = [
  security.requests(10, 60_000),  // max 10 uploads per minute per IP
  error.asyncRoute(async (req: Request & { file: any }, res: Response) => {
    if (!req.file) throw error.badRequest('File required (use multer middleware)');

    // Sanitize the filename so a malicious user can't write to ../../../etc/...
    const safeName = security.input(req.file.originalname);
    const key = `uploads/${Date.now()}-${safeName}`;

    await storage.put(key, req.file.buffer, {
      contentType: req.file.mimetype,
    });

    res.json({
      key,
      url: storage.url(key),  // public URL (or signed URL for private buckets)
    });
  }),
];

// ── Download (signed URL — works with private S3 buckets) ───────────
export const downloadRoute = error.asyncRoute(async (req, res) => {
  const key = req.params.key;
  if (!(await storage.exists(key))) throw error.notFound('File not found');

  const signedUrl = await storage.signedUrl(key, 3600);  // valid for 1 hour
  res.json({ url: signedUrl });
});
