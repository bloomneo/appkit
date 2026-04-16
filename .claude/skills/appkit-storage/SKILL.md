---
name: appkit-storage
description: >-
  Use when writing code that uploads, downloads, or generates presigned URLs
  for files via `@bloomneo/appkit/storage`. Covers the `storageClass.get()`
  pattern, Local → S3 → R2 strategy auto-detection, and the standard
  `put/get/delete/list` surface.
---

# @bloomneo/appkit/storage

Single-entry file storage: `storageClass.get()` returns a storage instance
scoped to the active strategy. Strategy is auto-detected: local filesystem
unless AWS S3 or Cloudflare R2 env vars are set.

## Canonical flow

```ts
import { storageClass } from '@bloomneo/appkit/storage';

const storage = storageClass.get();

// Upload
const result = await storage.put('avatars/42.png', fileBuffer, {
  contentType: 'image/png',
});
// → { path, url, size, ... }

// Download
const file = await storage.get('avatars/42.png');
// → { data: Buffer, metadata }

// Delete
await storage.delete('avatars/42.png');

// Presigned URL (S3/R2 only)
const url = await storage.getSignedUrl('avatars/42.png', 3600);
```

## Strategy auto-detection

| Env | Strategy |
|---|---|
| `CLOUDFLARE_R2_BUCKET` | Cloudflare R2 |
| `AWS_S3_BUCKET` / `S3_BUCKET` / `S3_ENDPOINT` | AWS S3 (or S3-compatible) |
| none | Local filesystem (default `./uploads`) |

Override: `BLOOM_STORAGE_STRATEGY=local|s3|r2`.

## Public API

### Storage instance (from `storageClass.get()`)

```ts
storage.put(path, data, options?)             // upload bytes or stream
storage.get(path)                             // download
storage.delete(path)
storage.list(prefix?)                         // → StorageFile[]
storage.exists(path)                          // → boolean
storage.getSignedUrl(path, expirySeconds?)    // S3/R2 only
storage.getUrl(path)                          // public URL
storage.copy(from, to) / storage.move(from, to)
```

### storageClass

```ts
storageClass.get(overrides?)                  // → Storage
storageClass.upload(path, data, options?)     // shortcut: get().put(...)
storageClass.download(path)                   // shortcut: get().get(...)
storageClass.clear()                          // clear local strategy cache (rare)
storageClass.reset(newConfig?)                // tests only
storageClass.getStrategy()                    // 'local' | 's3' | 'r2'
storageClass.hasCloudStorage()                // → boolean
storageClass.isLocal()                        // → boolean
storageClass.getStats()                       // → { strategy, totalFiles?, totalSize? }
storageClass.shutdown()                       // graceful close (call from SIGTERM)
```

## Env vars

Local (default):
- `BLOOM_STORAGE_DIR` — default `./uploads`
- `BLOOM_STORAGE_BASE_URL` — default `/uploads`
- `BLOOM_STORAGE_MAX_SIZE` — bytes, default 50 MB

S3 / S3-compatible:
- `AWS_S3_BUCKET` (or `S3_BUCKET`) — required
- `AWS_REGION` / `S3_REGION` — default `us-east-1`
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` — for S3-compatible providers (MinIO, etc.)
- `S3_FORCE_PATH_STYLE=true` — for MinIO
- `BLOOM_STORAGE_CDN_URL` — if files are served via CDN

R2:
- `CLOUDFLARE_R2_BUCKET` + `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID` + `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_CDN_URL`

Shared:
- `BLOOM_STORAGE_SIGNED_EXPIRY` — default 3600 seconds
- `BLOOM_STORAGE_ALLOWED_TYPES` — comma-sep MIME types

## Common mistakes

- Hard-coding paths like `./uploads/avatars/x.png` in handler code. Use
  `storage.put('avatars/x.png', ...)` — the strategy handles the prefix.
- Calling `getSignedUrl` with local strategy — local doesn't presign, use
  `getUrl(path)` for a public URL instead.
- Passing raw file objects from multer without reading the buffer — `storage.put`
  expects `Buffer | Uint8Array | Readable | string`, not a multer file wrapper.
