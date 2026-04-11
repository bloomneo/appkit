# Bloomneo AppKit 🚀

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AI Ready](https://img.shields.io/badge/AI-Optimized-purple.svg)](https://github.com/bloomneo/appkit)

> Previously published as `@voilajsx/appkit`. Same code, new home, new namespace. See the [migration note](#scope-change) below.

> **Minimal and framework agnostic Node.js toolkit designed for AI agentic
> backend development**

**Zero configuration. Enterprise features by default. Optimized for both human
developers and AI code generation.**

## 🚀 What Bloomneo AppKit Really Is

Bloomneo AppKit is a **complete Node.js development toolkit** that eliminates
the complexity of building production-ready applications. Instead of juggling
dozens of libraries and configuration files, you get 12 integrated modules that
work together seamlessly.

### **How Developers Can Leverage AppKit**

**🎯 For Rapid Development**

- **One function per module**: `authClass.get()`, `databaseClass.get()`,
  `securityClass.get()`
- **Instant setup**: No configuration files, just environment variables
- **Production patterns**: Enterprise-grade security and scalability built-in

**🏗️ For Maintainable Architecture**

- **Consistent APIs**: Same `{moduleClass}.get()` pattern across all modules
- **Progressive complexity**: Start simple, scale to enterprise automatically
- **Type-safe**: Full TypeScript support with intelligent IntelliSense

**⚡ For Performance**

- **Smart defaults**: Memory caching, connection pooling, resource management
- **Auto-scaling**: Modules automatically upgrade (Memory → Redis → Database)
- **Optimized**: Battle-tested patterns for high-throughput applications

## 🤖 Enhanced for AI-Driven Development

While perfectly designed for human developers, AppKit excels in AI-assisted
development:

- **🎯 Predictable Code Generation**: AI agents generate consistent, working
  applications
- **📝 LLM-Optimized Documentation**: Every function includes clear usage
  patterns
- **🔒 Built-in Best Practices**: Security, scalability, and maintainability by
  default
- **⚙️ Non-Ambiguous APIs**: Clear function signatures prevent common mistakes

### **Why This Matters for Developers**

| Traditional Approach                      | Bloomneo AppKit Approach                |
| ----------------------------------------- | --------------------------------------- |
| Research → Configure → Integrate → Secure | **Import → Use → Deploy**               |
| Multiple libraries, version conflicts     | **Integrated modules, tested together** |
| Manual scaling decisions                  | **Environment-driven auto-scaling**     |
| Security implemented later                | **Security enabled by default**         |
| Inconsistent error handling               | **Unified error patterns**              |

## 🏢 Enterprise Benefits

### **Progressive Complexity**

```typescript
// Day 1: Simple development
const auth = authClass.get();
const token = auth.signToken({ userId: 123, role: 'user', level: 'basic' });

// Month 6: Multi-tenant (just add environment variable)
// VOILA_DB_TENANT=auto
const database = await databaseClass.get(); // Now auto-filtered by tenant

// Year 1: Multi-organization enterprise (same code)
// ORG_ACME=postgresql://acme.aws.com/prod
const acmeDatabase = await databaseClass.org('acme').get(); // Enterprise scaling
```

## 🚀 Quick Start

**Two Ways to Use AppKit:**

**📦 As a Library** - Install AppKit modules into your existing Node.js/Express projects (NestJS, Fastify, Koa, etc.):
```bash
npm install @bloomneo/appkit
```
Import modules directly: `import { authClass, databaseClass } from '@bloomneo/appkit'`

**🚀 Complete Microservice Scaffolding** - Use AppKit CLI to generate enterprise-ready backend applications:

```bash
# Step 1: Install AppKit CLI globally
npm install -g @bloomneo/appkit

# Check if you have the latest version
npm list -g @bloomneo/appkit

# Step 2: Create your app
appkit generate app myproject
cd myproject && npm run dev:api
```

**Done.** Your API is running with authentication, database, and enterprise features ready at http://localhost:3000/api

### **Add Features Instantly**

```bash
# Add custom feature
appkit generate feature product

# Add complete authentication system
appkit generate feature user

# Add database-enabled feature
appkit generate feature order --db
```

### **Library Integration Example**

```bash
# For library usage in existing projects
npm install @bloomneo/appkit
```

```typescript
import { authClass } from '@bloomneo/appkit/auth';
import { databaseClass } from '@bloomneo/appkit/database';
import { errorClass } from '@bloomneo/appkit/error';
import { loggerClass } from '@bloomneo/appkit/logger';

const auth = authClass.get();
const database = await databaseClass.get();
const error = errorClass.get();
const logger = loggerClass.get('api');

// Protected API endpoint
app.post(
  '/api/users',
  auth.requireRole('admin.tenant'),
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);

    if (!req.body.email) {
      throw error.badRequest('Email required');
    }

    const newUser = await database.user.create({ data: req.body });
    logger.info('User created', { userId: newUser.id });

    res.json({ user: newUser });
  })
);

// Error handling middleware (must be last)
app.use(error.handleErrors());
```

**Result**: Production-ready API with authentication, database, error handling,
and logging. **Zero configuration needed.**

## 🛠️ AppKit CLI

### **Project Generation**

```bash
# Create complete backend application
appkit generate app [name]

# What you get:
# ✅ TypeScript setup with proper configuration
# ✅ Express server with auto-discovery routing
# ✅ Environment variables with secure random keys
# ✅ Database integration ready
# ✅ Complete documentation included
# ✅ Production-ready npm scripts
```

### **Feature Generation**

```bash
# Basic feature (route + service + types)
appkit generate feature product

# Database-enabled feature (+ model + HTTP tests)
appkit generate feature order --db

# Complete authentication system (9-role hierarchy)
appkit generate feature user
```

### **Generated Project Structure**

```
myproject/
├── docs/                         # Complete documentation
│   ├── APPKIT_CLI.md            # CLI reference
│   ├── APPKIT_LLM_GUIDE.md      # AI integration guide
│   └── APPKIT_COMMENTS_GUIDELINES.md # Code standards
├── src/api/
│   ├── server.ts                # Main server
│   ├── lib/api-router.ts        # Auto-discovery routing
│   └── features/                # Feature-based architecture
│       ├── welcome/             # Default endpoints
│       └── [your-features]/     # Generated features
├── .env                         # Secure environment variables
├── package.json                 # With backend scripts
└── README.md                    # Project-specific guide
```

## 🎭 Complete Module Ecosystem

| #   | Module                                  | Category                | Purpose                                               | Details                                                                                                                                   |
| --- | --------------------------------------- | ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **[Auth](/src/auth/README.md)**         | 🔧 Infrastructure       | JWT tokens, dual token system, role-level permissions | `authClass.get()` - Login tokens (users) + API tokens (services), role.level hierarchy (user.basic → admin.system), automatic inheritance |
| 2   | **[Database](/src/database/README.md)** | 🔧 Infrastructure       | Multi-tenant, progressive scaling                     | `databaseClass.get()` - Auto-tenant filtering, org management (.org()), mandatory future-proofing with tenant_id                          |
| 3   | **[Security](/src/security/README.md)** | 🔧 Infrastructure       | CSRF, rate limiting, encryption                       | `securityClass.get()` - Enterprise-grade by default, AES-256-GCM encryption, input sanitization                                           |
| 4   | **[Error](/src/error/README.md)**       | 🔧 Infrastructure       | HTTP status codes, semantic errors                    | `errorClass.get()` - Framework-agnostic middleware, semantic error types (badRequest, unauthorized)                                       |
| 5   | **[Cache](/src/cache/README.md)**       | 📊 Data & Communication | Memory → Redis auto-scaling                           | `cacheClass.get('namespace')` - Namespace isolation, TTL management, getOrSet pattern                                                     |
| 6   | **[Storage](/src/storage/README.md)**   | 📊 Data & Communication | Local → S3/R2 auto-scaling                            | `storageClass.get()` - CDN integration, signed URLs, automatic provider detection                                                         |
| 7   | **[Queue](/src/queue/README.md)**       | 📊 Data & Communication | Memory → Redis → DB scaling                           | `queueClass.get()` - Background jobs, scheduling, retry logic with exponential backoff                                                    |
| 8   | **[Email](/src/email/README.md)**       | 📊 Data & Communication | Console → SMTP → Resend                               | `emailClass.get()` - Templates, multi-provider, automatic strategy selection                                                              |
| 9   | **[Event](/src/event/README.md)**       | 📊 Data & Communication | Memory → Redis distribution                           | `eventClass.get('namespace')` - Real-time, pub/sub, wildcard patterns (user.\*)                                                           |
| 10  | **[Util](/src/util/README.md)**         | 🛠️ Developer Experience | 12 essential utilities                                | `utilClass.get()` - Safe property access (get), performance helpers (debounce, chunk)                                                     |
| 11  | **[Config](/src/config/README.md)**     | 🛠️ Developer Experience | Environment variables                                 | `configClass.get()` - Type-safe, UPPER_SNAKE_CASE convention, validation included                                                         |
| 12  | **[Logger](/src/logger/README.md)**     | 🛠️ Developer Experience | Structured logging                                    | `loggerClass.get('component')` - Multi-transport, auto-scaling (Console → File → HTTP)                                                    |

### **Category Summary**

- **🔧 Infrastructure (4 modules)**: Core application foundation - auth,
  database, security, error handling
- **📊 Data & Communication (5 modules)**: Data flow and external interactions -
  cache, storage, queue, email, events
- **🛠️ Developer Experience (3 modules)**: Development productivity - utilities,
  configuration, logging

## 🌍 Environment-Driven Progressive Scaling

### **Development** (Zero Configuration)

```bash
npm start  # Memory cache, local storage, console logs
```

### **Production** (Auto-Detection)

```bash
# Set these environment variables - everything scales automatically
DATABASE_URL=postgresql://prod-db/app     # → Database persistence
REDIS_URL=redis://prod-cache:6379         # → Distributed cache/queue
AWS_S3_BUCKET=prod-assets                 # → Cloud storage + CDN
RESEND_API_KEY=re_production_key          # → Professional email
VOILA_DB_TENANT=auto                      # → Multi-tenant mode
```

**Same code. Different environment. Enterprise features automatically enabled.**

## 🏢 Enterprise-Ready Examples

### **Multi-Tenant SaaS API**

```typescript
import { authClass } from '@bloomneo/appkit/auth';
import { databaseClass } from '@bloomneo/appkit/database';
import { securityClass } from '@bloomneo/appkit/security';
import { cacheClass } from '@bloomneo/appkit/cache';

const auth = authClass.get();
const database = await databaseClass.get(); // Auto-filtered by tenant
const security = securityClass.get();
const cache = cacheClass.get('api');

// User endpoint (tenant-isolated)
app.get(
  '/api/users',
  auth.requireLogin(),
  security.requests(100, 900000), // Rate limiting
  async (req, res) => {
    const users = await cache.getOrSet(
      'users',
      async () => {
        return await database.user.findMany(); // Only current tenant
      },
      300
    );

    res.json(users);
  }
);

// Admin endpoint (cross-tenant access)
app.get(
  '/api/admin/analytics',
  auth.requireRole('admin.system'),
  async (req, res) => {
    const dbTenants = await databaseClass.getTenants(); // All tenants
    const stats = await dbTenants.user.groupBy({
      by: ['tenant_id'],
      _count: true,
    });

    res.json(stats);
  }
);
```

### **Real-Time Chat Application**

```typescript
import { eventClass } from '@bloomneo/appkit/event';
import { authClass } from '@bloomneo/appkit/auth';
import { databaseClass } from '@bloomneo/appkit/database';

const events = eventClass.get();
const auth = authClass.get();
const database = await databaseClass.get();

// Handle user connections
events.on('user.connected', async (data) => {
  const { userId, socketId } = data;

  // Join user to their rooms
  await events.emit('socket.join', {
    socketId,
    rooms: [`user:${userId}`, `tenant:${data.tenantId}`],
  });
});

// Handle chat messages
events.on('message.send', async (data) => {
  const message = await database.message.create({
    data: {
      content: data.content,
      userId: data.userId,
      roomId: data.roomId,
    },
  });

  // Broadcast to room (tenant-isolated)
  await events.emit('message.broadcast', {
    roomId: data.roomId,
    message: {
      id: message.id,
      content: message.content,
      user: { name: data.userName },
      timestamp: message.createdAt,
    },
  });
});

// REST API integration
app.post('/api/notifications', auth.requireLogin(), async (req, res) => {
  const user = auth.user(req);

  // Send real-time notification
  await events.emit('notification.send', {
    userId: user.userId,
    type: 'info',
    message: req.body.message,
    timestamp: new Date(),
  });

  res.json({ sent: true });
});
```

### **File Upload with Background Processing**

```typescript
import { storageClass } from '@bloomneo/appkit/storage';
import { queueClass } from '@bloomneo/appkit/queue';
import { loggerClass } from '@bloomneo/appkit/logger';
import { securityClass } from '@bloomneo/appkit/security';

const storage = storageClass.get();
const queue = queueClass.get();
const logger = loggerClass.get('upload');
const security = securityClass.get();

// File upload with background processing
app.post(
  '/upload',
  security.requests(10, 60000), // 10 uploads per minute
  async (req, res) => {
    // Sanitize filename
    const safeName = security.input(req.file.originalname);
    const key = `uploads/${Date.now()}-${safeName}`;

    // Store file (auto-detects Local/S3/R2)
    await storage.put(key, req.file.buffer, {
      contentType: req.file.mimetype,
    });

    // Queue background processing
    await queue.add('process-image', {
      key,
      userId: req.user.id,
      originalName: req.file.originalname,
    });

    logger.info('File uploaded', { key, userId: req.user.id });

    res.json({
      url: storage.url(key),
      key,
      processing: true,
    });
  }
);

// Background processing
queue.process('process-image', async (data) => {
  const logger = loggerClass.get('processor');

  try {
    const buffer = await storage.get(data.key);

    // Process image (resize, optimize, etc.)
    const processed = await processImage(buffer);

    // Store processed version
    const processedKey = data.key.replace('.', '-processed.');
    await storage.put(processedKey, processed);

    logger.info('Image processed', {
      original: data.key,
      processed: processedKey,
    });

    return { processedKey };
  } catch (error) {
    logger.error('Processing failed', {
      key: data.key,
      error: error.message,
    });
    throw error;
  }
});
```

## 🤖 AI Agent Integration Examples

### **Prompt for Complete Auth System**

```
Create a Node.js API with user authentication, role-based access control,
and protected admin routes using Bloomneo AppKit.
```

**AI Agent Output** (guaranteed to work):

```typescript
import { authClass } from '@bloomneo/appkit/auth';
import { errorClass } from '@bloomneo/appkit/error';
import { databaseClass } from '@bloomneo/appkit/database';
import { loggerClass } from '@bloomneo/appkit/logger';

const auth = authClass.get();
const error = errorClass.get();
const database = await databaseClass.get();
const logger = loggerClass.get('auth');

// Login endpoint
app.post(
  '/auth/login',
  error.asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw error.badRequest('Email and password required');
    }

    const user = await database.user.findUnique({ where: { email } });
    if (!user) {
      throw error.unauthorized('Invalid credentials');
    }

    const isValid = await auth.comparePassword(password, user.password);
    if (!isValid) {
      throw error.unauthorized('Invalid credentials');
    }

    // Generate login token for user authentication
    const loginToken = auth.generateLoginToken({
      userId: user.id,
      role: user.role,
      level: user.level,
    });

    logger.info('User logged in', { userId: user.id });
    res.json({ token: loginToken, user: { id: user.id, email: user.email } });
  })
);

// Create API token for external service
app.post(
  '/admin/api-tokens',
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const { keyId, permissions } = req.body;

    // Generate API token for service authentication
    const apiToken = auth.generateApiToken(
      {
        keyId,
        role: 'service',
        level: 'external',
        permissions,
      },
      '1y'
    );

    res.json({ apiToken });
  })
);

// Protected user route (requires login token)
app.get(
  '/api/profile',
  auth.requireLoginToken(),
  error.asyncRoute(async (req, res) => {
    const user = auth.user(req);
    const profile = await database.user.findUnique({
      where: { id: user.userId },
    });
    res.json(profile);
  })
);

// Admin-only route (requires login token + admin role)
app.get(
  '/api/admin/users',
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const users = await database.user.findMany();
    res.json(users);
  })
);

// API endpoint (requires API token)
app.post(
  '/webhook/data',
  auth.requireApiToken(),
  error.asyncRoute(async (req, res) => {
    const token = auth.user(req);
    logger.info('Webhook received', { keyId: token.keyId });
    res.json({ received: true });
  })
);

// Error handling middleware (must be last)
app.use(error.handleErrors());
```

### **Prompt for Multi-Tenant Data API**

```
Build a multi-tenant API where users can only see their organization's data,
but admins can access all organizations.
```

**AI Agent Output**:

```typescript
import { databaseClass } from '@bloomneo/appkit/database';
import { authClass } from '@bloomneo/appkit/auth';
import { errorClass } from '@bloomneo/appkit/error';

const auth = authClass.get();
const error = errorClass.get();

// User data (tenant-isolated)
app.get(
  '/api/projects',
  auth.requireLogin(),
  error.asyncRoute(async (req, res) => {
    const database = await databaseClass.get(); // Auto-filtered by user's tenant
    const projects = await database.project.findMany({
      include: { tasks: true },
    });
    res.json(projects); // Only current tenant's projects
  })
);

// Admin data (cross-tenant)
app.get(
  '/api/admin/all-projects',
  auth.requireRole('admin.system'),
  error.asyncRoute(async (req, res) => {
    const dbTenants = await databaseClass.getTenants(); // All tenants
    const allProjects = await dbTenants.project.findMany({
      include: {
        tasks: true,
        _count: { select: { tasks: true } },
      },
    });
    res.json(allProjects); // All organizations' projects
  })
);

// Organization-specific admin access
app.get(
  '/api/admin/org/:orgId/projects',
  auth.requireRole('admin.org'),
  error.asyncRoute(async (req, res) => {
    const { orgId } = req.params;
    const orgDatabase = await databaseClass.org(orgId).get();
    const projects = await orgDatabase.project.findMany();
    res.json(projects); // Specific organization's projects
  })
);
```

## 🚀 Production Deployment

### **Required Environment Variables**

```bash
# Core Security (Required)
VOILA_AUTH_SECRET=your-super-secure-jwt-secret-minimum-32-chars

# Database (Required)
DATABASE_URL=postgresql://user:pass@host:5432/database

# Production Services (Auto-detected)
REDIS_URL=redis://user:pass@host:6379
AWS_S3_BUCKET=your-bucket
RESEND_API_KEY=re_your_api_key
VOILA_SECURITY_CSRF_SECRET=your-csrf-secret-32-chars

# Multi-tenancy (Optional)
VOILA_DB_TENANT=auto

# Organization Scaling (Optional)
ORG_ACME=postgresql://acme.dedicated.aws.com/prod
ORG_STARTUP=mongodb://startup.azure.com/db
```

### **Docker Production Setup**

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

### **Kubernetes Deployment**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voila-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voila-app
  template:
    metadata:
      labels:
        app: voila-app
    spec:
      containers:
        - name: app
          image: my-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: redis-url
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
```

## 📊 Performance & Scalability

### **Benchmarks**

- **Startup Time**: < 100ms (all modules loaded)
- **Memory Usage**: < 50MB baseline (production)
- **Request Throughput**: 10,000+ req/sec (with Redis)
- **Database Connections**: Automatic pooling and management

### **Scaling Characteristics**

| Environment     | Cache         | Storage     | Queue         | Database      |
| --------------- | ------------- | ----------- | ------------- | ------------- |
| **Development** | Memory        | Local       | Memory        | Single        |
| **Staging**     | Redis         | S3          | Redis         | Single        |
| **Production**  | Redis Cluster | S3/R2 + CDN | Redis Cluster | Read Replicas |
| **Enterprise**  | Multi-region  | Multi-cloud | Distributed   | Multi-tenant  |

## 🧪 Testing & Quality

### **Testing Setup**

```typescript
import { utilClass } from '@bloomneo/appkit/util';
import { loggerClass } from '@bloomneo/appkit/logger';
import { cacheClass } from '@bloomneo/appkit/cache';
import { databaseClass } from '@bloomneo/appkit/database';
import { authClass } from '@bloomneo/appkit/auth';

describe('API Tests', () => {
  beforeEach(() => {
    // Reset modules for clean tests
    utilClass.clearCache();
  });

  afterEach(async () => {
    // Clean up resources
    await loggerClass.clear();
    await cacheClass.clear();
    await databaseClass.clear();
  });

  test('should handle user creation safely', async () => {
    const auth = authClass.get();
    const util = utilClass.get();

    const userData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    // Test safe property access
    const email = util.get(userData, 'email');
    expect(email).toBe('test@example.com');

    // Test JWT token creation
    const token = auth.signToken({
      userId: 123,
      role: 'user',
      level: 'basic',
    });

    expect(token).toBeDefined();

    // Test token verification
    const payload = auth.verifyToken(token);
    expect(payload.userId).toBe(123);
  });
});
```

### **Code Quality Standards**

- **100% TypeScript**: Full type safety across all modules
- **Comprehensive Tests**: Unit, integration, and e2e testing
- **Security Audits**: Regular dependency and vulnerability scanning
- **Performance Monitoring**: Built-in metrics and observability

## 🔍 SEO & Discovery

### **Keywords & Technologies**

- **Node.js Framework**: Enterprise-grade backend development
- **AI Code Generation**: LLM-optimized, agentic programming
- **Multi-tenant SaaS**: Progressive scaling, organization management
- **Zero Configuration**: Environment-driven, production-ready
- **TypeScript Ready**: Full type safety, modern development
- **Microservices**: Modular architecture, independent scaling
- **JWT Authentication**: Role-based access control, security
- **Real-time Applications**: WebSocket support, event-driven, pub/sub
- **Cloud Native**: Docker, Kubernetes, auto-scaling
- **Developer Experience**: Fast development, maintainable code

### **Use Cases**

- **SaaS Applications**: Multi-tenant, progressive scaling
- **API Backends**: RESTful, GraphQL, real-time
- **E-commerce Platforms**: Payments, inventory, user management
- **Content Management**: File handling, media processing
- **Enterprise Applications**: Security, compliance, audit trails
- **Microservices**: Independent, scalable, maintainable
- **AI Applications**: LLM integration, automated workflows
- **Startup MVPs**: Rapid development, production-ready

## 📚 Learning Resources

### **Quick References**

- [🚀 CLI Reference](docs/APPKIT_CLI.md) - Complete command guide and usage
  examples
- [🤖 LLM Integration Guide](docs/APPKIT_LLM_GUIDE.md) - AI development patterns
  and module usage
- [📝 Code Standards](docs/APPKIT_COMMENTS_GUIDELINES.md) - Documentation
  guidelines for backend apps

### **Module Documentation**

- [Authentication & Authorization](/src/auth/README.md) - Dual token system,
  role.level hierarchy, automatic inheritance
- [Database & Multi-tenancy](/src/database/README.md) - Progressive scaling,
  organizations
- [File Storage & CDN](/src/storage/README.md) - Local to cloud, automatic
  optimization
- [Caching & Performance](/src/cache/README.md) - Memory to Redis, namespace
  isolation
- [Background Jobs](/src/queue/README.md) - Processing, scheduling, reliability
- [Email & Communications](/src/email/README.md) - Multi-provider, templates
- [Real-time Events](/src/event/README.md) - WebSocket, pub/sub, notifications
- [Security & Compliance](/src/security/README.md) - CSRF, encryption, rate
  limiting
- [Error Handling](/src/error/README.md) - HTTP status codes, semantic errors
- [Logging & Observability](/src/logger/README.md) - Structured, multi-transport
- [Configuration Management](/src/config/README.md) - Environment-driven,
  type-safe
- [Utilities & Helpers](/src/util/README.md) - 12 essential developer tools

## 🌟 Community & Support

### **Getting Help**

- 🐙 [GitHub Issues](https://github.com/bloomneo/appkit/issues) - Bug reports
  and feature requests
- 📧 [Email Support](mailto:kt@voilacode.com) - Direct support for enterprises

### **Contributing**

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for:

- 🐛 Bug fixes and improvements
- 📝 Documentation enhancements
- ✨ New module features
- 🧪 Test coverage improvements
- 💡 Feature suggestions

<a id="scope-change"></a>

## 🔁 Scope change (1.2.9)

This package was previously published as **`@voilajsx/appkit`**. Starting with `1.2.9` it lives at **`@bloomneo/appkit`**. The old package on npm is frozen at `1.2.8` and will not receive further updates.

**Migration:**

```diff
- npm install @voilajsx/appkit
+ npm install @bloomneo/appkit
```

```diff
- import { authClass } from '@voilajsx/appkit/auth';
+ import { authClass } from '@bloomneo/appkit/auth';
```

A project-wide find-and-replace of `@voilajsx/appkit` → `@bloomneo/appkit` is sufficient. The API surface, props, types, and behavior are identical between the two scopes — only the namespace changed.

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo) — See [LICENSE](LICENSE) for
details.

---

<p align="center">
  <strong>🚀 Built for the AI-first future of software development</strong><br>
  <strong>Where enterprise applications are generated, not written</strong><br><br>
  <a href="https://github.com/bloomneo/appkit">⭐ Star us on GitHub</a> 
</p>

---

### **🔖 Tags**

`nodejs` `typescript` `framework` `ai-ready` `enterprise` `multi-tenant` `saas`
`microservices` `jwt-authentication` `zero-config` `production-ready`
`agentic-ai` `llm-optimized` `progressive-scaling` `real-time` `websocket`
`pub-sub` `developer-experience`
