# @bloomneo/appkit - Event Module 🚀

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple event-driven architecture that just works with automatic
> Redis/Memory strategy

**One function** returns an event system with automatic Redis detection. Zero
configuration needed, production-ready distribution by default, with built-in
wildcard patterns and event history.

## 🚀 Why Choose This?

- **⚡ One Function** - Just `eventClass.get()`, everything else is automatic
- **🔄 Auto Strategy** - REDIS_URL → Distributed, No Redis → Memory
- **🔧 Zero Configuration** - Smart defaults for everything
- **🌟 Wildcard Events** - Listen to `user.*` patterns automatically
- **📚 Event History** - Built-in replay and debugging
- **⚖️ Scales Perfectly** - Development → Production with no code changes
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

### Basic Events (Memory Strategy)

```typescript
import { eventClass } from '@bloomneo/appkit/event';

const events = eventClass.get();

// Listen to events
events.on('user.signup', (data) => {
  console.log('New user:', data.email);
});

// Emit events
await events.emit('user.signup', {
  email: 'john@example.com',
  userId: 123,
});
```

### Distributed Events (Redis Strategy)

```bash
# Just set Redis URL - everything else is automatic
REDIS_URL=redis://localhost:6379
```

```typescript
import { eventClass } from '@bloomneo/appkit/event';

const events = eventClass.get();

// Same code - now distributed across all servers!
events.on('order.completed', (data) => {
  console.log('Order completed:', data.orderId);
});

await events.emit('order.completed', {
  orderId: 'order-123',
  amount: 99.99,
});
```

**That's it!** Events automatically work across all your servers.

## 🧠 Mental Model

### **Strategy Auto-Detection**

This is the core innovation. Environment variables determine strategy:

```bash
# Development/Single Server
# (no Redis URL)
→ Memory Strategy: Fast local events

# Production/Multi-Server
REDIS_URL=redis://localhost:6379
→ Redis Strategy: Distributed events across all servers
```

### **Namespace Isolation**

```typescript
// Different parts of your app can use separate event channels
const userEvents = eventClass.get('users'); // users:*
const orderEvents = eventClass.get('orders'); // orders:*
const emailEvents = eventClass.get('emails'); // emails:*

// Events don't interfere with each other
userEvents.emit('created', data); // → users:created
orderEvents.emit('created', data); // → orders:created
```

## 📖 Complete API Reference

### Core Function

```typescript
const events = eventClass.get(namespace?); // One function, everything you need
```

### Event Methods

```typescript
// Listen to events
events.on('event.name', (data) => {
  /* handler */
});
events.once('event.name', (data) => {
  /* one-time handler */
});

// Emit events
await events.emit('event.name', { key: 'value' });
await events.emitBatch([
  { event: 'user.created', data: { userId: 1 } },
  { event: 'user.created', data: { userId: 2 } },
]);

// Remove listeners
events.off('event.name'); // Remove all listeners
events.off('event.name', handler); // Remove specific listener

// Wildcard patterns
events.on('user.*', (eventName, data) => {
  console.log(`User event: ${eventName}`, data);
});
```

### Utility Methods

```typescript
// Get event history for debugging
const history = await events.history('user.created', 10); // Last 10 events

// Get current listeners
const listeners = events.getListeners('user.*');

// Get strategy info
const strategy = events.getStrategy(); // 'redis' or 'memory'
const config = events.getConfig();

// Cleanup
await events.disconnect();
```

### Global Methods

```typescript
// System-wide operations
eventClass.getStrategy(); // Current strategy
eventClass.getActiveNamespaces(); // All active namespaces
eventClass.hasRedis(); // Check if Redis available

// Broadcast to all namespaces (use sparingly)
await eventClass.broadcast('system.shutdown');

// Cleanup for testing
await eventClass.clear();
await eventClass.reset(newConfig);
```

## 🎯 Usage Examples

### **Express API with Events**

```typescript
import express from 'express';
import { eventClass } from '@bloomneo/appkit/event';

const app = express();
const events = eventClass.get('api');

// Listen to user events
events.on('user.created', async (user) => {
  console.log('📧 Sending welcome email to:', user.email);
  await sendWelcomeEmail(user);
});

events.on('user.*', (eventName, data) => {
  console.log(`👤 User event: ${eventName}`, data);
});

// User registration endpoint
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Create user
    const user = await createUser({ email, password });

    // Emit event - triggers welcome email automatically
    await events.emit('user.created', {
      userId: user.id,
      email: user.email,
      source: 'registration',
    });

    res.json({ success: true, userId: user.id });
  } catch (error) {
    await events.emit('user.registration.failed', {
      email,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('🚀 Server started with events:', events.getStrategy());
});
```

### **Microservices Communication**

```typescript
// User Service
import { eventClass } from '@bloomneo/appkit/event';

const userEvents = eventClass.get('users');

export class UserService {
  async createUser(userData) {
    const user = await this.db.create(userData);

    // Notify other services
    await userEvents.emit('user.created', {
      userId: user.id,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt,
    });

    return user;
  }
}
```

```typescript
// Email Service (separate server/container)
import { eventClass } from '@bloomneo/appkit/event';

const emailEvents = eventClass.get('emails');
const userEvents = eventClass.get('users'); // Same namespace, distributed

// Listen to user events from User Service
userEvents.on('user.created', async (userData) => {
  await emailEvents.emit('send.welcome', {
    to: userData.email,
    userId: userData.userId,
    plan: userData.plan,
  });
});

// Process email queue
emailEvents.on('send.*', async (eventName, emailData) => {
  const emailType = eventName.split('.')[1]; // 'welcome', 'reset', etc.
  await sendEmail(emailType, emailData);
});
```

### **Background Jobs & Queues**

```typescript
import { eventClass } from '@bloomneo/appkit/event';

const jobEvents = eventClass.get('jobs');

// Job processor
class JobProcessor {
  constructor() {
    jobEvents.on('job.email.*', this.processEmailJob.bind(this));
    jobEvents.on('job.image.*', this.processImageJob.bind(this));
  }

  async processEmailJob(eventName, jobData) {
    const jobType = eventName.split('.')[2];

    try {
      await this.sendEmail(jobType, jobData);
      await jobEvents.emit('job.completed', {
        jobId: jobData.jobId,
        type: 'email',
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      await jobEvents.emit('job.failed', {
        jobId: jobData.jobId,
        error: error.message,
        retryCount: jobData.retryCount || 0,
      });
    }
  }
}

// Usage
await jobEvents.emit('job.email.welcome', {
  jobId: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'John',
});
```

## 🧪 Testing

```typescript
import { eventClass } from '@bloomneo/appkit/event';

describe('Events', () => {
  afterEach(() => eventClass.clear()); // Essential cleanup

  test('basic event flow', async () => {
    const events = eventClass.get('test');

    const received = [];
    events.on('user.created', (data) => received.push(data));

    await events.emit('user.created', { userId: 123 });

    expect(received[0].userId).toBe(123);
  });
});
```

## ⚠️ Common Mistakes

### **1. Wrong Event Names**

```typescript
// ❌ Bad patterns
events.on('userCreated', handler); // Use dots
events.on('USER_CREATED', handler); // Use lowercase
events.on('created', handler); // Too generic

// ✅ Good patterns
events.on('user.created', handler);
events.on('order.payment.failed', handler);
```

### **2. Missing Cleanup**

```typescript
// ❌ Memory leaks in tests
test('my test', () => {
  const events = eventClass.get('test');
  // Missing: await eventClass.clear();
});

// ✅ Always clean up
afterEach(() => eventClass.clear());
```

### **3. Memory Strategy in Production**

```typescript
// ❌ Single server only
// Without REDIS_URL, events don't work across servers

// ✅ Set Redis for distributed events
REDIS_URL=redis://localhost:6379
```

### **4. Ignoring Emit Failures**

```typescript
// ❌ Silent failures
await events.emit('user.created', data);

// ✅ Check results
const result = await events.emit('user.created', data);
if (!result) console.error('Event failed');
```

## 🚨 Error Handling

### **Basic Pattern**

```typescript
events.on('payment.process', async (payment) => {
  try {
    await processPayment(payment);
    await events.emit('payment.completed', payment);
  } catch (error) {
    await events.emit('payment.failed', {
      ...payment,
      error: error.message,
    });
  }
});
```

### **Redis Connection Errors**

```typescript
async function emitSafely(event, data) {
  const result = await events.emit(event, data);

  if (!result) {
    console.warn(`Event failed: ${event}`, data);
    // Store for retry or use fallback
    await storeFailedEvent(event, data);
  }

  return result;
}
```

## 🔧 Startup Validation

### **Basic Validation**

```typescript
import { eventClass } from '@bloomneo/appkit/event';

async function startApp() {
  // Validate events at startup
  eventClass.validateConfig();

  const strategy = eventClass.getStrategy();
  console.log(`🚀 Events: ${strategy} strategy`);

  app.listen(3000);
}
```

### **Production Checks**

```typescript
if (process.env.NODE_ENV === 'production' && !eventClass.hasRedis()) {
  throw new Error('Redis required in production for distributed events');
}
```

### **Health Check**

```typescript
app.get('/health/events', (req, res) => {
  const stats = eventClass.getStats();

  res.json({
    status: 'healthy',
    strategy: eventClass.getStrategy(),
    connected: stats.connected,
    redis: eventClass.hasRedis(),
  });
});
```

## 🌍 Environment Variables

### Basic Configuration

```bash
# Strategy selection (auto-detected)
REDIS_URL=redis://localhost:6379        # Enables Redis strategy
# No REDIS_URL = Memory strategy

# Service identification
VOILA_SERVICE_NAME=my-app               # Used in namespacing
VOILA_EVENT_NAMESPACE=production        # Custom namespace

# Event history
VOILA_EVENT_HISTORY_ENABLED=true       # Default: true
VOILA_EVENT_HISTORY_SIZE=100           # Default: 100
```

### Redis Configuration (Advanced)

```bash
# Redis connection
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Redis event settings
VOILA_EVENT_REDIS_RETRIES=3            # Default: 3
VOILA_EVENT_REDIS_RETRY_DELAY=1000     # Default: 1000ms
VOILA_EVENT_REDIS_CONNECT_TIMEOUT=10000 # Default: 10s
VOILA_EVENT_REDIS_COMMAND_TIMEOUT=5000  # Default: 5s
VOILA_EVENT_REDIS_PREFIX=events        # Default: events
```

### Memory Configuration (Advanced)

```bash
# Memory strategy settings
VOILA_EVENT_MEMORY_MAX_LISTENERS=1000  # Default: 1000
VOILA_EVENT_MEMORY_HISTORY=100         # Default: 100
VOILA_EVENT_MEMORY_CHECK_INTERVAL=30000 # Default: 30s
VOILA_EVENT_MEMORY_GC=true             # Default: true
```

## 🎨 Event Patterns

### **Naming Conventions**

```typescript
// ✅ Good event names
'user.created'; // entity.action
'order.payment.failed'; // entity.context.action
'email.sent'; // service.action
'notification.push.delivered'; // service.type.action

// ❌ Avoid these patterns
'userCreated'; // Use dots for hierarchy
'USER_CREATED'; // Use lowercase
'created'; // Too generic
'user-created'; // Use dots, not dashes
```

### **Wildcard Patterns**

```typescript
// Listen to patterns
events.on('user.*', handler);          // All user events
events.on('*.created', handler);       // All creation events
events.on('order.*.failed', handler);  // All order failures

// Event hierarchy examples
'user.created'           → Matches: user.*
'user.updated.profile'   → Matches: user.*, user.updated.*
'order.payment.failed'   → Matches: order.*, order.payment.*, *.failed
```

### **Data Structure Conventions**

```typescript
// ✅ Good event data structure
await events.emit('user.created', {
  // Always include entity ID
  userId: 123,

  // Include relevant entity data
  email: 'user@example.com',
  plan: 'premium',

  // Include context
  source: 'registration',
  ip: '192.168.1.1',

  // Include timing
  createdAt: new Date().toISOString(),
});
```

## 🔄 Development vs Production

### **Development Mode**

```bash
# No Redis URL = Memory strategy
NODE_ENV=development
```

```typescript
// Fast local events, detailed logging
const events = eventClass.get();
await events.emit('test.event', { data: 'value' });
// ✅ [AppKit] Event emitted: test.event { data: 'value' }
```

### **Production Mode**

```bash
# Redis URL = Distributed strategy
NODE_ENV=production
REDIS_URL=redis://production-redis:6379
```

```typescript
// Same code - now distributed across all servers
const events = eventClass.get();
await events.emit('test.event', { data: 'value' });
// Events work across all server instances automatically
```

## 🤖 LLM Guidelines

### **Essential Patterns**

```typescript
// ✅ ALWAYS use these patterns
import { eventClass } from '@bloomneo/appkit/event';
const events = eventClass.get('namespace');

// ✅ Event listening
events.on('entity.action', (data) => {
  // Handle event
});

// ✅ Event emitting
await events.emit('entity.action', {
  entityId: 123,
  timestamp: new Date().toISOString(),
});

// ✅ Wildcard patterns
events.on('user.*', (eventName, data) => {
  console.log(`User event: ${eventName}`, data);
});

// ✅ One-time listeners
events.once('app.ready', () => {
  console.log('App is ready');
});

// ✅ Cleanup
events.off('event.name');
events.off('event.name', specificHandler);
```

### **Anti-Patterns to Avoid**

```typescript
// ❌ DON'T create EventClass directly
import { EventClass } from '@bloomneo/appkit/event';
const events = new EventClass(config, namespace); // Wrong!

// ❌ DON'T forget to handle async properly
events.emit('event', data); // Missing await!

// ❌ DON'T use bad event names
events.on('userCreated', handler); // Use dots: 'user.created'
events.on('USER_CREATED', handler); // Use lowercase
events.on('created', handler); // Too generic

// ❌ DON'T forget cleanup in tests
test('my test', () => {
  // ... test code
  // Missing: await eventClass.clear();
});

// ❌ DON'T emit events without data structure
await events.emit('user.created', userId); // Should be object with userId property
```

### **Common Patterns**

```typescript
// Emit with proper data structure
await events.emit('user.created', {
  userId: user.id,
  email: user.email,
  source: 'registration',
  createdAt: new Date().toISOString(),
});

// Handle errors in event listeners
events.on('payment.process', async (payment) => {
  try {
    await processPayment(payment);
    await events.emit('payment.completed', payment);
  } catch (error) {
    await events.emit('payment.failed', {
      ...payment,
      error: error.message,
    });
  }
});

// Use namespaces for organization
const userEvents = eventClass.get('users');
const orderEvents = eventClass.get('orders');
const emailEvents = eventClass.get('emails');

// Batch operations for efficiency
await events.emitBatch([
  { event: 'user.created', data: { userId: 1 } },
  { event: 'user.created', data: { userId: 2 } },
]);
```

## 📈 Performance

- **Memory Strategy**: ~0.01ms per event (local EventEmitter)
- **Redis Strategy**: ~2-5ms per event (network + serialization)
- **Wildcard Matching**: ~0.1ms per pattern check
- **Event History**: <1MB per 1000 events
- **Memory Usage**: <10MB baseline per namespace

## 🔍 TypeScript Support

Full TypeScript support with comprehensive interfaces:

```typescript
import type {
  Event,
  EventHandler,
  WildcardHandler,
  BatchEvent,
  EventHistoryEntry,
} from '@bloomneo/appkit/event';

// Strongly typed event handling
const events: Event = eventClass.get('users');

const handler: EventHandler = (data: UserData) => {
  console.log('User created:', data.email);
};

const wildcardHandler: WildcardHandler = (eventName: string, data: any) => {
  console.log(`Event ${eventName}:`, data);
};

events.on('user.created', handler);
events.on('user.*', wildcardHandler);
```

## 📄 License

MIT © [VoilaJSX](https://github.com/bloomneo)

---

<p align="center">
  <strong>Built with ❤️ by the <a href="https://github.com/bloomneo">Bloomneo Team</a></strong><br>
  Because event-driven architecture should be simple, not rocket science.
</p>
