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

fastify.setErrorHandler((error, request, reply) => {
  const appError = error.statusCode ? error : error.serverError(error.message);
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
  } catch (error) {
    const appError = error.statusCode
      ? error
      : error.serverError(error.message);
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

### **Framework Configuration (VoilaJSX Internal)**

```bash
# Error handling behavior (optional)
VOILA_ERROR_STACK=false          # Show stack traces (default: true in dev, false in prod)
VOILA_ERROR_LOG=true             # Enable error logging (default: true)

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
# VoilaJSX only reads VOILA_* prefixed variables
```

### **Configuration Separation**

The error module follows **clear separation**:

- **VOILA*ERROR*\*** - Framework behavior (stack traces, logging)
- **Everything else** - Your application configuration
- **No interference** - Your app config remains untouched

## 🚀 Production Deployment

### **Environment Configuration**

```bash
# ✅ Production settings
NODE_ENV=production              # Enables production mode
VOILA_ERROR_STACK=false          # Hide stack traces for security
VOILA_ERROR_LOG=true             # Enable error logging for monitoring

# ✅ Development settings
NODE_ENV=development             # Enables development mode
VOILA_ERROR_STACK=true           # Show stack traces for debugging
VOILA_ERROR_LOG=true             # Enable error logging
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
fastify.setErrorHandler((error, request, reply) => {
  const appError = error.statusCode ? error : error.serverError(error.message);

  // Log in production
  if (error.getEnvironmentInfo().isProduction) {
    fastify.log.error(error);
  }

  reply.status(appError.statusCode).send({
    error: appError.type,
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
  if (env.isProduction && process.env.VOILA_ERROR_STACK === 'true') {
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
  `VOILA_ERROR_STACK=false`
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

```typescript
// Environment info
error.getEnvironmentInfo(); // Current environment details

// Configuration access
error.getConfig(); // Current error configuration

// Shortcut methods (direct usage without get())
error.badRequest('Message');
error.unauthorized('Message');
error.forbidden('Message');
error.notFound('Message');
error.conflict('Message');
error.serverError('Message');

// Direct middleware usage
error.handleErrors();
error.asyncRoute(handler);
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

MIT © [VoilaJSX](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>
