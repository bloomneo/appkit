/**
 * examples/storage.ts
 *
 * Runnable tour of the @bloomneo/appkit/storage module.
 *
 * Strategy auto-selection:
 *   • AWS_S3_BUCKET set    → S3
 *   • R2_BUCKET set        → Cloudflare R2 (S3-compatible)
 *   • neither              → Local disk
 *
 * Run: tsx examples/storage.ts
 */

import { storageClass } from '../src/storage/index.js';

async function main() {
  // 1. Optional startup validation (warns about local-in-production, etc.).
  storageClass.validateConfig();

  const storage = storageClass.get();

  // 2. put / get / url.
  const key = await storage.put('uploads/hello.txt', 'hello world', {
    contentType: 'text/plain',
    cacheControl: 'public, max-age=60',
    metadata: { uploadedBy: 'examples/storage.ts' },
  });
  const bytes = await storage.get(key);
  console.log('round-trip bytes =', bytes.length);
  console.log('public url        =', storage.url(key));

  // 3. Signed URL for private content (expires in 5 minutes).
  const signed = await storage.signedUrl(key, 300);
  console.log('signed url        =', signed.slice(0, 64), '…');

  // 4. exists, copy, list, delete.
  console.log('exists =', await storage.exists(key));
  const copyKey = await storage.copy(key, 'uploads/hello-copy.txt');
  const listed = await storage.list('uploads/', 50);
  console.log('listed =', listed.map(f => f.key));
  await storage.delete(key);
  await storage.delete(copyKey);

  // 5. Convenience upload — auto-generates a key under `folder`.
  const uploaded = await storageClass.upload(Buffer.from('PDF DATA'), {
    folder: 'invoices/2026',
    filename: 'invoice-1001.pdf',
    contentType: 'application/pdf',
  });
  console.log('upload result =', uploaded);

  // 6. Convenience download — infers contentType from extension.
  const dl = await storageClass.download(uploaded.key);
  console.log('download contentType =', dl.contentType, 'bytes:', dl.data.length);
  await storage.delete(uploaded.key);

  // 7. Debug.
  console.log('strategy       =', storageClass.getStrategy());
  console.log('hasCloudStorage=', storageClass.hasCloudStorage());
  console.log('isLocal        =', storageClass.isLocal());
  console.log('stats          =', storageClass.getStats());

  // 8. Teardown.
  await storageClass.disconnectAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
