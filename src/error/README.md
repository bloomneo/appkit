# @bloomneo/appkit - Error Module ⚠️

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple semantic error handling with HTTP status codes, Express
> middleware, and environment-aware smart defaults.

**One function** returns an error object with semantic methods. Built-in
middleware handles everything automatically. Works with any Express-compatible
framework.

## 🚀 Why Choose This?

- **⚡ One Function** - Just `error.get()`, everything else is automatic
- **🎯 Semantic HTTP Codes** - `badRequest(400)`, `unauthorized(401)`,
  `notFound(404)`
- **🔧 Zero Configuration** - Smart defaults for development vs production
- **🌍 Environment-First** - Auto-detects dev/prod behavior
- **🛡️ Production-Safe** - Hides stack traces and sensitive info in production
- **🔄 Framework Agnostic** - Express, Fastify, Koa, any Node.js framework
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

```typescript
import express from 'express';
import { errorClass } from '@bloomneo/appkit/error';

const app = express();
const error = errorClass.get();

// Setup (must be last middleware)
app.use(error.handleErrors());

// Create semantic errors
app.post(
  '/users',
  error.asyncRoute(async (req, res) => {
    if (!req.body.email) throw error.badRequest('Email required');
    if (!req.body.password) throw error.badRequest('Password required');

    const existingUser = await findUser(req.body.email);
    if (existingUser) throw error.conflict('Email already exists');

    const user = await createUser(req.body);
    res.json({ user });
  })
);
```

**That's it!** Semantic errors with automatic middleware handling.

## 🤖 LLM Quick Reference - Copy These Patterns

### **Error Creation (Copy Exactly)**

```typescript
// ✅ CORRECT - Use semantic methods
throw error.badRequest('Email is required');
throw error.unauthorized('Login required');
throw error.forbidden('Admin access required');
throw error.notFound('User not found');
throw error.conflict('Email already exists');
throw error.serverError('Database unavailable');

// ❌ WRONG - Manual status codes
res.status(400).json({ error: 'Bad request' }); // Don't do this
throw new Error('Something went wrong'); // No status code
```

### **Framework Setup (Copy Exactly)**

#### **Express Setup**

```typescript
// ✅ CORRECT - Express middleware setup
const error = errorClass.get();
app.use(error.handleErrors()); // Must be LAST middleware

// ✅ CORRECT - Express async route pattern
app.post(
  '/api',
  error.asyncRoute(async (req, res) => {
    if (!data) throw error.badRequest('Data required');
  })
);
```

#### **Fastify Setup**

```typescript
// ✅ CORRECT - Fastify error handler setup
import Fastify from 'fastify';
const fastify = Fastify();
const error = errorClass.get();

fastify.setErrorHandler((err, request, reply) => {
  const appError = err.statusCode ? err : error.serverError(err.message);
  reply.status(appError.statusCode).send({
    error: appError.type,
    message: appError.message,
  });
});

// ✅ CORRECT - Fastify route pattern
fastify.post('/api', async (request, reply) => {
  if (!request.body.data) throw error.badRequest('Data required');
  // Fastify automatically catches errors
});
```

#### **Koa Setup**

```typescript
// ✅ CORRECT - Koa error handler setup
import Koa from 'koa';
const app = new Koa();
const error = errorClass.get();

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const appError = (err as any).statusCode
      ? (err as any)
      : error.serverError((err as Error).message);
    ctx.status = appError.statusCode;
    ctx.body = {
      error: appError.type,
      message: appError.message,
    };
  }
});

// ✅ CORRECT - Koa route pattern
app.use(async (ctx, next) => {
  if (!ctx.request.body.data) throw error.badRequest('Data required');
});
```

### **Error Type Selection (Copy These Rules)**

```typescript
// ✅ Input validation (client's fault)
if (!email) throw error.badRequest('Email required');
if (password.length < 8) throw error.badRequest('Password too short');

// ✅ Authentication (missing/invalid auth)
if (!token) throw error.unauthorized('Token required');
if (tokenExpired) throw error.unauthorized('Session expired');

// ✅ Authorization (user authenticated but no permission)
if (!user.isAdmin) throw error.forbidden('Admin access required');
if (user.blocked) throw error.forbidden('Account suspended');

// ✅ Resource not found
if (!user) throw error.notFound('User not found');
if (!post) throw error.notFound('Post not found');

// ✅ Business logic conflicts
if (emailExists) throw error.conflict('Email already registered');
if (usernameExists) throw error.conflict('Username taken');

// ✅ Server/external failures
catch (dbError) { throw error.serverError('Database unavailable'); }
catch (apiError) { throw error.serverError('External service down'); }
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Wrong Error Types**

```typescript
// ❌ Using wrong error for situation
throw error.serverError('Email required'); // Should be badRequest
throw error.badRequest('Database connection failed'); // Should be serverError
throw error.unauthorized('Admin access required'); // Should be forbidden

// ✅ Use correct error for situation
throw error.badRequest('Email required'); // Client input issue
throw error.serverError('Database connection failed'); // Server issue
throw error.forbidden('Admin access required'); // Permission issue
```

### **Missing Middleware Setup**

```typescript
// ❌ Forgetting error middleware
const app = express();
app.post('/api', (req, res) => {
  throw error.badRequest('Error'); // Nothing will catch this!
});

// ✅ Proper middleware setup
const app = express();
const error = errorClass.get();
app.use(error.handleErrors()); // Catches all errors
app.post('/api', (req, res) => {
  throw error.badRequest('Error'); // Automatically handled
});
```

### **Mixing Error Approaches**

```typescript
// ❌ Mixing manual and automatic error handling
app.post(
  '/api',
  error.asyncRoute(async (req, res) => {
    try {
      if (!data) throw error.badRequest('Data required');
      // ... logic
    } catch (err) {
      res.status(500).json({ error: 'Failed' }); // Don't catch manually!
    }
  })
);

// ✅ Let the system handle errors
app.post(
  '/api',
  error.asyncRoute(async (req, res) => {
    if (!data) throw error.badRequest('Data required'); // Just throw - system handles
    // ... logic
  })
);
```

## 🚨 Error Handling Patterns

### **Input Validation Pattern**

```typescript
app.post(
  '/users',
  error.asyncRoute(async (req, res) => {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email) throw error.badRequest('Email is required');
    if (!password) throw error.badRequest('Password is required');
    if (!name) throw error.badRequest('Name is required');

    // Validate format/rules
    if (!email.includes('@')) throw error.badRequest('Invalid email format');
    if (password.length < 8)
      throw error.badRequest('Password must be 8+ characters');

    // Success path
    const user = await createUser({ email, password, name });
    res.json({ user });
  })
);
```

### **Authentication Middleware Pattern**

```typescript
const requireAuth = error.asyncRoute(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw error.unauthorized('Authentication token required');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUser(decoded.userId);

    if (!user) {
      throw error.unauthorized('Invalid token - user not found');
    }

    req.user = user;
    next();
  } catch (jwtError) {
    throw error.unauthorized('Invalid or expired token');
  }
});

// Usage
app.get(
  '/profile',
  requireAuth,
  error.asyncRoute(async (req, res) => {
    res.json({ user: req.user });
  })
);
```

### **Database Error Handling Pattern**

```typescript
app.post(
  '/posts',
  error.asyncRoute(async (req, res) => {
    const { title, content } = req.body;

    if (!title) throw error.badRequest('Title required');
    if (!content) throw error.badRequest('Content required');

    try {
      // Check for duplicates (business logic)
      const existing = await findPostByTitle(title);
      if (existing) {
        throw error.conflict('Post with this title already exists');
      }

      // Create post
      const post = await createPost({ title, content });
      res.json({ post });
    } catch (dbError) {
      // Database connection/query failures
      if (dbError.code === 'ECONNREFUSED') {
        throw error.serverError('Database connection failed');
      }
      if (dbError.code === 'ETIMEDOUT') {
        throw error.serverError('Database query timeout');
      }

      // Re-throw if it's already our error
      if (dbError.statusCode) {
        throw dbError;
      }

      // Unknown database error
      throw error.serverError('Database operation failed');
    }
  })
);
```

## 🌍 Environment Variables

### **Framework Configuration (Bloomneo Internal)**

```bash
# Error handling behavior (optional)
BLOOM_ERROR_STACK=false          # Show stack traces (default: true in dev, false in prod)
BLOOM_ERROR_LOG=true             # Enable error logging (default: true)

# Framework detection
NODE_ENV=production              # Environment mode (development, production, test, staging)
```

### **Your Application Configuration**

```bash
# Your app-specific environment variables
DATABASE_URL=postgresql://...
API_KEY=your-api-key
SESSION_SECRET=your-session-secret

# Note: Use any naming convention for your app config
# Bloomneo only reads BLOOM_* prefixed variables
```

### **Configuration Separation**

The error module follows **clear separation**:

- **BLOOM_ERROR_\*** - Framework behavior (stack traces, logging)
- **Everything else** - Your application configuration
- **No interference** - Your app config remains untouched

## 🚀 Production Deployment

### **Environment Configuration**

```bash
# ✅ Production settings
NODE_ENV=production              # Enables production mode
BLOOM_ERROR_STACK=false          # Hide stack traces for security
BLOOM_ERROR_LOG=true             # Enable error logging for monitoring

# ✅ Development settings
NODE_ENV=development             # Enables development mode
BLOOM_ERROR_STACK=true           # Show stack traces for debugging
BLOOM_ERROR_LOG=true             # Enable error logging
```

### **Framework-Specific Setup**

#### **Express Production Setup**

```typescript
import express from 'express';
import { errorClass } from '@bloomneo/appkit/error';

const app = express();

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your routes here
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', apiRoutes);

// ERROR MIDDLEWARE MUST BE LAST!
const error = errorClass.get();
app.use(error.handleErrors());

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

#### **Fastify Production Setup**

```typescript
import Fastify from 'fastify';
import { errorClass } from '@bloomneo/appkit/error';

const fastify = Fastify({ logger: true });
const error = errorClass.get();

// Global error handler
fastify.setErrorHandler((err, request, reply) => {
  const appError = (err as any).statusCode ? err : error.serverError(err.message);

  // Log in production
  if (error.getEnvironmentInfo().isProduction) {
    fastify.log.error(err);
  }

  reply.status((appError as any).statusCode).send({
    error: (appError as any).type,
    message: appError.message,
  });
});

// Your routes
fastify.register(apiRoutes, { prefix: '/api' });

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
```

### **Security Validation**

```typescript
// App startup validation
try {
  const error = errorClass.get();
  const env = error.getEnvironmentInfo();

  console.log(`✅ Error handling initialized`);
  console.log(`Environment: ${env.nodeEnv}`);
  console.log(`Development mode: ${env.isDevelopment}`);

  // Production security check
  if (env.isProduction && process.env.BLOOM_ERROR_STACK === 'true') {
    console.warn('⚠️ Stack traces enabled in production - security risk!');
  }
} catch (setupError) {
  console.error('❌ Error setup failed:', setupError.message);
  process.exit(1);
}
```

### **Common Issues & Solutions**

- **"Error not caught"** → Ensure error middleware is LAST in Express
- **"Stack traces in production"** → Check `NODE_ENV=production` and
  `BLOOM_ERROR_STACK=false`
- **"Async errors not handled"** → Use `error.asyncRoute()` wrapper for async
  routes
- **"Wrong error types"** → Review error type selection guide above
- **"Fastify errors not caught"** → Use `fastify.setErrorHandler()` with error
  module
- **"Koa errors not handled"** → Wrap routes in try/catch with error module

## 📖 Complete API Reference

### **Core Function**

```typescript
const error = errorClass.get(); // One function, all methods
```

### **Error Creation Methods**

```typescript
// Semantic HTTP errors
error.badRequest(message?);   // 400 - Invalid input
error.unauthorized(message?); // 401 - Auth required
error.forbidden(message?);    // 403 - Access denied
error.notFound(message?);     // 404 - Resource missing
error.conflict(message?);     // 409 - Business conflicts
error.serverError(message?);  // 500 - Internal failures

// Custom errors
error.createError(statusCode, message, type?); // Any status code
```

### **Express Middleware**

```typescript
// Error handling (must be last middleware)
error.handleErrors(options?);

// Async route wrapper
error.asyncRoute(handler);

// Error categorization
error.isClientError(error);  // 4xx status codes
error.isServerError(error);  // 5xx status codes
```

### **Utility Methods**

> 🧩 **Two surfaces — know which is which.** Every error-creation method, plus
> `handleErrors`/`asyncRoute`/`isClientError`/`isServerError`, is mirrored as an
> `errorClass.*` shortcut for convenience. Two methods live **only on the
> instance** and must be called via `errorClass.get().X()`.

**Instance-only (not on `errorClass`):**

```typescript
const error = errorClass.get();

error.getEnvironmentInfo(); // { isDevelopment, isProduction, nodeEnv }
error.getConfig();          // Current ErrorConfig
```

**Class-level shortcuts (skip `get()`):**

```typescript
import { errorClass } from '@bloomneo/appkit/error';

// Error creation — all 9 semantic methods
errorClass.badRequest('Message');
errorClass.unauthorized('Message');
errorClass.forbidden('Message');
errorClass.notFound('Message');
errorClass.conflict('Message');
errorClass.tooMany('Message');
errorClass.serverError('Message');
errorClass.internal('Message'); // alias for serverError
errorClass.createError(503, 'Maintenance', 'MAINTENANCE');

// Middleware + predicates
errorClass.handleErrors();
errorClass.asyncRoute(handler);
errorClass.isClientError(err);
errorClass.isServerError(err);

// Lifecycle
errorClass.reset({ middleware: { showStack: false, logErrors: false } });
errorClass.clearCache(); // null out the global — next get() rebuilds from env
```

## 💡 Simple Usage Patterns

### **Basic Validation**

```typescript
// Input validation
if (!email) throw error.badRequest('Email required');
if (!password) throw error.badRequest('Password required');

// Business validation
if (userExists) throw error.conflict('User already exists');
if (!userFound) throw error.notFound('User not found');
```

### **Authentication Flow**

```typescript
// Check for token
if (!token) throw error.unauthorized('Token required');

// Verify token
try {
  const user = await verifyToken(token);
  req.user = user;
} catch {
  throw error.unauthorized('Invalid token');
}

// Check permissions
if (!user.isAdmin) throw error.forbidden('Admin required');
```

### **Database Operations**

```typescript
try {
  const result = await db.query(sql);
  return result;
} catch (dbError) {
  throw error.serverError('Database operation failed');
}
```

## 🧪 Testing

```typescript
import { errorClass } from '@bloomneo/appkit/error';

// Reset for clean testing
const error = errorClass.reset({
  middleware: {
    showStack: false,
    logErrors: false,
  },
});

// Test error creation
const badRequestError = error.badRequest('Test message');
expect(badRequestError.statusCode).toBe(400);
expect(badRequestError.type).toBe('BAD_REQUEST');

// Test error categorization
const clientError = error.badRequest('Client error');
const serverError = error.serverError('Server error');

expect(error.isClientError(clientError)).toBe(true);
expect(error.isServerError(serverError)).toBe(true);

// Test environment detection
const env = error.getEnvironmentInfo();
expect(env.isDevelopment).toBeDefined();
expect(env.isProduction).toBeDefined();
```

## 📈 Performance

- **Error Creation**: ~0.01ms per error
- **Middleware Processing**: ~0.1ms per request
- **Memory Usage**: <100KB overhead
- **Environment Parsing**: Once per app startup
- **Framework Agnostic**: Works with any Node.js framework

## 🔍 TypeScript Support

```typescript
import type {
  AppError,
  ErrorConfig,
  ErrorHandlerOptions,
  ExpressErrorHandler,
  AsyncRouteHandler,
} from '@bloomneo/appkit/error';

// All methods are fully typed
const error = errorClass.get();
const middleware: ExpressErrorHandler = error.handleErrors();
const wrapper: AsyncRouteHandler = error.asyncRoute(handler);

// Environment info is typed
const env = error.getEnvironmentInfo();
// env.isDevelopment: boolean
// env.isProduction: boolean
// env.nodeEnv: string
```

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>

---

## Agent-Dev Friendliness Score

**Score: 60/100 — 🟡 Solid** *(uncapped: 75/100 — cap applied for runtime bug in Fastify example)*
*Scored 2026-04-13 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../AGENT_DEV_SCORING_ALGORITHM.md) v1.1*

> ⚠️ **Cap reason**: The Fastify and Koa example code blocks in the README shadowed the outer `error` variable with the caught error parameter, making `error.serverError(error.message)` call `.serverError()` on a plain Error object (which doesn't have that method) — a runtime TypeError. This is the "doc file contradicts examples file" anti-pattern → cap 60. **Fixed in this version.**

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **7** | All 15 methods exist and are tested. Fixed: 3 code blocks (2× Fastify, 1× Koa) used `error` as both the class instance and the caught error parameter — `error.serverError(error.message)` would TypeError at runtime. Also fixed stale `VOILA_ERROR_*` brand string. |
| 2 | Doc consistency | **8** | README, examples, AGENTS.md, and tests all use `errorClass.get()` consistently. The dual invocation paths (instance methods + `errorClass` shortcuts) are clearly documented. |
| 3 | Runtime verification | **9** | Excellent test suite: all 8 semantic errors tested with exact `statusCode` + `type`, `handleErrors()` verified to return 4-arg function, `asyncRoute` verified, `isClientError/isServerError` tested. Drift check for all 15 instance methods. |
| 4 | Type safety | **7** | `AppError`, `ErrorHandlerOptions`, `AsyncRouteHandler`, `ExpressErrorHandler` are all typed. Framework interfaces use `any` index signatures — acceptable for framework-agnostic design. |
| 5 | Discoverability | **9** | README hero is 10 lines to a working setup. Import is consistent. "Must be LAST middleware" is called out repeatedly. |
| 6 | Example completeness | **6** | `examples/error.ts` covers 6 of 15 methods. Missing from examples: `unauthorized`, `conflict`, `serverError`, `tooMany`, `internal`, `createError`, `isClientError`, `isServerError`, `getEnvironmentInfo`, `getConfig`, `reset`, `clearCache`. README compensates with inline code blocks for all cases. |
| 7 | Composability | **7** | `cookbook/auth-protected-crud.ts` composes error + auth + database + logger. `examples/error.ts` shows error + database combo. |
| 8 | Educational errors | **7** | The module *creates* educational errors for consumers (`badRequest`, `notFound`, etc.) — all well-named. The module itself doesn't throw many internal errors. Transport/config failures are logged generically. |
| 9 | Convention enforcement | **8** | One canonical setup: `get()` → `asyncRoute()` → `throw error.X()` → `handleErrors()` last. `serverError` vs `internal` aliasing is the only ambiguity (documented). |
| 10 | Drift prevention | **6** | Drift check test covers all 15 instance methods. No CI gate. |
| 11 | Reading order | **6** | README is well-structured with clear sections. No explicit pointer to AGENTS.md or examples at top. |
| **12** | **Simplicity** | **8** | 15 methods, but 8 are semantic errors following identical shapes. Minimum viable setup is 4 concepts: `get()`, `asyncRoute()`, `throw error.X()`, `handleErrors()`. |
| **13** | **Clarity** | **10** | `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `serverError`, `asyncRoute`, `handleErrors` — every name reads as an English sentence. Best clarity score of any module reviewed so far. |
| **14** | **Unambiguity** | **7** | `serverError` and `internal` are aliases — documented but creates two valid ways to do the same thing. Otherwise every method has exactly one valid interpretation. |
| **15** | **Learning curve** | **9** | Fastest time-to-first-working-call of any module. README hero is complete in 10 lines. Errors self-explain via semantic names. |

### Weighted (v1.1)

```
(7×.12)+(8×.08)+(9×.09)+(7×.06)+(9×.06)+(6×.08)+(7×.06)+(7×.05)+(8×.05)+(6×.04)+(6×.03)
+(8×.09)+(10×.09)+(7×.05)+(9×.05) = 7.5 → 75/100
Doc-contradiction cap: 60/100 (Fastify/Koa variable shadowing bug — now fixed)
```

### Gaps to reach 🟢 85+

1. **D6 Example completeness → 9**: Add `unauthorized`, `conflict`, `serverError`, `tooMany`, `createError`, `isClientError`, `isServerError` to `examples/error.ts`
2. **D14 Unambiguity → 9**: Deprecate `internal()` in favour of `serverError()` — document the alias explicitly so agents pick one
3. **D10 Drift prevention → 9**: Add CI check
4. **D11 Reading order → 8**: Add "See also: AGENTS.md | examples/error.ts" at the top

**Realistic ceiling:** ~82/100 with all 4 fixes.
