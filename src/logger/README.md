# @bloomneo/appkit/logging

> **Ultra-simple logging that just works** - One function, five transports, zero
> headaches

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Why Choose This?

- **⚡ One Function** - Just `loggerClass.get()`, everything else is automatic
- **🎯 Five Transports** - Console, file, database, HTTP, webhook - all
  auto-detected
- **🔧 Zero Configuration** - Smart defaults with environment variable override
- **🌍 Environment-First** - Auto-detects from `BLOOM_LOGGER_*` variables
- **🎨 Visual Error Display** - Enhanced error formatting in development
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

```typescript
import { loggerClass } from '@bloomneo/appkit/logger';

const log = loggerClass.get();
log.info('🚀 App started');
log.error('💥 Something broke', { userId: 123, error: 'timeout' });

// Component logging
const dbLog = loggerClass.get('database');
dbLog.warn('⚠️ Connection slow', { latency: '2s' });
```

**That's it!** No configuration, no setup, production-ready.

## ✨ Auto-Transport Detection

The logger **automatically detects** what you need:

| Environment Variable       | Transport Enabled  | What You Get            |
| -------------------------- | ------------------ | ----------------------- |
| _Nothing_                  | Console + File     | Development logging     |
| `DATABASE_URL`             | + Database         | Centralized storage     |
| `BLOOM_LOGGER_HTTP_URL`    | + External service | Professional monitoring |
| `BLOOM_LOGGER_WEBHOOK_URL` | + Slack alerts     | Real-time notifications |

**Set environment variables, get enterprise features. No code changes.**

## 🤖 LLM Quick Reference - Copy These Patterns

### **Basic Setup (Copy Exactly)**

```typescript
// ✅ CORRECT - Basic pattern
import { loggerClass } from '@bloomneo/appkit/logger';

const log = loggerClass.get();
const apiLog = loggerClass.get('api');
const dbLog = loggerClass.get('database');

log.info('User registered', { userId: 123, email: 'user@example.com' });
log.error('Database error', { table: 'users', operation: 'INSERT' });
```

### **Framework Patterns (Copy These)**

```typescript
// ✅ EXPRESS - Request logging
app.use((req, res, next) => {
  req.log = loggerClass.get('api').child({ requestId: crypto.randomUUID() });
  req.log.info('Request started');
  next();
});

// ✅ FASTIFY - Hook pattern
fastify.addHook('onRequest', async (request) => {
  request.log = loggerClass
    .get('api')
    .child({ requestId: crypto.randomUUID() });
  request.log.info('Request started');
});

// ✅ NEXT.JS - API routes
export default function handler(req, res) {
  const log = loggerClass.get('api').child({ requestId: crypto.randomUUID() });
  log.info('API request started');
  // Handle request...
}
```

### **Context Logging (Copy These)**

```typescript
// ✅ CORRECT - Child loggers with context
const userLog = log.child({ userId: 123, sessionId: 'abc-123' });
const requestLog = log.child({ requestId: 'req-456', traceId: 'trace-789' });
const jobLog = loggerClass.get('worker').child({ jobId: job.id, attempt: 1 });
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Wrong Usage**

```typescript
// ❌ WRONG - Don't use console.log
console.log('User registered:', user);

// ✅ CORRECT - Use structured logging
log.info('User registered', { userId: user.id, email: user.email });
```

### **Missing Context**

```typescript
// ❌ WRONG - Generic logging
log.info('Operation completed');

// ✅ CORRECT - Rich context
log.info('User registration completed', {
  userId: user.id,
  email: user.email,
  duration: Date.now() - startTime,
});
```

### **Wrong Log Levels**

```typescript
// ❌ WRONG - Wrong levels
log.error('User not found'); // Should be warn
log.debug('Payment failed'); // Should be error

// ✅ CORRECT - Appropriate levels
log.warn('User not found', { userId: id });
log.error('Payment failed', { orderId, error });
log.info('User logged in', { userId });
log.debug('Cache hit', { key, value });
```

### **Sensitive Data**

```typescript
// ❌ WRONG - Logging sensitive data
log.info('User login', { password: user.password });

// ✅ CORRECT - Safe logging
log.info('User login', {
  userId: user.id,
  loginMethod: 'password',
  cardLast4: user.creditCard?.slice(-4),
});
```

## 🚨 Error Handling Patterns

### **Startup Validation**

```typescript
try {
  const log = loggerClass.get();
  log.info('✅ Logging initialized', {
    transports: loggerClass.getActiveTransports(),
  });
} catch (error) {
  console.error('❌ Logging setup failed:', error.message);
  process.exit(1);
}
```

### **Global Error Handler**

```typescript
process.on('uncaughtException', (error) => {
  loggerClass.get('error').error('🚨 Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
```

### **Service Error Pattern**

```typescript
async function createUser(userData) {
  const log = loggerClass.get('user-service');

  try {
    log.debug('Creating user', { email: userData.email });
    const user = await saveUser(userData);
    log.info('User created', { userId: user.id });
    return user;
  } catch (error) {
    log.error('User creation failed', { error: error.message });
    throw error;
  }
}
```

## 🌍 Environment Variables

### **Basic Configuration**

```bash
# Auto-detected log level
BLOOM_LOGGER_LEVEL=debug|info|warn|error  # Default: auto-detected
BLOOM_LOGGER_SCOPE=minimal|full           # Default: minimal

# Service identification
BLOOM_SERVICE_NAME=my-app                  # Default: package.json name
```

### **Transport Control**

```bash
# Database (auto-enabled if DATABASE_URL exists)
DATABASE_URL=postgres://user:pass@localhost/app

# HTTP (Datadog, Elasticsearch, etc.)
BLOOM_LOGGER_HTTP_URL=https://logs.datadog.com/api/v1/logs

# Webhook (Slack alerts)
BLOOM_LOGGER_WEBHOOK_URL=https://hooks.slack.com/services/xxx
BLOOM_LOGGER_WEBHOOK_LEVEL=error         # Default: error only
```

## 🚀 Production Deployment

### **Environment Setup**

```bash
# ✅ Production settings
NODE_ENV=production
BLOOM_LOGGER_SCOPE=minimal
BLOOM_LOGGER_LEVEL=warn

# ✅ Required transports
DATABASE_URL=postgres://prod-user:pass@prod-db/app
BLOOM_LOGGER_HTTP_URL=https://logs.datadog.com/api/v1/logs
BLOOM_LOGGER_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

### **Security Validation**

```typescript
// ✅ Startup validation
const log = loggerClass.get();
const config = loggerClass.getConfig();

console.log('✅ Logging validation passed');
console.log(`Transports: ${loggerClass.getActiveTransports().join(', ')}`);

if (config.environment === 'production' && config.scope !== 'minimal') {
  console.warn('⚠️ Production should use minimal scope');
}
```

## 📖 Complete API Reference

### **Core Function**

```typescript
const log = loggerClass.get(); // Main logger
const log = loggerClass.get('component'); // Component logger
```

### **Log Methods**

```typescript
log.info(message, meta?);    // Normal events
log.warn(message, meta?);    // Potential issues
log.error(message, meta?);   // Errors (triggers alerts)
log.debug(message, meta?);   // Development info
```

### **Context Methods**

```typescript
log.child(bindings); // Add context
log.flush(); // Ensure written
log.close(); // Close transports
```

### **Utility Methods**

```typescript
loggerClass.getActiveTransports(); // ['console', 'file', 'database']
loggerClass.gethasTransport('database'); // true/false
loggerClass.getConfig(); // Debug configuration
loggerClass.getclear(); // Clear state (testing)
```

## 💡 Simple Examples

### **API Logging**

```typescript
app.post('/users', async (req, res) => {
  const log = loggerClass.get('api').child({ requestId: crypto.randomUUID() });

  try {
    log.info('Creating user', { email: req.body.email });
    const user = await createUser(req.body);
    log.info('User created', { userId: user.id });
    res.json({ user });
  } catch (error) {
    log.error('User creation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create user' });
  }
});
```

### **Background Job**

```typescript
async function processJob(job) {
  const log = loggerClass.get('worker').child({ jobId: job.id });

  log.info('Job started');

  try {
    await processData(job.data);
    log.info('Job completed');
  } catch (error) {
    log.error('Job failed', { error: error.message });
    throw error;
  }
}
```

### **Database Service**

```typescript
class DatabaseService {
  constructor() {
    this.log = loggerClass.get('database');
  }

  async connect() {
    this.log.info('Connecting to database');

    try {
      this.db = await createConnection();
      this.log.info('Database connected');
    } catch (error) {
      this.log.error('Connection failed', { error: error.message });
      throw error;
    }
  }
}
```

## 🔧 External Services

### **Datadog**

```bash
BLOOM_LOGGER_HTTP_URL=https://http-intake.logs.datadoghq.com/api/v1/input/YOUR_API_KEY
```

### **Slack Alerts**

```bash
BLOOM_LOGGER_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

## 📊 Output Examples

### **Development Console**

```
10:30:45 🚀 Server ready [api]
10:30:46 ❌ ERROR Payment failed [payment]
  Card declined
```

### **Production File (JSON)**

```json
{"timestamp":"2024-01-15T10:30:45.123Z","level":"info","message":"Server ready","component":"api"}
{"timestamp":"2024-01-15T10:30:46.456Z","level":"error","message":"Payment failed","component":"payment"}
```

## 🧪 Testing

```typescript
import { loggerClass } from '@bloomneo/appkit/logger';

describe('Payment Service', () => {
  afterEach(async () => {
    await loggerClass.getclear(); // Clear state between tests
  });

  test('should log payment success', async () => {
    const log = loggerClass.get('test');
    log.info('Test started');

    const result = await processPayment('order-123', 99.99);
    expect(result.success).toBe(true);
  });
});
```

## 📈 Performance

- **Startup**: < 10ms initialization
- **Memory**: < 5MB baseline usage
- **Throughput**: 10,000+ logs/second
- **File I/O**: Batched writes, no blocking
- **Network**: Smart batching for external services

## 🔍 TypeScript Support

```typescript
import type { LoggingConfig, LogMeta, Logger } from '@bloomneo/appkit/logging';

const log: Logger = loggerClass.get();
const meta: LogMeta = { userId: 123, action: 'login' };
```

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo/appkit">Bloomneo Team</a></strong><br>
  Because logging should be simple, not a PhD thesis.
</p>
