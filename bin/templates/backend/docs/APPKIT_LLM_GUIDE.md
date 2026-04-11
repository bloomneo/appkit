# VoilaJSX AppKit - LLM Guide: Core Philosophy & Universal Patterns 🤖

> **Essential foundation for AI agents to generate perfect VoilaJSX AppKit
> code**

## CRITICAL: Read This First

This section establishes the core patterns that ALL VoilaJSX AppKit code must
follow. Every example is production-ready. Every pattern is tested. Every rule
is absolute.

---

## WHEN TO USE VoilaJSX AppKit

✅ **ALWAYS use AppKit when:**

- Building Node.js backend applications
- Need authentication with roles/permissions
- Require file storage, caching, queuing, or email
- Want environment-driven configuration
- Building multi-tenant or multi-org applications
- Need production-ready security features
- Want zero-configuration startup

❌ **NEVER use AppKit when:**

- Building frontend React/Vue applications
- Creating CLI tools or desktop applications
- Need real-time WebSocket servers as primary feature
- Building pure microservices with single responsibility
- Working with non-Node.js environments

---

## COMPLETE MODULE REFERENCE (All 12 Modules)

**MEMORIZE this table - it's your single source of truth:**

| Module       | Import                                                      | Class           | Object Name | Optional Param    | When to Use Param                 |
| ------------ | ----------------------------------------------------------- | --------------- | ----------- | ----------------- | --------------------------------- |
| **Util**     | `import { utilClass } from '@bloomneo/appkit/util'`         | `utilClass`     | `util`      | ❌ None           | N/A                               |
| **Config**   | `import { configClass } from '@bloomneo/appkit/config'`     | `configClass`   | `config`    | ❌ None           | N/A                               |
| **Auth**     | `import { authClass } from '@bloomneo/appkit/auth'`         | `authClass`     | `auth`      | ❌ None           | N/A                               |
| **Logger**   | `import { loggerClass } from '@bloomneo/appkit/logger'`     | `loggerClass`   | `logger`    | ✅ `(component?)` | Component-specific logging        |
| **Database** | `import { databaseClass } from '@bloomneo/appkit/database'` | `databaseClass` | `database`  | ❌ None           | N/A                               |
| **Cache**    | `import { cacheClass } from '@bloomneo/appkit/cache'`       | `cacheClass`    | `cache`     | ✅ `(namespace?)` | Custom namespace (default: 'app') |
| **Storage**  | `import { storageClass } from '@bloomneo/appkit/storage'`   | `storageClass`  | `storage`   | ❌ None           | N/A                               |
| **Queue**    | `import { queueClass } from '@bloomneo/appkit/queue'`       | `queueClass`    | `queue`     | ❌ None           | N/A                               |
| **Email**    | `import { emailClass } from '@bloomneo/appkit/email'`       | `emailClass`    | `email`     | ❌ None           | N/A                               |
| **Error**    | `import { errorClass } from '@bloomneo/appkit/error'`       | `errorClass`    | `error`     | ❌ None           | N/A                               |
| **Security** | `import { securityClass } from '@bloomneo/appkit/security'` | `securityClass` | `security`  | ❌ None           | N/A                               |
| **Event**    | `import { eventClass } from '@bloomneo/appkit/event'`       | `eventClass`    | `event`     | ✅ `(namespace?)` | Namespace isolation for events    |

---

## THE ONE FUNCTION RULE

**EVERY module follows the same pattern:**

```javascript
// ALWAYS use this pattern for EVERY module
const module = moduleClass.get();

// Standard usage - MEMORIZE these exact patterns
const util = utilClass.get();
const config = configClass.get();
const auth = authClass.get();
const database = databaseClass.get();
const storage = storageClass.get();
const queue = queueClass.get();
const email = emailClass.get();
const error = errorClass.get();
const security = securityClass.get();

// With optional parameters
const logger = loggerClass.get('api'); // Component-specific
const cache = cacheClass.get(); // Default 'app' namespace
const userCache = cacheClass.get('users'); // Custom namespace
const event = eventClass.get('notifications'); // Event namespace
```

**RULE: Never call constructors directly. Always use .get()**

❌ **NEVER do this:**

```javascript
new AuthClass();
new DatabaseService();
new ConfigManager();
```

✅ **ALWAYS do this:**

```javascript
const auth = authClass.get();
const database = databaseClass.get();
const config = configClass.get();
```

---

## MODULE CATEGORIES & DECISION TREE

### **Infrastructure (4 modules) - Use First**

- **Auth**: JWT tokens, role-based permissions, middleware
- **Database**: Multi-tenant database operations, ORM integration
- **Security**: CSRF protection, rate limiting, input sanitization, encryption
- **Error**: HTTP error handling, status codes, middleware

### **Data & Communication (5 modules) - Use Second**

- **Cache**: Redis/Memory caching with namespaces
- **Storage**: File storage (local/S3/R2), CDN integration
- **Queue**: Background job processing, scheduled tasks
- **Email**: Multi-provider email sending, templates
- **Event**: Real-time events, pub/sub messaging

### **Developer Experience (3 modules) - Use Third**

- **Util**: Safe object access, array operations, string utilities, performance
  helpers
- **Config**: Environment variable parsing, application configuration
- **Logger**: Structured logging, multiple transports

---

## IMPORT PATTERNS

**ALWAYS use direct module imports for best tree-shaking:**

✅ **BEST (Perfect tree-shaking):**

```javascript
import { utilClass } from '@bloomneo/appkit/util';
import { authClass } from '@bloomneo/appkit/auth';
import { configClass } from '@bloomneo/appkit/config';
```

✅ **GOOD (Still tree-shakable):**

```javascript
import { utilClass, authClass, configClass } from '@bloomneo/appkit';
```

❌ **AVOID (Poor tree-shaking):**

```javascript
import * as appkit from '@bloomneo/appkit';
```

---

## ENVIRONMENT-DRIVEN SCALING

**AppKit automatically scales based on environment variables:**

### **Development (Zero Config)**

```bash
# No environment variables needed
npm start
```

- Memory cache/queue
- Local file storage
- Console logging
- Single database

### **Production (Auto-Detection)**

```bash
# Set these - everything scales automatically
REDIS_URL=redis://...           # → Distributed cache/queue
DATABASE_URL=postgres://...     # → Database logging/queue
AWS_S3_BUCKET=bucket           # → Cloud storage
RESEND_API_KEY=re_...          # → Email service
```

---

## UNIVERSAL ERROR HANDLING PATTERNS

### **Pattern 1: Safe Access with Defaults**

```javascript
// ALWAYS use util.get() for safe property access
const util = utilClass.get();

❌ const name = user.profile.name;                    // Can crash
✅ const name = util.get(user, 'profile.name', 'Guest'); // Never crashes
```

### **Pattern 2: Try-Catch with Specific Errors**

```javascript
const error = errorClass.get();

try {
  await someOperation();
} catch (err) {
  if (err.message.includes('validation')) {
    throw error.badRequest('Invalid input data');
  }
  if (err.message.includes('permission')) {
    throw error.forbidden('Access denied');
  }
  if (err.message.includes('not found')) {
    throw error.notFound('Resource not found');
  }
  // Default to server error
  throw error.serverError('Operation failed');
}
```

### **Pattern 3: Startup Validation**

```javascript
// ALWAYS validate configuration at app startup
try {
  const auth = authClass.get();
  const config = configClass.get();

  // Validate required config
  config.getRequired('database.url');

  console.log('✅ App validation passed');
} catch (error) {
  console.error('❌ App validation failed:', error.message);
  process.exit(1);
}
```

---

## VARIABLE NAMING CONVENTIONS

**ALWAYS use singular naming that matches the module name for clarity:**

### **Standard Pattern**

```javascript
const util = utilClass.get(); // Singular: 'util'
const config = configClass.get(); // Singular: 'config'
const auth = authClass.get(); // Singular: 'auth'
const database = databaseClass.get(); // Singular: 'database'
const storage = storageClass.get(); // Singular: 'storage'
const queue = queueClass.get(); // Singular: 'queue'
const email = emailClass.get(); // Singular: 'email'
const error = errorClass.get(); // Singular: 'error'
const security = securityClass.get(); // Singular: 'security'
const logger = loggerClass.get(); // Singular: 'logger'
const cache = cacheClass.get(); // Singular: 'cache' + namespace
const event = eventClass.get(); // Singular: 'event'
```

### **Namespaced Instances**

```javascript
// Logger, Cache, and Event allow parameters for organization

// Logger - component-specific logging
const logger = loggerClass.get('api');
const dbLogger = loggerClass.get('database');

// Cache - ALWAYS add namespace suffix
const userCache = cacheClass.get('users');
const sessionCache = cacheClass.get('sessions');

// Event - namespace for event isolation
const userEvent = eventClass.get('users');
const orderEvent = eventClass.get('orders');
```

---

## FRAMEWORK INTEGRATION PATTERNS

### **Express Pattern**

```javascript
import express from 'express';
import { authClass, errorClass, loggerClass } from '@bloomneo/appkit';

const app = express();
const auth = authClass.get();
const error = errorClass.get();
const logger = loggerClass.get('app');

// ALWAYS use this middleware order
app.use(express.json());
app.use(auth.requireLogin()); // Auth first
app.use('/api', routes); // Routes second
app.use(error.handleErrors()); // Error handling LAST

// ALWAYS use asyncRoute wrapper
app.post(
  '/users',
  error.asyncRoute(async (req, res) => {
    // Errors automatically handled
  })
);
```

### **Fastify Pattern**

```javascript
import Fastify from 'fastify';
import { authClass, errorClass } from '@bloomneo/appkit';

const fastify = Fastify();
const auth = authClass.get();
const error = errorClass.get();

// ALWAYS set error handler
fastify.setErrorHandler((error, request, reply) => {
  const appError = error.statusCode ? error : error.serverError(error.message);
  reply.status(appError.statusCode).send({
    error: appError.type,
    message: appError.message,
  });
});

// ALWAYS use preHandler for auth
fastify.get(
  '/protected',
  {
    preHandler: auth.requireRole('admin.tenant'),
  },
  async (request, reply) => {
    // Route handler
  }
);
```

---

## MODULE INTERACTION RULES

### **Dependency Order (ALWAYS follow this order):**

1. **Util** - No dependencies, use first
2. **Config** - No dependencies, use for configuration
3. **Logger** - Depends on Config
4. **Error** - Depends on Config and Logger
5. **Auth** - Depends on Config and Error
6. **Security** - Depends on Config and Error
7. **Database** - Depends on Config, Logger, and Error
8. **Cache** - Depends on Config and Logger
9. **Storage** - Depends on Config, Logger, and Error
10. **Email** - Depends on Config, Logger, and Error
11. **Queue** - Depends on Config, Logger, and Error
12. **Event** - Depends on Config, Logger, and Error

### **Safe Initialization Pattern**

```javascript
// ALWAYS initialize in this order
async function initializeApp() {
  try {
    // 1. Core utilities first
    const config = configClass.get();
    const logger = loggerClass.get('init');

    // 2. Validate configuration
    config.getRequired('database.url');

    // 3. Initialize database
    const database = databaseClass.get();

    // 4. Initialize other services
    const cache = cacheClass.get('app');
    const queue = queueClass.get();

    logger.info('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ App initialization failed:', error.message);
    process.exit(1);
  }
}
```

---

## TESTING PATTERNS

### **Module Reset Between Tests**

```javascript
import {
  utilClass,
  loggerClass,
  cacheClass,
  configClass,
} from '@bloomneo/appkit';

describe('App Tests', () => {
  afterEach(async () => {
    // ALWAYS reset module state between tests
    utilClass.clearCache();
    await loggerClass.clear();
    await cacheClass.clear();
    configClass.clearCache();
  });

  test('should process data safely', () => {
    const util = utilClass.get();
    const result = util.get({ user: { name: 'John' } }, 'user.name');
    expect(result).toBe('John');
  });
});
```

---

## PRODUCTION DEPLOYMENT PATTERNS

### **Environment Validation**

```javascript
// ALWAYS validate environment at startup
function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['VOILA_AUTH_SECRET', 'DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('✅ Production environment validated');
}
```

### **Graceful Shutdown**

```javascript
// ALWAYS implement graceful shutdown
async function gracefulShutdown() {
  console.log('🔄 Shutting down gracefully...');

  try {
    await database.disconnect();
    await queue.close();
    await logger.flush();

    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

# Essential Modules 🚀

> **Core modules every application needs - Util, Config, Auth, Logger**

## 🛠️ UTIL MODULE - ALL 12 METHODS

### When to Use

✅ **Safe property access, array operations, string utilities, performance
helpers**  
❌ **Complex data transformations, DOM manipulation, heavy math**

### Core Pattern

```javascript
import { utilClass } from '@bloomneo/appkit/util';
const util = utilClass.get();
```

### Complete API (All 12 Methods)

```javascript
// 1. get() - Safe property access (NEVER crashes)
const name = util.get(user, 'profile.name', 'Guest');
const items = util.get(response, 'data.items', []);
const nested = util.get(obj, 'users[0].addresses[1].city', 'N/A');

// 2. isEmpty() - Universal empty check
if (util.isEmpty(req.body.email)) throw error.badRequest('Email required');
util.isEmpty(null); // → true
util.isEmpty({}); // → true
util.isEmpty([]); // → true
util.isEmpty(''); // → true
util.isEmpty('   '); // → true (whitespace only)
util.isEmpty(0); // → false (number is not empty)
util.isEmpty(false); // → false (boolean is not empty)

// 3. slugify() - URL-safe strings
const slug = util.slugify('Product Name!'); // → 'product-name'
const userSlug = util.slugify('User@Email.com'); // → 'user-email-com'

// 4. chunk() - Split arrays into batches
const batches = util.chunk(largeArray, 100);
util.chunk([1, 2, 3, 4, 5, 6], 2); // → [[1,2], [3,4], [5,6]]

// 5. debounce() - Prevent excessive function calls
const debouncedSearch = util.debounce(searchAPI, 300);
const saveSettings = util.debounce(saveToStorage, 1000);

// 6. pick() - Extract specific object properties
const publicUser = util.pick(user, ['id', 'name', 'email']);

// 7. unique() - Remove duplicates
const uniqueIds = util.unique([1, 2, 2, 3, 3, 4]); // → [1, 2, 3, 4]

// 8. clamp() - Constrain numbers to range
const volume = util.clamp(userInput, 0, 1); // Audio volume
util.clamp(150, 0, 100); // → 100 (max limit)
util.clamp(-10, 0, 100); // → 0 (min limit)

// 9. formatBytes() - Human-readable file sizes
const size = util.formatBytes(1048576); // → '1 MB'
util.formatBytes(1024); // → '1 KB'

// 10. truncate() - Smart text cutting
const preview = util.truncate(longText, { length: 100, preserveWords: true });

// 11. sleep() - Promise-based delays
await util.sleep(1000); // Wait 1 second

// 12. uuid() - Generate unique identifiers
const sessionId = util.uuid(); // → 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

---

## ⚙️ CONFIG MODULE

### When to Use

✅ **Environment variables, application settings, startup validation**  
❌ **Runtime configuration changes, user preferences**

### Core Pattern

```javascript
import { configClass } from '@bloomneo/appkit/config';
const config = configClass.get();
```

### Environment Variable Convention

**UPPER_SNAKE_CASE** automatically becomes nested dot notation:

```bash
# Environment Variable → Config Path
DATABASE_HOST=localhost                     → config.get('database.host')
DATABASE_CONNECTION_POOL_SIZE=10           → config.get('database.connection.pool_size')
STRIPE_API_KEYS_PUBLIC=pk_test_123         → config.get('stripe.api.keys.public')
FEATURES_ANALYTICS_ENABLED=true           → config.get('features.analytics.enabled')
```

### Essential Patterns

```javascript
// 1. Required values (throws if missing)
const dbUrl = config.getRequired('database.url');
const authSecret = config.getRequired('auth.secret');

// 2. Optional with defaults
const port = config.get('server.port', 3000);
const timeout = config.get('api.timeout', 5000);

// 3. Environment detection
const isDev = config.isDevelopment();
const isProd = config.isProduction();

// 4. Startup validation
try {
  config.getRequired('database.url');
  config.getRequired('auth.secret');

  if (config.isProduction()) {
    config.getRequired('redis.url');
  }

  console.log('✅ Configuration validation passed');
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}
```

---

## 🔐 AUTH MODULE

### When to Use

✅ **Dual token system, JWT operations, role-level permissions, API security, password hashing**  
❌ **Frontend authentication, OAuth providers, session storage**

### Core Pattern

```javascript
import { authClass } from '@bloomneo/appkit/auth';
const auth = authClass.get();
```

### Dual Token System (CRITICAL - Two Distinct Types)

```javascript
// ✅ LOGIN TOKENS - For user authentication (mobile/web)
const loginToken = auth.generateLoginToken({
  userId: 123,     // REQUIRED - unique user identifier
  role: 'admin',   // REQUIRED - role name (admin, user, moderator)
  level: 'tenant', // REQUIRED - level within role (basic, tenant, org, system)
}, '7d'); // Short-medium expiry

// ✅ API TOKENS - For service authentication (webhooks/integrations)
const apiToken = auth.generateApiToken({
  keyId: 'webhook_service', // REQUIRED - service identifier
  role: 'service',          // REQUIRED - role name
  level: 'external',        // REQUIRED - level within role
}, '1y'); // Long expiry

// ❌ WRONG - Don't mix these up
auth.generateLoginToken({ keyId: 'test' }); // keyId is for API tokens
auth.generateApiToken({ userId: 123 });    // userId is for login tokens
```

### Role Hierarchy (Built-in Inheritance)

```
admin.system > admin.org > admin.tenant >
moderator.manage > moderator.approve > moderator.review >
user.max > user.pro > user.basic
```

### Essential Auth Patterns

```javascript
// 1. User route protection (login tokens only)
app.get('/profile', auth.requireLoginToken(), handler);
app.get('/admin', auth.requireLoginToken(), auth.requireUserRoles(['admin.tenant']), handler);

// 2. API route protection (API tokens only) 
app.post('/webhook/data', auth.requireApiToken(), handler);

// 3. Safe user extraction (works with both token types)
const user = auth.user(req);
if (!user) throw error.unauthorized('Authentication required');

// 4. Role hierarchy checking
const userRoleLevel = `${user.role}.${user.level}`;
if (!auth.hasRole(userRoleLevel, 'admin.tenant')) {
  throw error.forbidden('Admin access required');
}

// 5. Permission checking (action:scope format)
if (!auth.can(user, 'manage:tenant')) {
  throw error.forbidden('Insufficient permissions');
}

// 6. Password handling
const hashedPassword = await auth.hashPassword(plainPassword);
const isValid = await auth.comparePassword(plainPassword, hashedPassword);

// 7. Token operations (works with both types)
const payload = auth.verifyToken(token);
```

### Complete Authentication Flow

```javascript
// User login endpoint (generates login token)
app.post(
  '/auth/login',
  error.asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (util.isEmpty(email)) throw error.badRequest('Email required');
    if (util.isEmpty(password)) throw error.badRequest('Password required');

    const user = await database.user.findUnique({ where: { email } });
    if (!user) throw error.unauthorized('Invalid credentials');

    const isValid = await auth.comparePassword(password, user.password);
    if (!isValid) throw error.unauthorized('Invalid credentials');

    // Generate login token for user authentication
    const loginToken = auth.generateLoginToken({
      userId: user.id,
      role: user.role,
      level: user.level,
    });

    res.json({
      token: loginToken,
      user: util.pick(user, ['id', 'email', 'name']),
    });
  })
);

// API token creation endpoint (admin-only)
app.post(
  '/admin/api-tokens',
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const { keyId, permissions } = req.body;

    // Generate API token for service authentication  
    const apiToken = auth.generateApiToken({
      keyId,
      role: 'service',
      level: 'external',
      permissions,
    }, '1y');

    // Store token info in database (store hash, not plain token)
    const hashedToken = await auth.hashPassword(apiToken);
    await database.apiToken.create({
      data: { keyId, token: hashedToken, permissions },
    });

    res.json({ apiToken }); // Return once for client to save
  })
);
```

---

## 📝 LOGGER MODULE

### When to Use

✅ **Structured logging, error tracking, performance monitoring**  
❌ **Simple console.log, debugging only**

### Core Pattern

```javascript
import { loggerClass } from '@bloomneo/appkit/logger';
const logger = loggerClass.get();
```

### Auto-Transport Selection

```bash
# Development → Console
# Production with DATABASE_URL → Database
# Production with REDIS_URL → Redis
# Production with VOILA_LOGGER_HTTP_URL → HTTP endpoint
```

### Essential Patterns

```javascript
// 1. Component-specific loggers
const logger = loggerClass.get('api');
const dbLogger = loggerClass.get('database');

// 2. Structured logging with context
logger.info('User created', {
  userId: user.id,
  email: user.email,
  timestamp: Date.now(),
});

// 3. Error logging
try {
  await riskyOperation();
} catch (err) {
  logger.error('Operation failed', {
    error: err.message,
    stack: err.stack,
    userId: req.user?.id,
  });
  throw error.serverError('Operation failed');
}

// 4. Request logging middleware
app.use((req, res, next) => {
  req.requestId = util.uuid();
  req.logger = logger.child({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
  });

  const startTime = Date.now();
  res.on('finish', () => {
    req.logger.info('Request completed', {
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
    });
  });

  next();
});
```

---

## ESSENTIAL MODULES INTEGRATION

```javascript
// Complete API endpoint using all 4 essential modules
import { utilClass } from '@bloomneo/appkit/util';
import { configClass } from '@bloomneo/appkit/config';
import { authClass } from '@bloomneo/appkit/auth';
import { loggerClass } from '@bloomneo/appkit/logger';
import { errorClass } from '@bloomneo/appkit/error';

const util = utilClass.get();
const config = configClass.get();
const auth = authClass.get();
const logger = loggerClass.get('api');
const error = errorClass.get();

// User profile update endpoint
app.put(
  '/api/profile',
  auth.requireLogin(),
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);
    const requestLogger = logger.child({
      userId: user.userId,
      requestId: util.uuid(),
    });

    // Safe data extraction
    const name = util.get(req.body, 'name', '').trim();
    const bio = util.get(req.body, 'bio', '').trim();

    // Input validation
    if (util.isEmpty(name)) {
      requestLogger.warn('Profile update failed - empty name');
      throw error.badRequest('Name is required');
    }

    // Length validation from config
    const maxBioLength = config.get('user.bio.maxLength', 500);
    if (bio.length > maxBioLength) {
      throw error.badRequest(`Bio too long (max ${maxBioLength} characters)`);
    }

    // Create slug for profile URL
    const slug = util.slugify(name);

    // Update user data
    const updatedUser = await database.user.update({
      where: { id: user.userId },
      data: { name, bio: util.isEmpty(bio) ? null : bio, slug },
    });

    requestLogger.info('Profile updated successfully');

    res.json({
      success: true,
      user: util.pick(updatedUser, ['id', 'name', 'bio', 'slug']),
    });
  })
);
```

# Infrastructure Modules 📊

> **Data persistence, communication, and background processing - Database,
> Cache, Storage, Queue, Email**

## 🗄️ DATABASE MODULE

### When to Use

✅ **Persistent data, user data, content, multi-tenant apps, cross-cloud
orgs**  
❌ **Temporary data, files, caching, session storage**

### Core Pattern

```javascript
import { databaseClass } from '@bloomneo/appkit/database';
const database = databaseClass.get();
```

### Progressive Scaling (CRITICAL)

```javascript
// Day 1: Single database
const database = await databaseClass.get();
const users = await database.user.findMany();

// Month 6: Multi-tenant (zero code changes!)
// Just add: VOILA_DB_TENANT=auto
const database = await databaseClass.get(); // Now auto-filtered by tenant

// Year 1: Multi-org (still zero code changes!)
// Add: ORG_ACME=postgresql://acme.aws.com/db
const acmeDatabase = await databaseClass.org('acme').get();
```

### Essential API (3 Core Patterns)

```javascript
// 1. Normal user access (single or tenant-filtered)
const database = await databaseClass.get();
const users = await database.user.findMany(); // Auto-filtered if tenant mode

// 2. Admin access (all tenants)
const dbTenants = await databaseClass.getTenants();
const allUsers = await dbTenants.user.findMany(); // Cross-tenant

// 3. Organization-specific access
const acmeDatabase = await databaseClass.org('acme').get();
const acmeUsers = await acmeDatabase.user.findMany();
```

### MANDATORY Schema Requirements

```sql
-- ✅ EVERY table MUST include tenant_id from Day 1 (nullable for future)
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  name text,
  tenant_id text,                    -- MANDATORY: nullable for future
  created_at timestamp DEFAULT now(),

  INDEX idx_users_tenant (tenant_id) -- MANDATORY: performance index
);

CREATE TABLE posts (
  id uuid PRIMARY KEY,
  title text,
  content text,
  user_id uuid REFERENCES users(id),
  tenant_id text,                    -- MANDATORY: on EVERY table
  created_at timestamp DEFAULT now(),

  INDEX idx_posts_tenant (tenant_id) -- MANDATORY: on EVERY table
);
```

---

## 💾 CACHE MODULE

### When to Use

✅ **Speed up database queries, session data, API responses, computed
results**  
❌ **Permanent data, files, transactions, sensitive data without encryption**

### Core Pattern

```javascript
import { cacheClass } from '@bloomneo/appkit/cache';
const cache = cacheClass.get(); // Default 'app' namespace
```

### Auto-Strategy Detection

```bash
# Development → Memory cache with LRU
# Production → Redis (if REDIS_URL) → Memory
```

### Essential API (5 Core Methods)

```javascript
// 1. set() - Store with TTL (seconds)
await cache.set('user:123', userData, 3600); // 1 hour TTL

// 2. get() - Retrieve (null if not found/expired)
const user = await cache.get('user:123');

// 3. getOrSet() - Get or compute and cache
const weather = await cache.getOrSet(
  `weather:${city}`,
  async () => {
    return await fetchWeatherAPI(city); // Only runs on cache miss
  },
  1800 // 30 minutes
);

// 4. delete() - Remove specific key
await cache.delete('user:123');

// 5. clear() - Clear entire namespace
await cache.clear();
```

### Namespace Isolation

```javascript
// ALWAYS use specific namespaces - completely isolated
const userCache = cacheClass.get('users');
const sessionCache = cacheClass.get('sessions');
const apiCache = cacheClass.get('external-api');

await userCache.set('123', userData);
await sessionCache.set('123', sessionData); // Different from user:123
```

---

## 📁 STORAGE MODULE

### When to Use

✅ **File uploads, documents, images, videos, CDN integration**  
❌ **Configuration data, temporary data, session storage**

### Core Pattern

```javascript
import { storageClass } from '@bloomneo/appkit/storage';
const storage = storageClass.get();
```

### Auto-Strategy Detection

```bash
# Development → Local files in ./uploads/
# Production → R2 (if CLOUDFLARE_R2_BUCKET) → S3 (if AWS_S3_BUCKET) → Local
```

### Essential API (4 Core Methods)

```javascript
// 1. put() - Upload files
await storage.put('avatars/user123.jpg', imageBuffer);
await storage.put('docs/contract.pdf', pdfBuffer, {
  contentType: 'application/pdf',
  cacheControl: 'public, max-age=3600',
});

// 2. get() - Download files
const buffer = await storage.get('avatars/user123.jpg');
if (!buffer) throw error.notFound('File not found');

// 3. delete() - Remove files
await storage.delete('temp/old-file.jpg');

// 4. url() - Get public URLs
const url = storage.url('avatars/user123.jpg');
// Local:  /uploads/avatars/user123.jpg
// S3:     https://bucket.s3.region.amazonaws.com/avatars/user123.jpg
// R2:     https://cdn.example.com/avatars/user123.jpg
```

---

## 🚀 QUEUE MODULE

### When to Use

✅ **Background jobs, emails, file processing, webhooks, scheduled tasks**  
❌ **Real-time operations, simple sync operations, immediate responses**

### Core Pattern

```javascript
import { queueClass } from '@bloomneo/appkit/queue';
const queue = queueClass.get();
```

### Auto-Transport Detection

```bash
# Development → Memory queue
# Production → Redis (if REDIS_URL) → Database (if DATABASE_URL) → Memory
```

### Essential API (3 Core Methods)

```javascript
// 1. add() - Add jobs to queue
await queue.add('email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up',
});

await queue.add(
  'image-resize',
  {
    input: 'uploads/large.jpg',
    output: 'thumbnails/thumb.jpg',
    width: 200,
  },
  {
    delay: 5000, // Start in 5 seconds
    attempts: 3, // Retry 3 times
  }
);

// 2. process() - Handle jobs
queue.process('email', async (data) => {
  await sendEmail(data.to, data.subject, data.body);
  return { sent: true };
});

queue.process('image-resize', async (data) => {
  await resizeImage(data.input, data.output, data.width);
  return { resized: true };
});

// 3. schedule() - Delayed jobs
await queue.schedule(
  'reminder',
  {
    userId: 123,
    message: 'Your trial ends soon!',
  },
  7 * 24 * 60 * 60 * 1000
); // 7 days
```

---

## 📧 EMAIL MODULE

### When to Use

✅ **Transactional emails, notifications, templates, multi-provider support**  
❌ **Marketing emails, bulk campaigns, newsletter management**

### Core Pattern

```javascript
import { emailClass } from '@bloomneo/appkit/email';
const email = emailClass.get();
```

### Auto-Provider Detection

```bash
# Production → Resend (if RESEND_API_KEY) → SMTP (if SMTP_HOST) → Console
```

### Essential API (3 Core Methods)

```javascript
// 1. send() - Basic email sending
await email.send({
  to: 'user@example.com',
  subject: 'Welcome to our app!',
  text: 'Thanks for signing up.',
  html: '<h1>Thanks for signing up!</h1>',
});

// 2. sendTemplate() - Template-based emails
await email.sendTemplate('welcome', {
  to: user.email,
  name: user.name,
  activationLink: `https://app.com/activate/${user.token}`,
});

// 3. Queue integration (recommended for production)
await queue.add('email', {
  template: 'password-reset',
  to: user.email,
  resetLink: resetUrl,
});

queue.process('email', async (data) => {
  if (data.template) {
    return await email.sendTemplate(data.template, data);
  } else {
    return await email.send(data);
  }
});
```

---

## INFRASTRUCTURE INTEGRATION

```javascript
// File upload with complete infrastructure integration
import { utilClass } from '@bloomneo/appkit/util';
import { authClass } from '@bloomneo/appkit/auth';
import { databaseClass } from '@bloomneo/appkit/database';
import { storageClass } from '@bloomneo/appkit/storage';
import { cacheClass } from '@bloomneo/appkit/cache';
import { queueClass } from '@bloomneo/appkit/queue';
import { errorClass } from '@bloomneo/appkit/error';
import { loggerClass } from '@bloomneo/appkit/logger';

const util = utilClass.get();
const auth = authClass.get();
const storage = storageClass.get();
const queue = queueClass.get();
const error = errorClass.get();
const logger = loggerClass.get('upload');

// File upload endpoint
app.post(
  '/api/upload',
  auth.requireLogin(),
  upload.single('file'),
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);
    const userCache = cacheClass.get('users');

    if (!req.file) {
      throw error.badRequest('No file uploaded');
    }

    // 1. Store file in storage (auto-detects Local/S3/R2)
    const fileKey = `uploads/${user.userId}/${Date.now()}-${util.slugify(req.file.originalname)}`;
    await storage.put(fileKey, req.file.buffer, {
      contentType: req.file.mimetype,
    });

    // 2. Save to database (auto-filtered by tenant if enabled)
    const database = await databaseClass.get();
    const file = await database.file.create({
      data: {
        key: fileKey,
        name: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        userId: user.userId,
      },
    });

    // 3. Queue background processing
    await queue.add('process-upload', {
      fileId: file.id,
      fileKey: fileKey,
      userId: user.userId,
    });

    // 4. Clear user's file cache
    await userCache.delete(`files:${user.userId}`);

    // 5. Log activity
    logger.info('File uploaded', {
      fileId: file.id,
      userId: user.userId,
      size: util.formatBytes(req.file.size),
    });

    res.json({
      success: true,
      file: {
        id: file.id,
        url: storage.url(fileKey),
        name: req.file.originalname,
        size: util.formatBytes(req.file.size),
      },
    });
  })
);

// Background file processor
queue.process('process-upload', async (data) => {
  const database = await databaseClass.get();
  const email = emailClass.get();
  const processingLogger = loggerClass.get('processing');

  try {
    // Get file buffer for processing
    const buffer = await storage.get(data.fileKey);

    // Process file (resize, convert, scan, etc.)
    const processedBuffer = await processFile(buffer);

    // Store processed version
    const processedKey = data.fileKey.replace('uploads/', 'processed/');
    await storage.put(processedKey, processedBuffer);

    // Update database
    await database.file.update({
      where: { id: data.fileId },
      data: {
        processed: true,
        processedKey,
        processedAt: new Date(),
      },
    });

    // Clear cache
    const userCache = cacheClass.get('users');
    await userCache.delete(`files:${data.userId}`);

    // Send notification email
    await queue.add('file-processed-email', {
      userId: data.userId,
      fileId: data.fileId,
    });

    processingLogger.info('File processed successfully', {
      fileId: data.fileId,
      userId: data.userId,
    });

    return { processed: true, processedKey };
  } catch (error) {
    processingLogger.error('File processing failed', {
      fileId: data.fileId,
      error: error.message,
    });
    throw error;
  }
});
```

# System Modules 🛡️

> **Application security, error handling, and real-time communication - Error,
> Security, Event**

## ⚠️ ERROR MODULE

### When to Use

✅ **HTTP APIs, status codes, middleware integration, client responses**  
❌ **CLI applications, non-HTTP servers, simple utilities**

### Core Pattern

```javascript
import { errorClass } from '@bloomneo/appkit/error';
const error = errorClass.get();
```

### HTTP Status Code Mapping (CRITICAL)

```javascript
// ✅ CORRECT - Use these exact error types for specific situations
error.badRequest('message'); // 400 - Client input errors
error.unauthorized('message'); // 401 - Authentication required
error.forbidden('message'); // 403 - Access denied (user authenticated, no permission)
error.notFound('message'); // 404 - Resource doesn't exist
error.conflict('message'); // 409 - Business logic conflicts (duplicate email)
error.serverError('message'); // 500 - Internal server errors

// ❌ WRONG - Don't use wrong error types
throw error.serverError('Email required'); // Should be badRequest
throw error.badRequest('Database failed'); // Should be serverError
throw error.unauthorized('Admin required'); // Should be forbidden
```

### Essential API (4 Core Patterns)

```javascript
// 1. Input validation (400 errors)
if (!req.body.email) {
  throw error.badRequest('Email is required');
}
if (!email.includes('@')) {
  throw error.badRequest('Invalid email format');
}

// 2. Authentication checks (401 errors)
if (!token) {
  throw error.unauthorized('Authentication token required');
}
if (tokenExpired) {
  throw error.unauthorized('Session expired. Please login again.');
}

// 3. Permission checks (403 errors)
if (!user.isAdmin) {
  throw error.forbidden('Admin access required');
}
if (user.status === 'suspended') {
  throw error.forbidden('Account suspended');
}

// 4. Resource checks (404 errors)
const user = await database.user.findUnique({ where: { id } });
if (!user) {
  throw error.notFound('User not found');
}
```

### Framework Integration

```javascript
// Express - Error handling middleware (MUST be last)
app.use(error.handleErrors());

// Express - Async route wrapper
app.post(
  '/users',
  error.asyncRoute(async (req, res) => {
    // Errors automatically handled
    if (!req.body.email) throw error.badRequest('Email required');
    res.json({ success: true });
  })
);

// Fastify - Error handler setup
fastify.setErrorHandler((err, request, reply) => {
  const appError = err.statusCode ? err : error.serverError(err.message);
  reply.status(appError.statusCode).send({
    error: appError.type,
    message: appError.message,
  });
});
```

---

## 🔒 SECURITY MODULE

### When to Use

✅ **Web forms, CSRF protection, rate limiting, input sanitization,
encryption**  
❌ **CLI applications, API-only services, read-only applications**

### Core Pattern

```javascript
import { securityClass } from '@bloomneo/appkit/security';
const security = securityClass.get();
```

### Required Environment Variables

```bash
# CRITICAL - Required for startup
VOILA_SECURITY_CSRF_SECRET=your-csrf-secret-key-2024-minimum-32-chars
VOILA_SECURITY_ENCRYPTION_KEY=64-char-hex-key-for-aes256-encryption
```

### Essential API (4 Core Methods)

```javascript
// 1. CSRF Protection (CRITICAL: Session middleware MUST come first)
app.use(session({ secret: process.env.SESSION_SECRET }));
app.use(security.forms()); // CSRF protection for all routes

// Generate CSRF token for forms
app.get('/form', (req, res) => {
  const csrfToken = req.csrfToken();
  res.render('form', { csrfToken });
});

// 2. Rate Limiting
app.use('/api', security.requests()); // Default: 100 requests per 15 minutes
app.use('/auth', security.requests(5, 3600000)); // 5 requests per hour

// 3. Input Sanitization
const safeName = security.input(req.body.name, { maxLength: 50 });
const safeEmail = security.input(req.body.email?.toLowerCase());
const safeHtml = security.html(req.body.content, {
  allowedTags: ['p', 'b', 'i', 'a'],
});

// 4. Data Encryption (AES-256-GCM)
const encryptedSSN = security.encrypt(user.ssn);
const encryptedPhone = security.encrypt(user.phone);

// Decrypt for authorized access
const originalSSN = security.decrypt(encryptedSSN);
const originalPhone = security.decrypt(encryptedPhone);
```

---

## 🚀 EVENT MODULE

### When to Use

✅ **Real-time features, WebSocket connections, pub/sub messaging, live
notifications**  
❌ **HTTP APIs, file transfers, database operations, background jobs**

### Core Pattern

```javascript
import { eventClass } from '@bloomneo/appkit/event';
const event = eventClass.get();
```

### Auto-Strategy Detection

```bash
# Development → Memory-based event emitter
# Production → Redis pub/sub (if REDIS_URL) → Memory
```

### Essential API (6 Core Methods)

```javascript
// 1. on() - Listen to events
event.on('user.login', (data) => {
  console.log(`User ${data.userId} logged in`);
});

// 2. emit() - Send events
await event.emit('user.login', {
  userId: 123,
  timestamp: Date.now(),
  ip: req.ip,
});

// 3. Wildcard patterns
event.on('user.*', (eventName, data) => {
  console.log(`User event: ${eventName}`, data);
});

// 4. once() - One-time listeners
event.once('app.ready', () => {
  console.log('Application is ready');
});

// 5. off() - Remove listeners
event.off('user.login'); // Remove all listeners
event.off('user.login', specificHandler); // Remove specific listener

// 6. namespace() - Isolated event channels
const userEvent = eventClass.get('users');
const orderEvent = eventClass.get('orders');

userEvent.emit('created', data); // → users:created
orderEvent.emit('created', data); // → orders:created
```

---

## SYSTEM MODULES INTEGRATION

```javascript
// Secure real-time application with all system modules
import express from 'express';
import session from 'express-session';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { utilClass } from '@bloomneo/appkit/util';
import { authClass } from '@bloomneo/appkit/auth';
import { errorClass } from '@bloomneo/appkit/error';
import { securityClass } from '@bloomneo/appkit/security';
import { eventClass } from '@bloomneo/appkit/event';
import { loggerClass } from '@bloomneo/appkit/logger';

const app = express();
const server = createServer(app);
const io = new Server(server);

const util = utilClass.get();
const auth = authClass.get();
const error = errorClass.get();
const security = securityClass.get();
const event = eventClass.get('app');
const logger = loggerClass.get('app');

// Security middleware setup (ORDER CRITICAL)
app.use(express.json({ limit: '10mb' }));
app.use(
  session({
    secret: config.getRequired('session.secret'),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: config.isProduction(), httpOnly: true },
  })
);
app.use(security.forms()); // CSRF protection
app.use('/api', security.requests(100, 900000)); // Rate limiting

// Real-time secure messaging endpoint
app.post(
  '/api/messages',
  auth.requireLogin(),
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);
    const { content, roomId } = req.body;

    // Input validation
    if (util.isEmpty(content)) {
      throw error.badRequest('Message content required');
    }
    if (util.isEmpty(roomId)) {
      throw error.badRequest('Room ID required');
    }

    // Sanitize content
    const safeContent = security.html(content, {
      allowedTags: ['b', 'i', 'em', 'strong'],
      maxLength: 1000,
    });

    // Check permissions
    const database = databaseClass.get();
    const room = await database.room.findFirst({
      where: {
        id: roomId,
        members: { some: { userId: user.userId } },
      },
    });

    if (!room) {
      throw error.forbidden('Access to room denied');
    }

    // Save message
    const message = await database.message.create({
      data: {
        content: safeContent,
        userId: user.userId,
        roomId,
        tenant_id: user.tenant_id,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Emit real-time event
    await event.emit('message.created', {
      messageId: message.id,
      content: message.content,
      user: message.user,
      roomId,
      timestamp: message.createdAt,
    });

    // Send via WebSocket
    io.to(`room:${roomId}`).emit('new-message', {
      id: message.id,
      content: message.content,
      user: message.user,
      timestamp: message.createdAt,
    });

    logger.info('Message sent', {
      messageId: message.id,
      userId: user.userId,
      roomId,
    });

    res.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        user: message.user,
        timestamp: message.createdAt,
      },
    });
  })
);

// WebSocket authentication and real-time handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const user = auth.verifyToken(token);
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;

  logger.info('User connected', {
    userId: user.userId,
    socketId: socket.id,
  });

  // Join user to their rooms
  socket.join(`user:${user.userId}`);

  socket.on('join-room', async (roomId) => {
    // Verify user can join room
    const database = databaseClass.get();
    const room = await database.room.findFirst({
      where: {
        id: roomId,
        members: { some: { userId: user.userId } },
      },
    });

    if (room) {
      await socket.join(`room:${roomId}`);
      socket.emit('joined-room', { roomId });

      logger.info('User joined room', {
        userId: user.userId,
        roomId,
      });
    } else {
      socket.emit('error', { message: 'Access denied to room' });
    }
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected', { userId: user.userId });
  });
});

// Event listeners for cross-service communication
event.on('user.registered', async (data) => {
  // Send welcome notification
  io.to(`user:${data.userId}`).emit('notification', {
    type: 'welcome',
    message: 'Welcome to our platform!',
    timestamp: new Date(),
  });
});

// Error handling middleware (MUST be last)
app.use(error.handleErrors());

server.listen(3000, () => {
  logger.info('🚀 Server started with real-time support', { port: 3000 });
});
```

# Production & Complete Examples 🚀

> **Production deployment, complete application examples, and comprehensive
> guidance**

## ENVIRONMENT VALIDATION

### Production Environment Variables

```bash
# ✅ Framework (Required in production)
NODE_ENV=production
VOILA_AUTH_SECRET=your-super-secure-jwt-secret-key-minimum-32-chars
VOILA_SECURITY_CSRF_SECRET=your-csrf-secret-key-minimum-32-chars
VOILA_SECURITY_ENCRYPTION_KEY=64-char-hex-encryption-key-for-aes256

# ✅ Services (Required)
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://user:password@host:6379

# ✅ Email (Choose one)
RESEND_API_KEY=re_your_api_key
# OR SMTP_HOST=smtp.gmail.com

# ✅ Storage (Choose one)
CLOUDFLARE_R2_BUCKET=your-bucket
# OR AWS_S3_BUCKET=your-bucket

# ✅ Application
APP_NAME=Your Production App
APP_URL=https://yourapp.com
```

### Startup Validation Pattern

```javascript
// ALWAYS validate environment at startup
function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['VOILA_AUTH_SECRET', 'DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('✅ Production environment validated');
}

// App initialization
async function initializeApp() {
  try {
    validateProductionEnv();

    const config = configClass.get();
    const logger = loggerClass.get('init');

    // Validate configuration
    config.getRequired('database.url');
    config.getRequired('auth.secret');

    // Initialize database
    const database = databaseClass.get();
    await database.$queryRaw`SELECT 1`;

    logger.info('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ App initialization failed:', error.message);
    process.exit(1);
  }
}
```

---

## GRACEFUL SHUTDOWN

```javascript
// ALWAYS implement graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`🔄 Received ${signal}, shutting down gracefully...`);

  try {
    // Close server first (stop accepting new connections)
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Close services in reverse dependency order
    await queueClass.get().close(); // Stop processing jobs
    await databaseClass.disconnect(); // Close DB connections
    await loggerClass.get().flush(); // Write remaining logs

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For PM2
```

---

## MODULE INITIALIZATION ORDER

```javascript
// ALWAYS follow this exact order:
// 1. Util (no dependencies)
// 2. Config (no dependencies)
// 3. Logger (depends on Config)
// 4. Error (depends on Config + Logger)
// 5. Auth (depends on Config + Error)
// 6. Security (depends on Config + Error)
// 7. Database (depends on Config + Logger + Error)
// 8. Cache (depends on Config + Logger)
// 9. Storage (depends on Config + Logger + Error)
// 10. Email (depends on Config + Logger + Error)
// 11. Queue (depends on Config + Logger + Error)
// 12. Event (depends on Config + Logger + Error)

async function initializeApp() {
  try {
    // 1-2. Core utilities first
    const config = configClass.get();
    const util = utilClass.get();

    // 3-4. Logging and error handling
    const logger = loggerClass.get('init');
    const error = errorClass.get();

    // 5-6. Security modules
    const auth = authClass.get();
    const security = securityClass.get();

    // 7. Database
    const database = databaseClass.get();

    // 8-12. Infrastructure services
    const cache = cacheClass.get('app');
    const storage = storageClass.get();
    const email = emailClass.get();
    const queue = queueClass.get();
    const event = eventClass.get('app');

    logger.info('✅ All modules initialized successfully');
    return {
      config,
      util,
      logger,
      error,
      auth,
      security,
      database,
      cache,
      storage,
      email,
      queue,
      event,
    };
  } catch (error) {
    console.error('❌ Module initialization failed:', error.message);
    process.exit(1);
  }
}
```

---

## COMPLETE PRODUCTION APPLICATION

```javascript
// Complete production-ready Express application
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { createServer } from 'http';

// Import all AppKit modules
import { utilClass } from '@bloomneo/appkit/util';
import { configClass } from '@bloomneo/appkit/config';
import { authClass } from '@bloomneo/appkit/auth';
import { loggerClass } from '@bloomneo/appkit/logger';
import { errorClass } from '@bloomneo/appkit/error';
import { securityClass } from '@bloomneo/appkit/security';
import { databaseClass } from '@bloomneo/appkit/database';
import { cacheClass } from '@bloomneo/appkit/cache';
import { storageClass } from '@bloomneo/appkit/storage';
import { queueClass } from '@bloomneo/appkit/queue';
import { emailClass } from '@bloomneo/appkit/email';
import { eventClass } from '@bloomneo/appkit/event';

const app = express();
const server = createServer(app);
const upload = multer({ storage: multer.memoryStorage() });

// Initialize modules in correct order
const util = utilClass.get();
const config = configClass.get();
const logger = loggerClass.get('app');
const error = errorClass.get();
const auth = authClass.get();
const security = securityClass.get();
const storage = storageClass.get();
const queue = queueClass.get();
const email = emailClass.get();
const event = eventClass.get('app');

// Startup validation
validateProductionEnv();
await initializeApp();

// Middleware setup (ORDER CRITICAL)
app.use(express.json({ limit: '10mb' }));
app.use(
  session({
    secret: config.getRequired('session.secret'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.isProduction(),
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(security.forms()); // CSRF protection
app.use('/api', security.requests(100, 900000)); // Rate limiting

// Request logging
app.use((req, res, next) => {
  req.requestId = util.uuid();
  req.logger = logger.child({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
  });

  const startTime = Date.now();
  res.on('finish', () => {
    req.logger.info('Request completed', {
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
    });
  });

  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const database = databaseClass.get();
    await database.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.getEnvironment(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
    });
  }
});

// Authentication endpoints
app.post(
  '/auth/register',
  error.asyncRoute(async (req, res) => {
    const { email, password, name } = req.body;

    // Input validation
    if (util.isEmpty(email)) throw error.badRequest('Email required');
    if (!email.includes('@')) throw error.badRequest('Invalid email format');
    if (util.isEmpty(password)) throw error.badRequest('Password required');
    if (password.length < 8)
      throw error.badRequest('Password must be 8+ characters');
    if (util.isEmpty(name)) throw error.badRequest('Name required');

    // Sanitize inputs
    const safeEmail = security.input(email.toLowerCase());
    const safeName = security.input(name, { maxLength: 50 });

    // Check for existing user
    const database = databaseClass.get();
    const existingUser = await database.user.findUnique({
      where: { email: safeEmail },
    });

    if (existingUser) {
      throw error.conflict('Email already registered');
    }

    // Create user
    const hashedPassword = await auth.hashPassword(password);
    const user = await database.user.create({
      data: {
        email: safeEmail,
        name: safeName,
        password: hashedPassword,
        role: 'user',
        level: 'basic',
      },
    });

    // Generate token
    const token = auth.signToken({
      userId: user.id,
      role: user.role,
      level: user.level,
    });

    // Queue welcome email
    await queue.add('welcome-email', {
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Emit event
    await event.emit('user.registered', {
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
    });

    req.logger.info('User registered', { userId: user.id });

    res.json({
      success: true,
      token,
      user: util.pick(user, ['id', 'email', 'name']),
    });
  })
);

app.post(
  '/auth/login',
  error.asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (util.isEmpty(email)) throw error.badRequest('Email required');
    if (util.isEmpty(password)) throw error.badRequest('Password required');

    const database = databaseClass.get();
    const user = await database.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) throw error.unauthorized('Invalid credentials');

    const isValid = await auth.comparePassword(password, user.password);
    if (!isValid) throw error.unauthorized('Invalid credentials');

    const token = auth.signToken({
      userId: user.id,
      role: user.role,
      level: user.level,
    });

    // Cache user data
    const userCache = cacheClass.get('users');
    await userCache.set(`user:${user.id}`, user, 3600);

    req.logger.info('User logged in', { userId: user.id });

    res.json({
      success: true,
      token,
      user: util.pick(user, ['id', 'email', 'name']),
    });
  })
);

// File upload endpoint
app.post(
  '/api/upload',
  auth.requireLogin(),
  upload.single('file'),
  error.asyncRoute(async (req, res) => {
    if (!req.file) throw error.badRequest('No file uploaded');

    const user = auth.user(req);

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw error.badRequest('File type not allowed');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      throw error.badRequest('File too large (max 10MB)');
    }

    // Store file
    const fileKey = `uploads/${user.userId}/${Date.now()}-${util.slugify(req.file.originalname)}`;
    await storage.put(fileKey, req.file.buffer, {
      contentType: req.file.mimetype,
    });

    // Save to database
    const database = databaseClass.get();
    const file = await database.file.create({
      data: {
        key: fileKey,
        name: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        userId: user.userId,
      },
    });

    // Queue processing
    await queue.add('process-file', {
      fileId: file.id,
      fileKey,
      userId: user.userId,
    });

    req.logger.info('File uploaded', {
      fileId: file.id,
      size: util.formatBytes(req.file.size),
    });

    res.json({
      success: true,
      file: {
        id: file.id,
        url: storage.url(fileKey),
        name: req.file.originalname,
        size: util.formatBytes(req.file.size),
      },
    });
  })
);

// Protected user endpoint
app.get(
  '/api/profile',
  auth.requireLogin(),
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);
    const userCache = cacheClass.get('users');

    // Try cache first
    let userData = await userCache.get(`user:${user.userId}`);

    if (!userData) {
      const database = databaseClass.get();
      userData = await database.user.findUnique({
        where: { id: user.userId },
        select: { id: true, email: true, name: true, createdAt: true },
      });

      if (userData) {
        await userCache.set(`user:${user.userId}`, userData, 3600);
      }
    }

    if (!userData) throw error.notFound('User not found');

    res.json(userData);
  })
);

// Admin endpoint
app.get(
  '/api/admin/users',
  auth.requireRole('admin.tenant'),
  error.asyncRoute(async (req, res) => {
    const dbTenants = databaseClass.getTenants();
    const users = await dbTenants.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        level: true,
        createdAt: true,
      },
    });

    res.json(users);
  })
);

// Background job processors
queue.process('welcome-email', async (data) => {
  try {
    await email.send({
      to: data.email,
      subject: `Welcome to ${config.get('app.name', 'Our Platform')}!`,
      html: `
        <h1>Welcome ${data.name}!</h1>
        <p>Thanks for joining us. We're excited to have you on board!</p>
        <a href="${config.get('app.url')}/dashboard">Get Started</a>
      `,
    });

    logger.info('Welcome email sent', { userId: data.userId });
    return { sent: true };
  } catch (error) {
    logger.error('Welcome email failed', {
      userId: data.userId,
      error: error.message,
    });
    throw error;
  }
});

queue.process('process-file', async (data) => {
  const processingLogger = loggerClass.get('processing');

  try {
    // Simulate file processing
    await util.sleep(2000);

    const database = databaseClass.get();
    await database.file.update({
      where: { id: data.fileId },
      data: { processed: true, processedAt: new Date() },
    });

    processingLogger.info('File processed', { fileId: data.fileId });
    return { processed: true };
  } catch (error) {
    processingLogger.error('File processing failed', {
      fileId: data.fileId,
      error: error.message,
    });
    throw error;
  }
});

// Error handling middleware (MUST be last)
app.use(error.handleErrors());

// Start server
const port = config.get('server.port', 3000);
const host = config.get('server.host', '0.0.0.0');

server.listen(port, host, () => {
  logger.info('🌟 Server ready', { port, host });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## TESTING PATTERNS

### Test Setup

```javascript
import {
  utilClass,
  loggerClass,
  cacheClass,
  configClass,
  databaseClass,
} from '@bloomneo/appkit';

describe('AppKit Application', () => {
  beforeEach(() => {
    // Force test configuration
    configClass.reset({
      database: { url: 'memory://test' },
      cache: { strategy: 'memory' },
      logging: { level: 'silent' },
    });
  });

  afterEach(async () => {
    // ALWAYS reset module state between tests
    utilClass.clearCache();
    await loggerClass.clear();
    await cacheClass.clear();
    configClass.clearCache();
    await databaseClass.clear();
  });

  test('should handle user registration', async () => {
    const util = utilClass.get();
    const auth = authClass.get();

    const userData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const email = util.get(userData, 'email');
    expect(email).toBe('test@example.com');

    const token = auth.signToken({
      userId: 123,
      role: 'user',
      level: 'basic',
    });

    expect(token).toBeDefined();
  });
});
```

---

## DOCKER DEPLOYMENT

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 3000
CMD ["node", "server.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/app
      - REDIS_URL=redis://redis:6379
      - VOILA_AUTH_SECRET=${VOILA_AUTH_SECRET}
      - VOILA_SECURITY_CSRF_SECRET=${VOILA_SECURITY_CSRF_SECRET}
    ports:
      - '3000:3000'
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## COMMON LLM MISTAKES TO AVOID

```javascript
// ❌ WRONG - Unsafe property access
const name = user.profile.name; // Can crash on undefined

// ✅ CORRECT - Safe access with default
const name = util.get(user, 'profile.name', 'Guest');

// ❌ WRONG - Missing required token fields
auth.signToken({ userId: 123 }); // Missing role/level

// ✅ CORRECT - All required fields
auth.signToken({ userId: 123, role: 'admin', level: 'tenant' });

// ❌ WRONG - Wrong error types
throw error.serverError('Email required'); // Should be badRequest

// ✅ CORRECT - Semantic error types
throw error.badRequest('Email required');
throw error.unauthorized('Login required');
throw error.forbidden('Admin access required');

// ❌ WRONG - Missing tenant_id in schema
CREATE TABLE users (id, email, name); // Will break multi-tenancy

// ✅ CORRECT - Future-proof schema
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text,
  name text,
  tenant_id text,                    -- MANDATORY
  INDEX idx_users_tenant (tenant_id) -- MANDATORY
);

// ❌ WRONG - No startup validation
app.listen(3000, () => {
  console.log('Server started'); // No validation!
});

// ✅ CORRECT - Validate before starting
validateProductionEnv();
initializeApp().then(() => {
  app.listen(3000, () => {
    console.log('✅ Server ready');
  });
});

// ❌ WRONG - No graceful shutdown
process.exit(0); // Abrupt shutdown

// ✅ CORRECT - Graceful shutdown
process.on('SIGTERM', gracefulShutdown);

// ❌ WRONG - No test cleanup
test('should work', () => {
  // No cleanup between tests!
});

// ✅ CORRECT - Proper test cleanup
afterEach(async () => {
  await loggerClass.clear();
  configClass.clearCache();
});
```

---

## 📋 COMPREHENSIVE CHECKLIST FOR LLMs

### **Module Usage**

- [ ] Always use `moduleClass.get()` pattern
- [ ] Use exact object names from reference table (singular, matches module
      name)
- [ ] Use namespace suffixes only for cache
      (`userCache = cacheClass.get('users')`)
- [ ] Follow dependency order for initialization

### **Essential Modules**

- [ ] Use `util.get()` for safe property access
- [ ] Include `userId`, `role`, `level` in JWT tokens (all required)
- [ ] Use `config.getRequired()` for critical configuration
- [ ] Follow UPPER_SNAKE_CASE → dot.notation convention
- [ ] Use component-specific loggers (`loggerClass.get('component')`)
- [ ] Log with structured data, not just messages

### **Infrastructure Modules**

- [ ] Include `tenant_id` field in ALL database tables with index
- [ ] Use appropriate database access pattern (normal vs admin vs org)
- [ ] Use specific cache namespaces with getOrSet pattern
- [ ] Queue heavy operations instead of blocking requests
- [ ] Handle file uploads with proper error handling
- [ ] Cache frequently accessed data with appropriate TTL

### **System Modules**

- [ ] Use semantic error types (`badRequest`, `unauthorized`, `forbidden`,
      `notFound`, `serverError`)
- [ ] Put session middleware BEFORE CSRF protection
- [ ] Put error handling middleware LAST in Express
- [ ] Wrap async routes with `error.asyncRoute()`
- [ ] Always sanitize user input with `security.input()` and `security.html()`
- [ ] Set required security environment variables

### **Production Deployment**

- [ ] Validate environment variables at startup
- [ ] Implement graceful shutdown for all production apps
- [ ] Set up proper middleware order (session → CSRF → rate limiting → error
      handling)
- [ ] Test database connections before starting server
- [ ] Use structured logging with request IDs
- [ ] Handle Docker signals properly (SIGTERM, SIGINT)
- [ ] Set all required environment variables for production

### **Testing**

- [ ] Reset module state between tests (`utilClass.clearCache()`, etc.)
- [ ] Use proper test cleanup in afterEach
- [ ] Force test configuration with `configClass.reset()`
- [ ] Clean up resources (database, cache, logger)

### **Framework Integration**

- [ ] Use `auth.requireLogin()` and `auth.requireRole()` middleware correctly
- [ ] Apply rate limiting on public endpoints
- [ ] Encrypt sensitive data before storing in database
- [ ] Log important operations with structured data
- [ ] Implement proper health check endpoints
