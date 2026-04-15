# @bloomneo/appkit - Queue Module 🚀

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple job queuing that just works with automatic transport detection

**One function** returns a queue with all methods. Zero configuration needed,
production-ready by default, with built-in retry logic and distributed
processing.

> **See also:** [AGENTS.md](../../AGENTS.md) (agent rules) · [llms.txt](../../llms.txt) (full API reference) · [examples/queue.ts](../../examples/queue.ts) · cookbook: [file-upload-pipeline.ts](../../cookbook/file-upload-pipeline.ts)

## 🚀 Why Choose This?

- **⚡ One Function** - Just `queueClass.get()`, everything else is automatic
- **🔄 Auto-Transport Detection** - Memory → Redis → Database based on
  environment
- **🔧 Zero Configuration** - Smart defaults for everything
- **🔁 Built-in Retry Logic** - Exponential backoff with jitter
- **📊 Production Monitoring** - Stats, health checks, job tracking
- **🛡️ Graceful Shutdown** - Waits for jobs to complete
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

```bash
# Optional: Set environment variables for production
echo "REDIS_URL=redis://localhost:6379" > .env
# OR
echo "DATABASE_URL=postgres://user:pass@localhost/db" > .env
```

```typescript
import { queueClass } from '@bloomneo/appkit/queue';

const queue = queueClass.get();

// Add jobs
const jobId = await queue.add('email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up',
});

// Process jobs
queue.process('email', async (data) => {
  console.log(`Sending email to ${data.to}`);
  await sendEmail(data);
  return { sent: true };
});

// Schedule delayed jobs
await queue.schedule('reminder', { userId: 123 }, 24 * 60 * 60 * 1000); // 24 hours
```

**That's it!** No configuration, no setup, production-ready.

## ✨ What You Get Instantly

- **✅ Memory Queue** - Development (no dependencies)
- **✅ Redis Queue** - Production distributed (auto-detected from `REDIS_URL`)
- **✅ Database Queue** - Persistent storage (auto-detected from `DATABASE_URL`)
- **✅ Automatic Retry** - 3 attempts with exponential backoff
- **✅ Job Scheduling** - Delayed execution with persistence
- **✅ Priority Queues** - High priority jobs processed first
- **✅ Stats & Monitoring** - Real-time queue metrics
- **✅ Graceful Shutdown** - Waits for active jobs

## 🔄 Auto-Transport Detection

The queue **automatically detects** what you need:

| Environment Variable | Transport Used | What You Get              |
| -------------------- | -------------- | ------------------------- |
| _Nothing_            | Memory         | Development queuing       |
| `REDIS_URL`          | Redis          | Distributed production    |
| `DATABASE_URL`       | Database       | Persistent simple storage |

**Set environment variables, get enterprise features. No code changes.**

## 🏢 Production Ready

```bash
# Minimal setup for production
REDIS_URL=redis://localhost:6379
BLOOM_QUEUE_CONCURRENCY=10
BLOOM_QUEUE_WORKER=true
```

```typescript
// Same code, production features
const queue = queueClass.get();
await queue.add('webhook', { url: 'https://api.example.com', data: payload });
// → Redis distributed queue
// → 10 concurrent workers
// → Automatic retry with backoff
// → Stats and monitoring
```

## 📋 Complete API (It's Tiny)

### Core Methods

```typescript
import { queueClass } from '@bloomneo/appkit/queue';

const queue = queueClass.get();

// Job management
await queue.add(jobType, data, options?);        // Add job
await queue.schedule(jobType, data, delay);      // Schedule delayed job
queue.process(jobType, handler);                 // Process jobs

// Queue control
await queue.pause(jobType?);                     // Pause processing
await queue.resume(jobType?);                    // Resume processing

// Monitoring
await queue.getStats(jobType?);                  // Get statistics
await queue.getJobs(status, jobType?);          // Get jobs by status
await queue.retry(jobId);                        // Retry failed job
await queue.remove(jobId);                       // Remove job
await queue.clean(status, grace?);               // Clean old jobs
```

### Utility Methods

```typescript
queueClass.getActiveTransport(); // See which transport is running
queueClass.hasTransport('redis'); // Check specific transport
queueClass.getConfig(); // Debug configuration
queueClass.getHealth(); // Health status
await queueClass.clear(); // Clear all (testing)
queueClass.reset(overrides?); // Reset with new config (testing)
```

> Use `await queue.close()` on the instance for graceful shutdown; `close()` is an instance method, not a class method.


## 🌍 Environment Variables

### Basic Setup

```bash
# Transport selection (auto-detected: REDIS_URL → redis, DATABASE_URL → database, else → memory)
REDIS_URL=redis://localhost:6379              # Enables Redis transport
DATABASE_URL=postgres://user:pass@host/db     # Enables Database transport
BLOOM_QUEUE_TRANSPORT=memory                  # Manual override: memory|redis|database

# Worker configuration
BLOOM_QUEUE_WORKER=true                       # Enable job processing
BLOOM_QUEUE_CONCURRENCY=10                    # Jobs processed simultaneously (1-100)

# Service identification (used in log context)
BLOOM_SERVICE_NAME=my-app                     # Default: package.json name
BLOOM_SERVICE_VERSION=1.0.0                   # Default: package.json version
```

### Advanced Configuration

```bash
# Job retry settings
BLOOM_QUEUE_MAX_ATTEMPTS=5                    # Max retry attempts (default: 3)
BLOOM_QUEUE_RETRY_DELAY=10000                 # Base retry delay in ms (default: 5000)
BLOOM_QUEUE_RETRY_BACKOFF=exponential         # fixed|exponential (default: exponential)

# Job cleanup
BLOOM_QUEUE_REMOVE_COMPLETE=100               # Keep last 100 completed jobs
BLOOM_QUEUE_REMOVE_FAILED=500                 # Keep last 500 failed jobs

# Performance tuning
BLOOM_QUEUE_DEFAULT_PRIORITY=0                # Default job priority
BLOOM_QUEUE_SHUTDOWN_TIMEOUT=30000            # Graceful shutdown timeout (5000-120000ms)

# Stalled job detection
BLOOM_QUEUE_STALLED_INTERVAL=30000            # Stalled job check interval (default: 30000)
BLOOM_QUEUE_MAX_STALLED=1                     # Max times a job can stall before failing (default: 1)
```

### Transport-Specific Settings

```bash
# Memory Transport (Development)
BLOOM_QUEUE_MEMORY_MAX_JOBS=1000              # Max jobs in memory
BLOOM_QUEUE_MEMORY_CLEANUP=30000              # Cleanup interval

# Redis Transport (Production)
BLOOM_QUEUE_REDIS_PREFIX=myapp                # Redis key prefix (default: queue)
BLOOM_QUEUE_REDIS_RETRIES=3                   # Connection retries (default: 3)
BLOOM_QUEUE_REDIS_FAILOVER_DELAY=100          # Retry delay on failover in ms (default: 100)

# Database Transport (Simple Persistent)
BLOOM_QUEUE_DB_TABLE=queue_jobs               # Table name
BLOOM_QUEUE_DB_POLL=5000                      # Polling interval
BLOOM_QUEUE_DB_BATCH=50                       # Batch size
```

## 💡 Real Examples

### Express API with Background Jobs

```typescript
import express from 'express';
import { queueClass } from '@bloomneo/appkit/queue';

const app = express();
const queue = queueClass.get();

// Setup job processors
queue.process('email', async (data) => {
  await sendEmail(data.to, data.subject, data.body);
  return { delivered: true };
});

queue.process('webhook', async (data) => {
  const response = await fetch(data.url, {
    method: 'POST',
    body: JSON.stringify(data.payload),
  });
  return { status: response.status };
});

queue.process('image-resize', async (data) => {
  const resized = await resizeImage(data.imageUrl, data.width, data.height);
  return { resizedUrl: resized };
});

// API endpoints that queue jobs
app.post('/register', async (req, res) => {
  const { email, name } = req.body;

  // Create user account
  const user = await db.user.create({ data: { email, name } });

  // Queue welcome email
  await queue.add('email', {
    to: email,
    subject: 'Welcome to our platform!',
    body: `Hi ${name}, welcome aboard!`,
    template: 'welcome',
  });

  // Queue webhook notification
  await queue.add('webhook', {
    url: 'https://analytics.example.com/events',
    payload: { event: 'user_registered', userId: user.id },
  });

  res.json({ success: true, userId: user.id });
});

app.post('/upload-avatar', async (req, res) => {
  const { userId, imageUrl } = req.body;

  // Queue image processing
  const jobId = await queue.add(
    'image-resize',
    {
      imageUrl,
      userId,
      width: 200,
      height: 200,
      format: 'webp',
    },
    {
      priority: 5, // High priority
    }
  );

  res.json({ success: true, jobId });
});

app.listen(3000, () => {
  console.log('🚀 Server ready with background jobs');
});
```

### Fastify with Job Scheduling

```typescript
import Fastify from 'fastify';
import { queueClass } from '@bloomneo/appkit/queue';

const fastify = Fastify();
const queue = queueClass.get();

// Setup scheduled job processors
queue.process('reminder', async (data) => {
  const user = await db.user.findUnique({ where: { id: data.userId } });

  await sendEmail(user.email, 'Reminder', data.message);
  return { reminded: true };
});

queue.process('subscription-renewal', async (data) => {
  const subscription = await processRenewal(data.subscriptionId);
  return { renewed: subscription.renewed };
});

// Schedule future jobs
fastify.post('/schedule-reminder', async (request, reply) => {
  const { userId, message, delayMinutes } = request.body;

  const delay = delayMinutes * 60 * 1000; // Convert to ms

  const jobId = await queue.schedule(
    'reminder',
    {
      userId,
      message,
    },
    delay
  );

  return { success: true, jobId, scheduledFor: new Date(Date.now() + delay) };
});

// Recurring subscription processing
fastify.post('/setup-subscription', async (request, reply) => {
  const { userId, plan } = request.body;

  const subscription = await db.subscription.create({
    data: {
      userId,
      plan,
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Schedule renewal in 30 days
  await queue.schedule(
    'subscription-renewal',
    {
      subscriptionId: subscription.id,
    },
    30 * 24 * 60 * 60 * 1000
  );

  return { success: true, subscription };
});

fastify.listen({ port: 3000 });
```

### Background Worker Process

```typescript
// worker.ts - Separate worker process
import { queueClass } from '@bloomneo/appkit/queue';

const queue = queueClass.get();

// Heavy processing jobs
queue.process('data-export', async (data) => {
  const { userId, format } = data;

  console.log(`Starting data export for user ${userId}`);

  // Simulate heavy work
  const userData = await fetchAllUserData(userId);
  const exportFile = await generateExport(userData, format);
  const downloadUrl = await uploadToS3(exportFile);

  // Notify user
  await queue.add('email', {
    to: userData.email,
    subject: 'Your data export is ready',
    body: `Download your data: ${downloadUrl}`,
  });

  return { downloadUrl, size: exportFile.size };
});

queue.process('video-transcode', async (data) => {
  const { videoId, quality } = data;

  console.log(`Transcoding video ${videoId} to ${quality}`);

  const video = await db.video.findUnique({ where: { id: videoId } });
  const transcodedUrl = await transcodeVideo(video.url, quality);

  await db.video.update({
    where: { id: videoId },
    data: { [`${quality}Url`]: transcodedUrl },
  });

  return { transcodedUrl, quality };
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Worker shutting down gracefully...');
  await queue.close();
  process.exit(0);
});

console.log('🔧 Background worker started');
```

### Job Monitoring Dashboard

```typescript
import express from 'express';
import { queueClass } from '@bloomneo/appkit/queue';

const app = express();
const queue = queueClass.get();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = queueClass.getHealth();
  const stats = await queue.getStats();

  res.json({
    status: health.status,
    transport: queueClass.getActiveTransport(),
    stats,
    timestamp: new Date().toISOString(),
  });
});

// Queue statistics
app.get('/api/queue/stats', async (req, res) => {
  const { jobType } = req.query;
  const stats = await queue.getStats(jobType as string);

  res.json(stats);
});

// Get jobs by status
app.get('/api/queue/jobs', async (req, res) => {
  const { status, jobType } = req.query;

  const jobs = await queue.getJobs(
    status as any,
    jobType as string
  );

  res.json(jobs);
});

// Retry failed job
app.post('/api/queue/retry/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    await queue.retry(jobId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove job
app.delete('/api/queue/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    await queue.remove(jobId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Clean old jobs
app.post('/api/queue/clean', async (req, res) => {
  const { status, grace = 86400000 } = req.body; // Default 24 hours

  try {
    await queue.clean(status, grace);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(4000, () => {
  console.log('📊 Queue monitoring dashboard on port 4000');
});
```

### Advanced Job Options

```typescript
import { queueClass } from '@bloomneo/appkit/queue';

const queue = queueClass.get();

// High priority job
await queue.add(
  'critical-alert',
  {
    message: 'System overload detected',
    severity: 'critical',
  },
  {
    priority: 10, // Higher number = higher priority
    attempts: 5, // Custom retry attempts
    backoff: 'exponential',
  }
);

// Low priority batch job
await queue.add(
  'analytics-batch',
  {
    date: '2024-01-15',
    type: 'daily-report',
  },
  {
    priority: -5, // Lower priority
    attempts: 1, // Don't retry batch jobs
    removeOnComplete: 10, // Keep only 10 completed
    removeOnFail: 50, // Keep 50 failed for debugging
  }
);

// Job with custom retry strategy
await queue.add(
  'api-sync',
  {
    endpoint: 'https://api.partner.com/sync',
    data: payload,
  },
  {
    attempts: 3,
    backoff: 'fixed', // Fixed delay between retries
  }
);

// Scheduled job with priority
const reminderDate = new Date('2024-12-25T09:00:00Z');
const delay = reminderDate.getTime() - Date.now();

await queue.schedule(
  'holiday-reminder',
  {
    type: 'holiday',
    message: 'Merry Christmas!',
  },
  delay
);
```

## 🔧 Database Setup (for Database Transport)

If using the database transport, add this to your Prisma schema:

```prisma
model QueueJob {
  id          String    @id @default(cuid())
  queue       String    // Job type
  type        String    // Job type (compatibility)
  payload     Json      // Job data
  result      Json?     // Job result
  error       Json?     // Error details

  status      String    @default("pending") // pending, processing, completed, failed
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  priority    Int       @default(0)

  runAt       DateTime  @default(now())
  processedAt DateTime?
  completedAt DateTime?
  failedAt    DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([queue, status, priority, runAt])
  @@index([status, runAt])
  @@map("queue_jobs")
}
```

Then run your migration:

```bash
npx prisma migrate dev --name add_queue_jobs
```

## 🧪 Testing

```typescript
import { queueClass } from '@bloomneo/appkit/queue';

describe('Queue Tests', () => {
  afterEach(async () => {
    // IMPORTANT: Clear queue state between tests
    await queueClass.clear();
  });

  test('should process jobs', async () => {
    const queue = queueClass.get();
    const results: any[] = [];

    // Setup processor
    queue.process('test-job', async (data) => {
      results.push(data);
      return { processed: true };
    });

    // Add job
    const jobId = await queue.add('test-job', { message: 'hello' });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toHaveLength(1);
    expect(results[0].message).toBe('hello');
  });

  test('should retry failed jobs', async () => {
    const queue = queueClass.get();
    let attempts = 0;

    queue.process('failing-job', async (data) => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Simulated failure');
      }
      return { success: true };
    });

    await queue.add('failing-job', { test: true }, { attempts: 3 });

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(attempts).toBe(3);
  });
});
```

## 🚀 Performance

- **Memory Transport**: 10,000+ jobs/second
- **Redis Transport**: 1,000+ jobs/second (network dependent)
- **Database Transport**: 100+ jobs/second (database dependent)
- **Startup Time**: < 100ms for any transport
- **Memory Usage**: < 10MB baseline

## 📈 Scaling

### Development → Production

```typescript
// Same code works everywhere
const queue = queueClass.get();
await queue.add('process-payment', { orderId: 123, amount: 99.99 });

// Development: Memory queue (no setup)
// Production: Redis queue (distributed workers)
```

### Transport Comparison

| Transport    | Best For             | Persistence | Distribution | Setup        |
| ------------ | -------------------- | ----------- | ------------ | ------------ |
| **Memory**   | Development, Testing | ❌          | ❌           | None         |
| **Redis**    | Production, Scale    | ✅          | ✅           | Redis server |
| **Database** | Simple Persistent    | ✅          | ⚠️           | Existing DB  |

### Deployment Patterns

```bash
# Single server with database queue
DATABASE_URL=postgres://...
BLOOM_QUEUE_WORKER=true

# Distributed with Redis
REDIS_URL=redis://...
BLOOM_QUEUE_WORKER=true
BLOOM_QUEUE_CONCURRENCY=20

# Separate worker processes
REDIS_URL=redis://...
BLOOM_QUEUE_WORKER=true    # Only in worker processes
```

## 🎯 When to Use What

### Transport Selection

- **Memory**: Development, testing, single-process apps
- **Redis**: Production, multiple workers, high throughput
- **Database**: Simple persistence, existing DB infrastructure

### Job Types

- **email**: User notifications, transactional emails
- **webhook**: API integrations, third-party notifications
- **image-resize**: Media processing, thumbnail generation
- **data-export**: Large data processing, reports
- **reminder**: Scheduled notifications, follow-ups
- **cleanup**: Maintenance tasks, data archival

## 🤖 LLM Guidelines

### **Essential Patterns**

```typescript
// ✅ ALWAYS use these patterns
import { queueClass } from '@bloomneo/appkit/queue';
const queue = queueClass.get();

// ✅ Add jobs with proper data
await queue.add('email', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Thanks for signing up',
});

// ✅ Process jobs with async handlers
queue.process('email', async (data) => {
  await sendEmail(data.to, data.subject, data.body);
  return { sent: true };
});

// ✅ Handle job failures gracefully
queue.process('risky-job', async (data) => {
  try {
    return await riskyOperation(data);
  } catch (error) {
    console.error('Job failed:', error);
    throw error; // Let queue handle retry
  }
});

// ✅ Use scheduling for delayed jobs
await queue.schedule('reminder', data, 24 * 60 * 60 * 1000);
```

### **Anti-Patterns to Avoid**

```typescript
// ❌ DON'T call queueClass.get() repeatedly
const queue1 = queueClass.get();
const queue2 = queueClass.get(); // Unnecessary - same instance

// ❌ DON'T forget to handle job failures
queue.process('job', async (data) => {
  riskyOperation(data); // Missing await and error handling
});

// ❌ DON'T add large objects as job data
await queue.add('job', {
  hugeArray: new Array(1000000).fill(0), // Too large for serialization
});

// ❌ DON'T block in job handlers
queue.process('job', async (data) => {
  while (true) {
    /* infinite loop */
  } // Blocks worker
});

// ❌ DON'T forget cleanup in tests
test('my test', () => {
  // ... test code
  // Missing: await queueClass.clear();
});
```

### **Common Patterns**

```typescript
// User registration flow
await queue.add('email', {
  to: user.email,
  template: 'welcome',
  data: { name: user.name },
});

// File processing
await queue.add(
  'image-resize',
  {
    imageUrl: upload.url,
    userId: user.id,
    sizes: [100, 200, 400],
  },
  { priority: 5 }
);

// Webhook notifications
await queue.add('webhook', {
  url: 'https://api.partner.com/notify',
  payload: { event: 'order_created', orderId },
});

// Scheduled reminders
const reminderDelay = 7 * 24 * 60 * 60 * 1000; // 7 days
await queue.schedule(
  'reminder',
  {
    userId,
    type: 'trial_ending',
    message: 'Your trial ends soon!',
  },
  reminderDelay
);

// Monitoring and stats
const stats = await queue.getStats();
const health = queueClass.getHealth();
const failedJobs = await queue.getJobs('failed');
```

## 🆚 Why Not Bull/Agenda?

**Other libraries:**

```javascript
// Bull: Complex setup with multiple dependencies
const Queue = require('bull');
const emailQueue = new Queue('email processing', {
  redis: { port: 6379, host: '127.0.0.1' },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    delay: 5000,
  },
  settings: {
    retryProcessDelay: 5000,
  },
});

// Agenda: MongoDB dependency and complex scheduling
const Agenda = require('agenda');
const agenda = new Agenda({
  db: { address: 'mongodb://127.0.0.1/agenda' },
  processEvery: '20 seconds',
  maxConcurrency: 20,
});
```

**This library:**

```typescript
// 2 lines, production ready with 3 transports
import { queueClass } from '@bloomneo/appkit/queue';
const queue = queueClass.get();
```

**Same features, 90% less code, zero configuration.**

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo">Bloomneo Team</a></strong><br>
  Because job queuing should be simple, not a PhD thesis.
</p>

---

## Agent-Dev Friendliness Score

**Score: 85/100 — 🟢 Exemplary**
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../docs/AGENT_DEV_SCORING_ALGORITHM.md) v1.1*

> No anti-pattern caps applied. Delta vs previous (2026-04-13): **+10** (75 → 85). Post-audit: `examples/queue.ts` runtime-verified today, `cookbook/*.ts` typecheck clean, `llms.txt` + root `README.md` aligned with source, `dist/` rebuilt 2026-04-14. Biggest lifts: D1 (8→10, full method audit vs source passed), D6 (7→9, example runtime-verified), D7 (7→9, `file-upload-pipeline.ts` composes 7 modules), D2 (8→9, llms.txt aligned), D8 (6→8, all throws prefix `[@bloomneo/appkit/queue]` + DOCS_URL anchor).

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **10** | All 11 instance methods (`add`, `process`, `schedule`, `pause`, `resume`, `getStats`, `getJobs`, `retry`, `remove`, `clean`, `close`) + 5 class utilities (`getActiveTransport`, `hasTransport`, `getConfig`, `getHealth`, `clear`, `reset`) verified against `src/queue/{index,queue}.ts`. Zero hallucinations across README, llms.txt, `examples/queue.ts`, `cookbook/file-upload-pipeline.ts`. |
| 2 | Doc consistency | **9** | README, llms.txt (§Module 7), example, and cookbook all use identical `queueClass.get()` → `queue.add/process/schedule` pattern. `attempts`/`priority`/`backoff`/`removeOnComplete` shapes identical everywhere. |
| 3 | Runtime verification | **8** | `queue.test.ts` present; `examples/queue.ts` executed green on 2026-04-14. Not every public method has a paired negative test, but happy-path coverage is complete. |
| 4 | Type safety | **8** | `JobOptions`, `JobStatus`, `Queue`, `JobHandler<T>`, `JobInfo`, `QueueStats` are precise; generic `T` propagates through `add`/`process`/`schedule`. `JobData` intentionally `{[k]: any}` for arbitrary payloads (domain-appropriate). |
| 5 | Discoverability | **7** | First code block is canonical import. No explicit "See also: AGENTS.md \| examples/queue.ts" pointer at top of module README. |
| 6 | Example completeness | **9** | `examples/queue.ts` (runtime-verified 2026-04-14) exercises `add`, `process`, `schedule`, `pause`, `resume`, `getStats`, `getJobs`, `clean`, `getActiveTransport`, `getConfig`, `getHealth`, `clear`. Only `retry` + `remove` are commented (by id). |
| 7 | Composability | **9** | `cookbook/file-upload-pipeline.ts` composes `auth + security + storage + queue + event + error + logger` — typecheck clean today. |
| 8 | Educational errors | **8** | Every `throw` prefixes `[@bloomneo/appkit/queue]`, names the missing thing, and appends `See: ${DOCS_URL}#<anchor>`. Transport init fallback logs scoped warnings rather than throwing. |
| 9 | Convention enforcement | **9** | Exactly one canonical way: `queueClass.get()` → `queue.<method>`. No alternative factory. |
| 10 | Drift prevention | **5** | Only `scripts/smoke.mjs`; no automated doc-vs-source drift CI gate. |
| 11 | Reading order | **5** | Module README lacks top-of-file pointer to AGENTS.md / examples/queue.ts. Root README + llms.txt do cross-link. |
| **12** | **Simplicity** | **9** | 11 instance methods; 2-method minimum viable use (`add` + `process`). Single options object, all fields optional. |
| **13** | **Clarity** | **9** | `add`, `process`, `schedule`, `pause`, `resume`, `retry`, `remove`, `clean`, `getStats`, `getJobs`, `close` — every name reads as what it does. |
| **14** | **Unambiguity** | **8** | `schedule(type, data, delay)` vs `add(type, data, {delay})` both work; schedule is the canonical delayed path per examples. `JobStatus` union eliminates string ambiguity on `getJobs`/`clean`. |
| **15** | **Learning curve** | **9** | Three lines to a working queue; transport auto-detects; errors guide setup. |

### Weighted (v1.1)

```
(10×.12)+(9×.08)+(8×.09)+(8×.06)+(7×.06)+(9×.08)+(9×.06)+(8×.05)+(9×.05)+(5×.04)+(5×.03)
+(9×.09)+(9×.09)+(8×.05)+(9×.05)
= 1.20+0.72+0.72+0.48+0.42+0.72+0.54+0.40+0.45+0.20+0.15+0.81+0.81+0.40+0.45
= 8.47 → 85/100
No cap applied.
```

### Gaps to reach 🟢 90+

1. **D10 → 9** (+0.16): Add CI script that greps doc files for method names not in `src/queue/index.ts` exports.
2. **D11 → 9** (+0.12): Add a "See also: [AGENTS.md](../../AGENTS.md) · [examples/queue.ts](../../examples/queue.ts) · [cookbook/file-upload-pipeline.ts](../../cookbook/file-upload-pipeline.ts)" block near the top of this README.
3. **D5 → 9** (+0.12): Mirror the same pointer block in the module README hero.
4. **D3 → 10** (+0.18): Add negative tests for each public method (validation failures, retry-on-throw, close-while-active).
