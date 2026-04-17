# @bloomneo/appkit - Storage Module 📁

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple file storage that just works with automatic Local/S3/R2 strategy

**One function** returns a storage system with automatic strategy detection.
Zero configuration needed, production-ready cloud integration by default, with
built-in CDN support and cost optimization.

> **See also:** [AGENTS.md](../../AGENTS.md) (agent rules) · [llms.txt](../../llms.txt) (full API reference) · [examples/storage.ts](../../examples/storage.ts) · cookbook: [file-upload-pipeline.ts](../../cookbook/file-upload-pipeline.ts)

## 🚀 Why Choose This?

- **⚡ One Function** - Just `storageClass.get()`, everything else is automatic
- **☁️ Auto Strategy** - Cloud env vars → Distributed, No vars → Local
- **🔧 Zero Configuration** - Smart defaults for everything
- **💰 Cost Optimized** - R2 prioritized for zero egress fees
- **🌍 CDN Ready** - Automatic CDN URL generation
- **🔒 Security Built-in** - File type validation, size limits, signed URLs
- **⚖️ Scales Perfectly** - Development → Production with no code changes
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

### Local Storage (Development)

```typescript
import { storageClass } from '@bloomneo/appkit/storage';

const storage = storageClass.get();

// Upload files
await storage.put('avatars/user123.jpg', imageBuffer);

// Download files
const imageData = await storage.get('avatars/user123.jpg');

// Get public URL
const url = storage.url('avatars/user123.jpg');
// → /uploads/avatars/user123.jpg

// List files
const files = await storage.list('avatars/');
```

### Cloud Storage (Production)

```bash
# Cloudflare R2 (Recommended - Zero egress fees)
CLOUDFLARE_R2_BUCKET=my-bucket
CLOUDFLARE_ACCOUNT_ID=account123
CLOUDFLARE_R2_ACCESS_KEY_ID=access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret_key

# OR AWS S3 / S3-Compatible
AWS_S3_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=access_key
AWS_SECRET_ACCESS_KEY=secret_key
```

```typescript
import { storageClass } from '@bloomneo/appkit/storage';

const storage = storageClass.get();

// Same code - now distributed across CDN!
await storage.put('products/item123.jpg', imageBuffer);
const url = storage.url('products/item123.jpg');
// → https://cdn.example.com/products/item123.jpg
```

**That's it!** Files automatically sync across all your servers.

## 🧠 Mental Model

### **Strategy Auto-Detection**

Environment variables determine storage backend:

```bash
# Development/Single Server
# (no cloud env vars)
→ Local Strategy: ./uploads/ directory

# Production Cloud (Priority: R2 → S3 → Local)
CLOUDFLARE_R2_BUCKET=bucket → R2 (zero egress fees)
AWS_S3_BUCKET=bucket        → S3 (AWS/Wasabi/MinIO)
# No cloud vars              → Local (with warning)
```

### **File Organization**

```typescript
// Organize files with folder structure
await storage.put('users/123/avatar.jpg', imageBuffer);
await storage.put('products/456/gallery/1.jpg', imageBuffer);
await storage.put('documents/contracts/legal.pdf', pdfBuffer);

// List by folder
const userFiles = await storage.list('users/123/');
const productGallery = await storage.list('products/456/gallery/');
```

## 🤖 LLM Quick Reference - Copy These Patterns

### **Basic Storage Setup (Copy Exactly)**

```typescript
// ✅ CORRECT - Complete storage setup
import { storageClass } from '@bloomneo/appkit/storage';
const storage = storageClass.get();

// Upload files
await storage.put('folder/file.jpg', buffer);
const data = await storage.get('folder/file.jpg');
await storage.delete('folder/file.jpg');

// URL generation
const publicUrl = storage.url('file.jpg');
const signedUrl = await storage.signedUrl('private.pdf', 3600);

// File organization
const files = await storage.list('images/');
const exists = await storage.exists('document.pdf');
```

### **Helper Methods (Copy These)**

```typescript
// ✅ Quick upload with auto-naming
const { key, url } = await storageClass.upload(buffer, {
  folder: 'uploads',
  filename: 'document.pdf',
});

// ✅ Quick download with content type
const { data, contentType } = await storageClass.download('file.jpg');

// ✅ Strategy detection
const strategy = storageClass.getStrategy(); // 'local' | 's3' | 'r2'
const isCloud = storageClass.hasCloudStorage(); // true if S3/R2
```

### **Error Handling (Copy This Pattern)**

```typescript
// ✅ CORRECT - Comprehensive error handling
try {
  await storage.put('file.jpg', buffer);
  console.log('✅ File uploaded successfully');
} catch (error) {
  if (error.message.includes('File too large')) {
    return res.status(413).json({ error: 'File size limit exceeded' });
  }
  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  console.error('❌ Upload failed:', error.message);
  return res.status(500).json({ error: 'Upload failed' });
}
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Wrong Storage Usage**

```typescript
// ❌ WRONG - Don't create StorageClass directly
import { StorageClass } from '@bloomneo/appkit/storage';
const storage = new StorageClass(config); // Wrong!

// ❌ WRONG - Missing await
storage.put('file.jpg', buffer); // Missing await!

// ❌ WRONG - Invalid keys
await storage.put('/file.jpg', buffer); // Leading slash
await storage.put('folder/../file.jpg', buffer); // Path traversal
await storage.put('folder\\file.jpg', buffer); // Backslashes

// ✅ CORRECT - Use storageClass.get()
import { storageClass } from '@bloomneo/appkit/storage';
const storage = storageClass.get();
await storage.put('folder/file.jpg', buffer);
```

### **Wrong Error Handling**

```typescript
// ❌ WRONG - Ignoring errors
await storage.put('file.jpg', buffer); // No try-catch

// ❌ WRONG - Generic error handling
try {
  await storage.put('file.jpg', buffer);
} catch (error) {
  res.status(500).json({ error: 'Something went wrong' });
}

// ✅ CORRECT - Specific error handling
try {
  await storage.put('file.jpg', buffer);
} catch (error) {
  if (error.message.includes('File too large')) {
    return res.status(413).json({
      error: 'File too large',
      maxSize: '50MB',
    });
  }
  throw error;
}
```

### **Wrong Testing**

```typescript
// ❌ WRONG - No cleanup between tests
test('should upload file', async () => {
  await storage.put('test.jpg', buffer);
  // Missing: await storageClass.disconnectAll();
});

// ✅ CORRECT - Proper test cleanup
afterEach(async () => {
  await storageClass.disconnectAll(); // Essential for tests
});
```

## 🚨 Error Handling Patterns

### **File Upload API**

```typescript
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file size (optional - storage handles this)
    if (req.file.size > 50 * 1024 * 1024) {
      // 50MB
      return res.status(413).json({
        error: 'File too large',
        maxSize: '50MB',
      });
    }

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    await storage.put(key, req.file.buffer, {
      contentType: req.file.mimetype,
    });

    const url = storage.url(key);

    res.json({
      success: true,
      file: { key, url, size: req.file.size },
    });
  } catch (error) {
    if (error.message.includes('File type not allowed')) {
      return res.status(400).json({
        error: 'Invalid file type',
        allowed: 'jpg, png, pdf, txt',
      });
    }

    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

### **File Download API**

```typescript
app.get('/files/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;

    if (!(await storage.exists(key))) {
      return res.status(404).json({ error: 'File not found' });
    }

    const buffer = await storage.get(key);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${key.split('/').pop()}"`
    );

    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});
```

### **Startup Validation**

```typescript
// ✅ App startup validation
try {
  storageClass.validateConfig();
  console.log('✅ Storage validation passed');
} catch (error) {
  console.error('❌ Storage validation failed:', error.message);
  process.exit(1);
}
```

## 🔒 Security & Production

### **File Type Security**

```bash
# ✅ SECURE - Specific file types only
BLOOM_STORAGE_ALLOWED_TYPES=image/jpeg,image/png,application/pdf,text/plain

# ⚠️ DEVELOPMENT ONLY - All file types
BLOOM_STORAGE_ALLOWED_TYPES=*

# ✅ SECURE - File size limits
BLOOM_STORAGE_MAX_SIZE=52428800  # 50MB limit
```

### **Production Checklist**

- ✅ **Cloud Storage**: Set `AWS_S3_BUCKET` or `CLOUDFLARE_R2_BUCKET`
- ✅ **File Types**: Set `BLOOM_STORAGE_ALLOWED_TYPES` (never use `*`)
- ✅ **Size Limits**: Set reasonable `BLOOM_STORAGE_MAX_SIZE`
- ✅ **CDN**: Set `BLOOM_STORAGE_CDN_URL` for performance
- ✅ **Error Handling**: Implement proper error responses
- ✅ **Monitoring**: Log upload/download operations

### **Security Validation**

```typescript
// File type validation (automatic)
try {
  await storage.put('malicious.exe', buffer);
} catch (error) {
  // Error: File type not allowed: application/x-executable
}

// File size validation (automatic)
try {
  await storage.put('huge.zip', massiveBuffer);
} catch (error) {
  // Error: File too large: 100MB (max: 50MB)
}

// Path traversal prevention (automatic)
try {
  await storage.put('../../../etc/passwd', buffer);
} catch (error) {
  // Error: Storage key contains invalid path components
}
```

## 📖 Complete API Reference

### Core Function

```typescript
const storage = storageClass.get(); // One function, everything you need
```

### File Operations

```typescript
// Upload files
await storage.put(key, data, options?);
await storage.put('file.jpg', buffer, {
  contentType: 'image/jpeg',
  metadata: { userId: '123' },
  cacheControl: 'public, max-age=31536000'
});

// Download files
const buffer = await storage.get('file.jpg');

// Delete files
const success = await storage.delete('file.jpg');

// Check existence
const exists = await storage.exists('file.jpg');

// Copy files
await storage.copy('source.jpg', 'backup.jpg');
```

### URL Generation

```typescript
// Public URLs
const url = storage.url('file.jpg');
// Local:  /uploads/file.jpg
// S3:     https://bucket.s3.region.amazonaws.com/file.jpg
// R2:     https://cdn.example.com/file.jpg

// Signed URLs (temporary access)
const signedUrl = await storage.signedUrl('private.pdf', 3600); // 1 hour
```

### File Listing

```typescript
// List all files
const allFiles = await storage.list();

// List with prefix
const images = await storage.list('images/');

// List with limit
const recent = await storage.list('logs/', 10);

// File metadata
files.forEach((file) => {
  console.log(`${file.key}: ${file.size} bytes, ${file.lastModified}`);
});
```

### Helper Methods

```typescript
// Quick upload with auto-naming
const { key, url } = await storageClass.upload(buffer, {
  folder: 'uploads',
  filename: 'document.pdf',
  contentType: 'application/pdf',
});

// Quick download with content type
const { data, contentType } = await storageClass.download('file.jpg');
```

### Utility Methods

```typescript
// Debug info
storageClass.getStrategy(); // 'local' | 's3' | 'r2'
storageClass.hasCloudStorage(); // true if S3/R2 configured
storageClass.isLocal(); // true if using local storage
storageClass.getConfig(); // Current configuration
storageClass.getStats(); // Usage statistics

// Cleanup
await storage.disconnect();
await storageClass.disconnectAll(); // For testing
```

## 🎯 Usage Examples

### **Express File Upload API**

```typescript
import express from 'express';
import multer from 'multer';
import { storageClass } from '@bloomneo/appkit/storage';

const app = express();
const storage = storageClass.get();
const upload = multer({ storage: multer.memoryStorage() });

// Single file upload
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const timestamp = Date.now();
    const key = `uploads/${timestamp}-${req.file.originalname}`;

    await storage.put(key, req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        uploadedBy: req.user?.id || 'anonymous',
        uploadedAt: new Date().toISOString(),
      },
    });

    const url = storage.url(key);

    res.json({
      success: true,
      file: {
        key,
        url,
        size: req.file.size,
        contentType: req.file.mimetype,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File download
app.get('/files/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;

    if (!(await storage.exists(key))) {
      return res.status(404).json({ error: 'File not found' });
    }

    const buffer = await storage.get(key);

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${key.split('/').pop()}"`
    );

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate signed download URL
app.get('/files/:key(*)/signed', async (req, res) => {
  try {
    const key = req.params.key;
    const expiresIn = parseInt(req.query.expires as string) || 3600; // 1 hour default

    const signedUrl = await storage.signedUrl(key, expiresIn);

    res.json({
      url: signedUrl,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **Image Processing Pipeline**

```typescript
import { storageClass } from '@bloomneo/appkit/storage';
import sharp from 'sharp';

const storage = storageClass.get();

export class ImageProcessor {
  async processImage(originalKey: string) {
    // Download original
    const originalBuffer = await storage.get(originalKey);

    // Create different sizes
    const sizes = [
      { name: 'thumb', width: 150, height: 150 },
      { name: 'medium', width: 500, height: 500 },
      { name: 'large', width: 1200, height: 1200 },
    ];

    const results = [];

    for (const size of sizes) {
      // Process with Sharp
      const processedBuffer = await sharp(originalBuffer)
        .resize(size.width, size.height, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Generate new key
      const [name, ext] = originalKey.split('.');
      const newKey = `${name}-${size.name}.${ext}`;

      // Upload processed image
      await storage.put(newKey, processedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000', // 1 year cache
      });

      results.push({
        size: size.name,
        key: newKey,
        url: storage.url(newKey),
        dimensions: `${size.width}x${size.height}`,
      });
    }

    return results;
  }

  async cleanupProcessedImages(originalKey: string) {
    const [name] = originalKey.split('.');
    const files = await storage.list(name);

    for (const file of files) {
      if (
        file.key.includes('-thumb.') ||
        file.key.includes('-medium.') ||
        file.key.includes('-large.')
      ) {
        await storage.delete(file.key);
      }
    }
  }
}
```

### **Document Management System**

```typescript
import { storageClass } from '@bloomneo/appkit/storage';

const storage = storageClass.get();

export class DocumentManager {
  async uploadDocument(
    file: Buffer,
    metadata: {
      userId: string;
      category: string;
      filename: string;
      contentType: string;
    }
  ) {
    const { userId, category, filename } = metadata;
    const timestamp = Date.now();
    const key = `documents/${userId}/${category}/${timestamp}-${filename}`;

    await storage.put(key, file, {
      contentType: metadata.contentType,
      metadata: {
        userId,
        category,
        originalName: filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      documentId: key,
      url: storage.url(key),
      category,
      uploadedAt: new Date(),
    };
  }

  async getUserDocuments(userId: string, category?: string) {
    const prefix = category
      ? `documents/${userId}/${category}/`
      : `documents/${userId}/`;

    const files = await storage.list(prefix);

    return files.map((file) => ({
      documentId: file.key,
      filename: file.key.split('/').pop(),
      category: file.key.split('/')[2],
      size: file.size,
      lastModified: file.lastModified,
      url: storage.url(file.key),
    }));
  }

  async generateShareLink(documentId: string, expiresInHours: number = 24) {
    const expiresIn = expiresInHours * 3600; // Convert to seconds
    const signedUrl = await storage.signedUrl(documentId, expiresIn);

    return {
      url: signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      expiresInHours,
    };
  }

  async deleteDocument(documentId: string) {
    return await storage.delete(documentId);
  }
}
```

### **Backup & Sync System**

```typescript
import { storageClass } from '@bloomneo/appkit/storage';

const storage = storageClass.get();

export class BackupManager {
  async createBackup(sourcePrefix: string) {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupPrefix = `backups/${timestamp}/`;

    const sourceFiles = await storage.list(sourcePrefix);
    const backupResults = [];

    for (const file of sourceFiles) {
      const relativePath = file.key.replace(sourcePrefix, '');
      const backupKey = backupPrefix + relativePath;

      try {
        await storage.copy(file.key, backupKey);
        backupResults.push({
          original: file.key,
          backup: backupKey,
          status: 'success',
        });
      } catch (error) {
        backupResults.push({
          original: file.key,
          backup: backupKey,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return {
      backupId: timestamp,
      sourcePrefix,
      backupPrefix,
      totalFiles: sourceFiles.length,
      successful: backupResults.filter((r) => r.status === 'success').length,
      failed: backupResults.filter((r) => r.status === 'failed').length,
      results: backupResults,
    };
  }

  async restoreFromBackup(backupId: string, targetPrefix: string) {
    const backupPrefix = `backups/${backupId}/`;
    const backupFiles = await storage.list(backupPrefix);

    for (const file of backupFiles) {
      const relativePath = file.key.replace(backupPrefix, '');
      const targetKey = targetPrefix + relativePath;

      await storage.copy(file.key, targetKey);
    }

    return {
      restored: backupFiles.length,
      targetPrefix,
    };
  }

  async cleanupOldBackups(retentionDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const backups = await storage.list('backups/');
    const oldBackups = backups.filter((file) => file.lastModified < cutoffDate);

    for (const backup of oldBackups) {
      await storage.delete(backup.key);
    }

    return {
      deleted: oldBackups.length,
      retentionDays,
    };
  }
}
```

## 🌍 Environment Variables

### Strategy Selection (Auto-detected)

```bash
# Priority order: R2 → S3 → Local

# Cloudflare R2 (Highest priority - zero egress fees)
CLOUDFLARE_R2_BUCKET=my-bucket
CLOUDFLARE_ACCOUNT_ID=account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret_key
CLOUDFLARE_R2_CDN_URL=https://cdn.example.com  # Optional CDN

# AWS S3 / S3-Compatible (Second priority)
AWS_S3_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=access_key
AWS_SECRET_ACCESS_KEY=secret_key
AWS_REGION=us-east-1                           # Default: us-east-1

# S3-Compatible Services (Wasabi, MinIO, etc.)
S3_ENDPOINT=https://s3.wasabisys.com           # Custom endpoint
S3_FORCE_PATH_STYLE=true                       # For MinIO

# Local Storage (Fallback - no cloud vars needed)
BLOOM_STORAGE_DIR=./uploads                    # Default: ./uploads
BLOOM_STORAGE_BASE_URL=/uploads                # Default: /uploads
```

### Security & Limits

```bash
# File validation
BLOOM_STORAGE_MAX_SIZE=52428800               # 50MB default
BLOOM_STORAGE_ALLOWED_TYPES=image/*,application/pdf,text/*

# Signed URL expiration
BLOOM_STORAGE_SIGNED_EXPIRY=3600              # 1 hour default

# CDN configuration
BLOOM_STORAGE_CDN_URL=https://cdn.example.com # For any strategy
```

## 🔄 Development vs Production

### **Development Mode**

```bash
# No environment variables needed
NODE_ENV=development
```

```typescript
const storage = storageClass.get();
// Strategy: Local filesystem (./uploads/)
// URLs: /uploads/file.jpg
// Features: File type validation, size limits
```

### **Production Mode**

```bash
# Cloud storage required
NODE_ENV=production
CLOUDFLARE_R2_BUCKET=prod-assets
# ... other cloud credentials
```

```typescript
const storage = storageClass.get();
// Strategy: R2 or S3 (distributed)
// URLs: https://cdn.example.com/file.jpg
// Features: CDN delivery, signed URLs, zero egress (R2)
```

### **Scaling Pattern**

```typescript
// Week 1: Local development
// No env vars needed - works immediately

// Month 1: Add cloud storage
// Set CLOUDFLARE_R2_BUCKET - zero code changes

// Year 1: Add CDN
// Set CLOUDFLARE_R2_CDN_URL - automatic CDN delivery
```

## 🧪 Testing

### **Test Setup**

```typescript
import { storageClass } from '@bloomneo/appkit/storage';

describe('File Storage', () => {
  afterEach(async () => {
    // IMPORTANT: Clear storage state between tests
    await storageClass.disconnectAll();
  });

  test('should upload and download files', async () => {
    const storage = storageClass.get();

    const testData = Buffer.from('Hello, World!');
    await storage.put('test.txt', testData);

    const downloaded = await storage.get('test.txt');
    expect(downloaded.toString()).toBe('Hello, World!');
  });

  test('should generate public URLs', async () => {
    const storage = storageClass.get();

    await storage.put('image.jpg', Buffer.from('fake image'));
    const url = storage.url('image.jpg');

    expect(url).toMatch(/image\.jpg$/);
  });
});
```

### **Mock Cloud Storage for Tests**

```typescript
// Force local strategy for testing
describe('Storage with Local Strategy', () => {
  beforeEach(() => {
    storageClass.reset({
      strategy: 'local',
      local: {
        dir: './test-uploads',
        baseUrl: '/test-uploads',
        maxFileSize: 1048576, // 1MB for tests
        allowedTypes: ['*'],
        createDirs: true,
      },
    });
  });

  afterEach(async () => {
    await storageClass.disconnectAll();
    // Clean up test directory
    await fs.rm('./test-uploads', { recursive: true, force: true });
  });
});
```

## 📈 Performance

- **Local Strategy**: ~1ms per operation (filesystem I/O)
- **S3 Strategy**: ~50-200ms per operation (network + AWS)
- **R2 Strategy**: ~50-200ms per operation (network + Cloudflare)
- **CDN URLs**: ~1ms generation (no network calls)
- **Memory Usage**: <5MB baseline per strategy

## 💰 Cost Comparison

| Provider          | Storage    | Egress   | CDN        | Best For                    |
| ----------------- | ---------- | -------- | ---------- | --------------------------- |
| **Local**         | Free       | Free     | None       | Development, single server  |
| **Cloudflare R2** | $0.015/GB  | **FREE** | Included   | High-bandwidth, global apps |
| **AWS S3**        | $0.023/GB  | $0.09/GB | Extra cost | Enterprise, AWS ecosystem   |
| **Wasabi**        | $0.0059/GB | FREE     | Extra cost | Archive, backup storage     |

## 🔍 TypeScript Support

Full TypeScript support with comprehensive interfaces:

```typescript
import type {
  Storage,
  StorageFile,
  PutOptions,
} from '@bloomneo/appkit/storage';

// Strongly typed storage operations
const storage: Storage = storageClass.get();

const files: StorageFile[] = await storage.list('images/');
const options: PutOptions = {
  contentType: 'image/jpeg',
  metadata: { userId: '123' },
};

await storage.put('image.jpg', buffer, options);
```

## 🆚 Why Not AWS SDK/Google Cloud directly?

**Other approaches:**

```javascript
// AWS SDK: Complex setup, provider-specific
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  region: 'us-east-1',
});

const params = {
  Bucket: 'bucket',
  Key: 'file.jpg',
  Body: buffer,
  ContentType: 'image/jpeg',
};

s3.upload(params, callback);
```

**This library:**

```typescript
// 2 lines, works with any provider
import { storageClass } from '@bloomneo/appkit/storage';
await storageClass.get().put('file.jpg', buffer);
```

**Same features, 90% less code, automatic provider detection.**

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo">Bloomneo Team</a></strong><br>
  Because file storage should be simple, not a vendor nightmare.
</p>

---

## Agent-Dev Friendliness Score

**Score: 85/100 — 🟢 Exemplary** *(Δ +8 vs 77/100 on 2026-04-13)*
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../docs/AGENT_DEV_SCORING_ALGORITHM.md) v1.1*

> No anti-pattern caps applied. Pre-v1 audit complete: `examples/storage.ts` runtime-verified, `cookbook/file-upload-pipeline.ts` typechecks clean, `storage.test.ts` now includes an explicit drift-check block that fails the build if class/instance methods diverge from the documented surface, and `llms.txt` lists the full storage API with anti-drift notes (`delete NOT del`, `exists NOT has`). `storageClass` is the named export; default export is `StorageClass` (the constructor) — README correctly warns against `new StorageClass()`.

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **10** | All 11 instance methods and 12 class methods documented correctly across README, `examples/storage.ts`, `cookbook/file-upload-pipeline.ts`, `llms.txt`, and `AGENTS.md`. `storage.test.ts` drift-check asserts each name AND asserts that hallucinated names (`has`, `save`, `fetch`, class-level `put/delete/list/url/…`) do NOT exist. |
| 2 | Doc consistency | **9** | README, `examples/storage.ts`, `cookbook/file-upload-pipeline.ts`, `llms.txt` §Module 6, and `AGENTS.md` all show `storage = storageClass.get()` then `storage.<method>(…)`. Minor: `llms.txt` shows `opts?: { contentType?: string }` while `PutOptions` also accepts `metadata`/`cacheControl`/`expires` — a trim, not a contradiction. |
| 3 | Runtime verification | **9** | `storage.test.ts` exercises `put`/`get`/`delete`/`exists`/`url`/`list` against the built module via `storageClass.get()`; `examples/storage.ts` was runtime-verified in today's audit. Drift-check tests guard the method surface itself. |
| 4 | Type safety | **7** | `Storage`, `StorageFile`, `PutOptions`, `StorageConfig` all exported and tight. One soft spot: `Storage.getConfig(): any` (in `src/storage/index.ts` line 31) — the concrete implementation returns a tighter shape; the interface loses it. |
| 5 | Discoverability | **8** | First code block is the canonical two-line import. Auto-strategy priority table + env var reference make the 80% path obvious. Still no top-of-README "See also" pointer to AGENTS.md / examples / cookbook. |
| 6 | Example completeness | **9** | `examples/storage.ts` covers `validateConfig`, `put`, `get`, `url`, `signedUrl`, `exists`, `copy`, `list`, `delete`, `upload`, `download`, `getStrategy`, `hasCloudStorage`, `isLocal`, `getStats`, `clear` — effectively the full public surface in one runnable tour. |
| 7 | Composability | **9** | `cookbook/file-upload-pipeline.ts` wires storage + auth + security + queue + event + error + logger into a real upload-then-process pipeline, the canonical multi-module recipe this domain needs. |
| 8 | Educational errors | **7** | Every thrown `Error` is prefixed `[@bloomneo/appkit/storage]`, names the offending input, and links `DOCS_URL#common-issues` or `#environment-variables`. Production misconfig still goes through `console.warn` rather than actionable throws — the one remaining gap. |
| 9 | Convention enforcement | **9** | Exactly one canonical entry (`storageClass.get()`) and one canonical upload key pattern (`folder/file.ext`, no leading slash, no `..`). Anti-pattern `new StorageClass()` is called out in the README "Common LLM Mistakes" section AND enforced by the validateKey security checks. |
| 10 | Drift prevention | **7** | `storage.test.ts` "Public API surface — drift check" block asserts both the positive surface (22 method names) and the negative surface (hallucinated names); `npm test` fails if docs/source drift. Still runs as a local test, not a dedicated CI gate comparing docs↔source. |
| 11 | Reading order | **5** | README→AGENTS→llms→source path works, but the module README still lacks a "See also" pointer at the top; consumers landing on `src/storage/README.md` have to guess that `examples/storage.ts` and `cookbook/file-upload-pipeline.ts` exist. |
| **12** | **Simplicity** | **8** | 80% case is `put` + `get` + `url`. 11 instance methods + 12 class helpers is at the upper end of "acceptable" but every method has a clear, non-overlapping job. |
| **13** | **Clarity** | **9** | `put`, `get`, `delete`, `list`, `url`, `signedUrl`, `exists`, `copy`, `disconnect` — every name reads as a sentence. No vague verbs. |
| **14** | **Unambiguity** | **8** | `url()` (public) vs `signedUrl()` (temporary) distinction is explicit; `upload` exists on `storageClass` (helper) but NOT on the instance, which is a genuine shape-vs-semantics trap — mitigated by an explicit drift-check test but not visually flagged in docs. |
| **15** | **Learning curve** | **9** | Canonical fresh-dev path: read README hero → `npm install` → two lines → working local upload. Cookbook recipe is there when they need auth+queue. No custom ecosystem idioms — Buffers, Promises, string keys. |

### Weighted (v1.1)

```
(10×.12)+(9×.08)+(9×.09)+(7×.06)+(8×.06)+(9×.08)+(9×.06)+(7×.05)+(9×.05)+(7×.04)+(5×.03)
+(8×.09)+(9×.09)+(8×.05)+(9×.05)
= 1.20+0.72+0.81+0.42+0.48+0.72+0.54+0.35+0.45+0.28+0.15+0.72+0.81+0.40+0.45
= 8.50 → 85/100
No cap applied.  Δ = +8 vs 77/100 (2026-04-13).
```

### Gaps to reach 🟢 90+

1. **D4 → 9**: Replace `Storage.getConfig(): any` with the concrete `{ strategy; connected; maxFileSize; allowedTypes }` shape.
2. **D8 → 9**: Convert production misconfig `console.warn` calls in `defaults.ts` into throws that name the missing env var.
3. **D11 → 8**: Add a top-of-README "See also: [`AGENTS.md`](../../AGENTS.md) · [`examples/storage.ts`](../../examples/storage.ts) · [`cookbook/file-upload-pipeline.ts`](../../cookbook/file-upload-pipeline.ts)" line.
4. **D10 → 9**: Promote `storage.test.ts` drift-check into a CI gate that also greps README/llms.txt/AGENTS.md for method references.
