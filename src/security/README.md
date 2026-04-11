# @bloomneo/appkit - Security Module 🔒

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple enterprise security that just works

**One function** returns a security object with enterprise-grade protection.
Zero configuration needed, production-ready by default, with built-in CSRF
protection, rate limiting, input sanitization, and AES-256-GCM encryption.

## 🚀 Why Choose This?

- **⚡ One Function** - Just `securityClass.get()`, everything else is automatic
- **🔒 Enterprise Security** - Production-grade CSRF, rate limiting, encryption
- **🔧 Zero Configuration** - Smart defaults with environment variable override
- **🌍 Environment-First** - Auto-detects from `VOILA_SECURITY_*` variables
- **🛡️ Complete Protection** - CSRF, XSS, rate limiting, data encryption
- **🎯 Framework Ready** - Express middleware with proper headers
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

### 1. Environment Variables

```bash
# Essential security configuration
VOILA_SECURITY_CSRF_SECRET=your-csrf-secret-key-2024-minimum-32-chars
VOILA_SECURITY_ENCRYPTION_KEY=64-char-hex-key-for-aes256-encryption
```

### 2. Basic Setup

```typescript
import express from 'express';
import session from 'express-session';
import { securityClass } from '@bloomneo/appkit/security';

const app = express();
const security = securityClass.get();

// Session middleware (required for CSRF)
app.use(session({ secret: process.env.SESSION_SECRET }));

// Security middleware
app.use(secure.forms()); // CSRF protection
app.use('/api', secure.requests()); // Rate limiting

// Secure route
app.post('/profile', (req, res) => {
  const safeName = secure.input(req.body.name);
  const safeBio = secure.html(req.body.bio, { allowedTags: ['p', 'b'] });
  const encryptedSSN = secure.encrypt(req.body.ssn);

  // Save to database...
  res.json({ success: true });
});
```

## 🧠 Mental Model

### Security Layer Architecture

```
Request → CSRF Check → Rate Limit → Input Sanitization → Business Logic
```

### Protection Types

```typescript
// Form Protection (CSRF)
secure.forms(); // Prevents cross-site request forgery

// Traffic Protection (Rate Limiting)
secure.requests(); // Prevents abuse and brute force

// Input Protection (XSS Prevention)
secure.input(text); // Cleans user text input
secure.html(content); // Sanitizes HTML content

// Data Protection (Encryption)
secure.encrypt(data); // AES-256-GCM encryption
secure.decrypt(data); // Authenticated decryption
```

## 🤖 LLM Quick Reference - Copy These Patterns

### **Basic Security Setup (Copy Exactly)**

```typescript
// ✅ CORRECT - Complete security setup
import { securityClass } from '@bloomneo/appkit/security';
const security = securityClass.get();

// Required order
app.use(session({ secret: process.env.SESSION_SECRET }));
app.use(secure.forms()); // CSRF protection
app.use('/api', secure.requests()); // Rate limiting

// Form with CSRF token
app.get('/form', (req, res) => {
  const csrfToken = req.csrfToken();
  res.render('form', { csrfToken });
});

// Secure input processing
app.post('/form', (req, res) => {
  const clean = secure.input(req.body.data);
  const safeHtml = secure.html(req.body.content, { allowedTags: ['p'] });
  const encrypted = secure.encrypt(req.body.sensitive);
  // Process...
});
```

### **Different Rate Limits (Copy These)**

```typescript
// ✅ CORRECT - Endpoint-specific limits
app.use('/api', secure.requests(100, 900000)); // 100/15min
app.use('/auth', secure.requests(5, 3600000)); // 5/hour
app.post('/upload', secure.requests(10), handler); // 10/15min
```

### **Input Sanitization (Copy These)**

```typescript
// ✅ CORRECT - Clean all user input
const safeName = secure.input(req.body.name, { maxLength: 50 });
const safeEmail = secure.input(req.body.email?.toLowerCase());
const safeContent = secure.html(req.body.content, {
  allowedTags: ['p', 'b', 'i', 'a'],
});
const safeDisplay = secure.escape(userText);
```

### **Encryption Patterns (Copy These)**

```typescript
// ✅ CORRECT - Encrypt sensitive data
const encryptedSSN = secure.encrypt(user.ssn);
const encryptedPhone = secure.encrypt(user.phone);

// ✅ CORRECT - Decrypt for authorized access
const originalSSN = secure.decrypt(encryptedSSN);
const originalPhone = secure.decrypt(encryptedPhone);

// ✅ CORRECT - Generate keys
const newKey = secure.generateKey(); // For production use
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Wrong Middleware Order**

```typescript
// ❌ WRONG - CSRF without sessions
app.use(secure.forms());
app.use(session(config)); // Too late!

// ✅ CORRECT - Sessions first
app.use(session(config));
app.use(secure.forms());
```

### **Raw Input Storage**

```typescript
// ❌ WRONG - Store raw user input
await db.save({ content: req.body.content });

// ✅ CORRECT - Clean first
const clean = secure.input(req.body.content);
await db.save({ content: clean });
```

### **Missing CSRF Tokens**

```typescript
// ❌ WRONG - Form without CSRF
res.send('<form method="POST">...');

// ✅ CORRECT - Include CSRF token
const csrfToken = req.csrfToken();
res.send(
  `<form method="POST"><input type="hidden" name="_csrf" value="${csrfToken}">...`
);
```

### **Unsafe Output Display**

```typescript
// ❌ WRONG - Direct user content
res.send(`<p>User: ${userComment}</p>`);

// ✅ CORRECT - Escape output
const safe = secure.escape(userComment);
res.send(`<p>User: ${safe}</p>`);
```

## 🚨 Error Handling Patterns

### **Startup Validation**

```typescript
// ✅ App startup validation
try {
  securityClass.validateRequired({ csrf: true, encryption: true });
  console.log('✅ Security validation passed');
} catch (error) {
  console.error('❌ Security failed:', error.message);
  process.exit(1);
}
```

### **Runtime Error Handling**

```typescript
// ✅ Safe configuration access
function getDatabaseConfig() {
  try {
    return {
      host: config.getRequired('database.host'),
      ssl: config.get('database.ssl', false),
    };
  } catch (error) {
    throw new Error(`Database config error: ${error.message}`);
  }
}
```

## 🎯 Usage Examples

### **User Registration**

```typescript
app.post('/auth/register', secure.requests(10, 3600000), async (req, res) => {
  // Clean input
  const email = secure.input(req.body.email?.toLowerCase());
  const name = secure.input(req.body.name, { maxLength: 50 });

  // Validate
  if (!email || !name || !req.body.password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(req.body.password, 12);

  // Encrypt sensitive data
  const encryptedPhone = req.body.phone ? secure.encrypt(req.body.phone) : null;

  // Save user
  const user = await createUser({
    email,
    name,
    password: hashedPassword,
    phone: encryptedPhone,
  });
  res.status(201).json({ user: { id: user.id, email, name } });
});
```

### **Blog Post Creation**

```typescript
app.post('/api/posts', async (req, res) => {
  // Sanitize content
  const title = secure.input(req.body.title, { maxLength: 200 });
  const content = secure.html(req.body.content, {
    allowedTags: ['p', 'h1', 'h2', 'b', 'i', 'a', 'ul', 'ol', 'li'],
  });

  // Validate
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content required' });
  }

  // Create post
  const post = await createBlogPost({ title, content, authorId: req.user.id });
  res.status(201).json({ post });
});
```

### **Comment System**

```typescript
app.post(
  '/api/posts/:id/comments',
  secure.requests(5, 300000),
  async (req, res) => {
    const postId = secure.input(req.params.id);
    const content = secure.html(req.body.content, {
      allowedTags: ['p', 'b', 'i'],
    });

    if (!content || content.length < 10) {
      return res.status(400).json({ error: 'Comment too short' });
    }

    const comment = await createComment({
      postId: parseInt(postId),
      content,
      authorId: req.user.id,
    });
    res.status(201).json({ comment });
  }
);
```

### **Data Encryption Service**

```typescript
class UserDataService {
  static async createProfile(userData) {
    // Encrypt PII
    const encryptedSSN = userData.ssn ? secure.encrypt(userData.ssn) : null;
    const encryptedPhone = userData.phone
      ? secure.encrypt(userData.phone)
      : null;

    // Clean public data
    const name = secure.input(userData.name, { maxLength: 100 });
    const bio = secure.html(userData.bio, { allowedTags: ['p', 'b', 'i'] });

    return await db.users.create({
      name,
      bio,
      email: userData.email,
      ssn: encryptedSSN,
      phone: encryptedPhone,
    });
  }

  static async getProfile(userId, requestingUserId) {
    const user = await db.users.findById(userId);
    if (!user) throw new Error('User not found');

    const profile = {
      id: user.id,
      name: user.name,
      bio: user.bio,
      email: user.email,
    };

    // Decrypt for authorized users
    if (userId === requestingUserId || (await isAdmin(requestingUserId))) {
      if (user.ssn) profile.ssn = secure.decrypt(user.ssn);
      if (user.phone) profile.phone = secure.decrypt(user.phone);
    }

    return profile;
  }
}
```

## 📖 Complete API Reference

### **Core Function**

```typescript
const security = securityClass.get(); // One function, everything you need
```

### **Middleware Methods**

```typescript
secure.forms(options?);           // CSRF protection
secure.requests(max?, window?);   // Rate limiting
securityClass.quickSetup(options?);    // Quick middleware array
```

### **Input Sanitization**

```typescript
secure.input(text, options?);     // XSS prevention
secure.html(html, options?);      // HTML sanitization
secure.escape(text);              // HTML entity escaping
```

### **Data Encryption**

```typescript
secure.encrypt(data, key?);       // AES-256-GCM encryption
secure.decrypt(data, key?);       // Authenticated decryption
secure.generateKey();             // 256-bit key generation
```

### **Utility Methods**

```typescript
securityClass.getConfig(); // Current configuration
securityClass.getStatus(); // Security feature status
securityClass.validateRequired(checks); // Startup validation
securityClass.isDevelopment(); // Environment helpers
securityClass.isProduction();
```

## 🌍 Environment Variables

### **Required Configuration**

```bash
# CSRF Protection
VOILA_SECURITY_CSRF_SECRET=your-csrf-secret-key-2024-minimum-32-chars

# Data Encryption
VOILA_SECURITY_ENCRYPTION_KEY=64-char-hex-key-for-aes256-encryption

# Generate encryption key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### **Optional Configuration**

```bash
# Rate Limiting
VOILA_SECURITY_RATE_LIMIT=100               # Requests per window
VOILA_SECURITY_RATE_WINDOW=900000           # Window in ms (15 min)

# Input Sanitization
VOILA_SECURITY_MAX_INPUT_LENGTH=1000        # Max input length
VOILA_SECURITY_ALLOWED_TAGS=p,b,i,a         # Allowed HTML tags

# CSRF Settings
VOILA_SECURITY_CSRF_EXPIRY=60               # Token expiry minutes
```

## 🔒 Security Features

### **CSRF Protection** (`secure.forms()`)

- Generates cryptographically secure tokens using `crypto.randomBytes()`
- Stores tokens in sessions with expiration timestamps
- Validates using timing-safe comparison with `crypto.timingSafeEqual()`
- Automatically checks POST/PUT/DELETE/PATCH requests

### **Rate Limiting** (`secure.requests()`)

- In-memory tracking with automatic cleanup
- Sliding window algorithm for accurate limiting
- Standard HTTP headers (X-RateLimit-\*, Retry-After)
- Configurable per endpoint

### **Input Sanitization** (`secure.input()`, `secure.html()`)

- Removes dangerous patterns: `<script>`, `javascript:`, `on*=` handlers
- Whitelist-based HTML tag filtering
- Length limiting to prevent memory exhaustion
- HTML entity escaping for safe display

### **Data Encryption** (`secure.encrypt()`, `secure.decrypt()`)

- AES-256-GCM authenticated encryption
- Random IV per encryption operation
- Authentication tags to detect tampering
- Optional Associated Additional Data (AAD)

## 🛡️ Production Deployment

### **Environment Setup**

```bash
# ✅ Required in production
VOILA_SECURITY_CSRF_SECRET=64-char-random-string
VOILA_SECURITY_ENCRYPTION_KEY=64-char-hex-string

# ✅ Optional but recommended
VOILA_SECURITY_RATE_LIMIT=100
VOILA_SECURITY_RATE_WINDOW=900000
```

### **Security Middleware Order**

```typescript
// ✅ Correct order for maximum protection
app.use(express.json({ limit: '10mb' }));
app.use(session(config)); // 1. Sessions first
app.use(secure.forms()); // 2. CSRF protection
app.use('/api', secure.requests()); // 3. Rate limiting
app.use('/auth', secure.requests(5, 3600000)); // 4. Strict auth limits
app.use('/api', apiRoutes); // 5. Application routes
```

### **Input Validation Pattern**

```typescript
// ✅ Comprehensive input validation middleware
function validateInput(req, res, next) {
  if (req.body.name)
    req.body.name = secure.input(req.body.name, { maxLength: 50 });
  if (req.body.email)
    req.body.email = secure.input(req.body.email?.toLowerCase());
  if (req.body.content)
    req.body.content = secure.html(req.body.content, {
      allowedTags: ['p', 'b', 'i'],
    });

  if (!req.body.name || !req.body.email) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  next();
}
```

### **Key Management**

```typescript
// ✅ Generate production keys
const encryptionKey = securityClass.generateKey();
console.log(`VOILA_SECURITY_ENCRYPTION_KEY=${encryptionKey}`);

// ✅ Validate configuration at startup
securityClass.validateRequired({ csrf: true, encryption: true });
```

## 🧪 Testing

```typescript
import { securityClass } from '@bloomneo/appkit/security';

describe('Security Tests', () => {
  beforeEach(() => securityClass.clearCache());

  test('should generate and verify CSRF tokens', () => {
    const secure = securityClass.reset({
      csrf: { secret: 'test-secret-32-characters-long' },
    });

    const mockReq = { session: {} };
    const middleware = secure.forms();
    middleware(mockReq, {}, () => {});

    const token = mockReq.csrfToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('should encrypt and decrypt correctly', () => {
    const secure = securityClass.reset({
      encryption: { key: 'a'.repeat(64) },
    });

    const data = 'sensitive information';
    const encrypted = secure.encrypt(data);
    const decrypted = secure.decrypt(encrypted);

    expect(decrypted).toBe(data);
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  test('should sanitize malicious input', () => {
    const security = securityClass.get();
    const malicious = '<script>alert("xss")</script><p>Safe</p>';
    const cleaned = secure.html(malicious, { allowedTags: ['p'] });

    expect(cleaned).toBe('<p>Safe</p>');
    expect(cleaned).not.toContain('<script>');
  });
});
```

### **Mock Configuration**

```typescript
function createTestSecurity(overrides = {}) {
  return securityClass.reset({
    csrf: { secret: 'test-secret-32-characters-long' },
    encryption: { key: 'a'.repeat(64) },
    environment: { isDevelopment: true, isTest: true },
    ...overrides,
  });
}
```

## 📈 Performance

- **CSRF Operations**: ~1ms per token generation/verification
- **Rate Limiting**: In-memory with O(1) lookup, automatic cleanup
- **Input Sanitization**: ~0.1ms per operation
- **Encryption**: ~2ms per encrypt/decrypt (AES-256-GCM)
- **Memory Usage**: <2MB additional overhead

## 🔍 TypeScript Support

```typescript
import type {
  SecurityConfig,
  ExpressMiddleware,
  CSRFOptions,
  RateLimitOptions,
} from '@bloomneo/appkit/security';

const security = securityClass.get();
const middleware: ExpressMiddleware = secure.forms();
const encrypted: string = secure.encrypt(sensitiveData);
```

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>
