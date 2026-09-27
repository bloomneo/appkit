# @bloomneo/appkit - Security Module 🔒

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Rate limiting and AES-256-GCM encryption that just work

**One function** returns a security object with two jobs: rate-limit Express
routes (`requests()`) and encrypt / decrypt sensitive fields (`encrypt()`,
`decrypt()`, `generateKey()`).

> **See also:** [AGENTS.md](../../AGENTS.md) (agent rules) · [llms.txt](../../llms.txt) (full API reference) · [examples/security.ts](../../examples/security.ts) · cookbook: [api-key-service.ts](../../cookbook/api-key-service.ts)

> **Removed in 6.0:** `forms()` (CSRF), `input()`, `html()` and `escape()`, with
> `BLOOM_SECURITY_CSRF_*`, `BLOOM_SECURITY_MAX_INPUT_LENGTH`,
> `BLOOM_SECURITY_ALLOWED_TAGS` and `BLOOM_SECURITY_STRIP_ALL_TAGS`. APIs that
> authenticate with bearer tokens do not need CSRF tokens; if you render HTML
> forms with cookie sessions, set `SameSite=Lax` (or `Strict`) on the session
> cookie or add a maintained CSRF middleware. Validate input with a schema library (zod, valibot) and let your
> template engine or React escape output. See `MIGRATION-6.md`.

## 🚀 Why Choose This?

- **⚡ One Function** - Just `securityClass.get()`, everything else is automatic
- **🚦 Rate Limiting** - Per-route limits with standard `X-RateLimit-*` headers
- **🔐 Encryption** - AES-256-GCM with a random IV and an auth tag per value
- **🔧 Zero Configuration** - Smart defaults with `BLOOM_SECURITY_*` overrides
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

### 1. Environment Variables

```bash
# Needed only if you call encrypt() / decrypt()
BLOOM_SECURITY_ENCRYPTION_KEY=64-char-hex-key-for-aes256-encryption
```

### 2. Basic Setup

```typescript
import express from 'express';
import { securityClass } from '@bloomneo/appkit/security';

const app = express();
const security = securityClass.get();

// Rate limiting
app.use('/api', security.requests()); // defaults: 100 per 15 minutes
app.post('/auth/login', security.requests(5, 15 * 60 * 1000), loginHandler);

// Field encryption
app.post('/profile', async (req, res) => {
  const encryptedSSN = security.encrypt(req.body.ssn);
  // Save encryptedSSN to the database...
  res.json({ success: true });
});
```

## 🤖 LLM Quick Reference - Copy These Patterns

### **Different Rate Limits (Copy These)**

```typescript
// ✅ CORRECT - Endpoint-specific limits
app.use('/api', security.requests(100, 900000)); // 100/15min
app.use('/auth', security.requests(5, 3600000)); // 5/hour
app.post('/upload', security.requests(10), handler); // 10/15min

// ✅ Share one budget across two routes by naming the limiter
const loginBudget = { name: 'login' };
app.post('/auth/login', security.requests(5, 900000, loginBudget), login);
app.post('/auth/otp', security.requests(5, 900000, loginBudget), otp);
```

Each `requests()` call counts separately unless limiters share a `name`.

### **Encryption Patterns (Copy These)**

```typescript
// ✅ CORRECT - Encrypt sensitive data
const encryptedSSN = security.encrypt(user.ssn);
const encryptedPhone = security.encrypt(user.phone);

// ✅ CORRECT - Decrypt for authorized access
const originalSSN = security.decrypt(encryptedSSN);

// ✅ CORRECT - Generate keys
const newKey = security.generateKey(); // 64 hex chars
```

## ⚠️ Common LLM Mistakes - Avoid These

```typescript
// ✅ CORRECT - validate with a schema (forms / input / html / escape are gone in 6.0)
const body = UserSchema.parse(req.body);

// ❌ WRONG - one limiter object for login and API traffic
const limiter = security.requests(5, 900000);
app.use('/api', limiter); // ordinary API calls now spend the login budget

// ✅ CORRECT - one requests() call per route group
app.use('/api', security.requests(100, 900000));
app.post('/auth/login', security.requests(5, 900000), login);
```

## 🚨 Error Handling Patterns

### **Startup Validation**

```typescript
// ✅ App startup validation
try {
  securityClass.validateRequired({ encryption: true });
  console.log('✅ Security validation passed');
} catch (error) {
  console.error('❌ Security failed:', error.message);
  process.exit(1);
}
```

### **Decryption failures**

`decrypt()` throws a `SecurityError` when the value was tampered with, was
encrypted with a different key, or is not in `iv:ciphertext:tag` form. Catch
it where you decrypt and treat the field as unavailable.

## 🎯 Usage Examples

### **Data Encryption Service**

```typescript
class UserDataService {
  static async createProfile(userData) {
    return await db.users.create({
      name: userData.name,
      email: userData.email,
      ssn: userData.ssn ? security.encrypt(userData.ssn) : null,
      phone: userData.phone ? security.encrypt(userData.phone) : null,
    });
  }

  static async getProfile(userId, requestingUserId) {
    const user = await db.users.findById(userId);
    if (!user) throw new Error('User not found');

    const profile = { id: user.id, name: user.name, email: user.email };

    // Decrypt for authorized users
    if (userId === requestingUserId || (await isAdmin(requestingUserId))) {
      if (user.ssn) profile.ssn = security.decrypt(user.ssn);
      if (user.phone) profile.phone = security.decrypt(user.phone);
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
security.requests(max?, windowMs?, options?); // Rate limiting middleware
```

### **Data Encryption**

```typescript
security.encrypt(data, key?, associatedData?); // AES-256-GCM → "iv:ciphertext:tag" (hex)
security.decrypt(data, key?, associatedData?); // Authenticated decryption
security.generateKey();                        // 256-bit key as 64 hex chars
```

### **Utility Methods**

```typescript
securityClass.getConfig(); // Current configuration
securityClass.getStatus(); // { encryption, rateLimit, environment }
securityClass.validateRequired({ encryption: true }); // Startup validation
securityClass.quickSetup({ maxRequests, windowMs }); // → [rate limiter]
securityClass.generateKey(); // Same as security.generateKey()
securityClass.isDevelopment(); // Environment helpers
securityClass.isProduction();
```

## 🌍 Environment Variables

### **Required Configuration**

```bash
# Data Encryption (only if you call encrypt / decrypt)
BLOOM_SECURITY_ENCRYPTION_KEY=64-char-hex-key-for-aes256-encryption

# Generate encryption key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### **Optional Configuration**

```bash
# Rate Limiting
BLOOM_SECURITY_RATE_LIMIT=100               # Requests per window
BLOOM_SECURITY_RATE_WINDOW=900000           # Window in ms (15 min)
BLOOM_SECURITY_RATE_MESSAGE=Too many requests, please try again later  # Rate-limit rejection message
```

## 🔒 Security Features

### **Rate Limiting** (`security.requests()`)

- In-memory tracking with automatic cleanup
- Fixed window per client IP (or your `keyGenerator`)
- Standard HTTP headers (`X-RateLimit-*`, `Retry-After`)
- Configurable per endpoint; each limiter counts separately unless named

### **Data Encryption** (`security.encrypt()`, `security.decrypt()`)

- AES-256-GCM authenticated encryption
- Random IV per encryption operation
- Authentication tags to detect tampering
- Optional Associated Additional Data (AAD)

## 🛡️ Production Deployment

### **🚨 Rate limiting — in-memory caveat**

`security.requests()` uses an in-process `Map` to count requests per IP within
the configured window. That means:

- **Single-process apps:** works as expected.
- **Multi-process / multi-replica apps:** each process counts independently.
  A request that hits replica A doesn't count toward replica B's window.
  Effective rate limit = `BLOOM_SECURITY_RATE_LIMIT × number of replicas`.
- **Clustered / PM2 / forever / Kubernetes replicas:** same concern.

If you run more than one process, put a distributed rate limiter **in front of**
your app instead of (or in addition to) this one:

- **nginx:** `limit_req_zone` / `limit_req`
- **Cloudflare:** Rate Limiting rules
- **Envoy / Istio:** rate limit filter with a global Redis backend
- **API Gateway:** AWS API Gateway throttling, Kong rate-limit plugin, etc.

### **Environment Setup**

```bash
# ✅ Required in production if you encrypt fields
BLOOM_SECURITY_ENCRYPTION_KEY=64-char-hex-string

# ✅ Optional
BLOOM_SECURITY_RATE_LIMIT=100
BLOOM_SECURITY_RATE_WINDOW=900000
```

### **Key Management**

```typescript
// ✅ Generate production keys
const encryptionKey = securityClass.generateKey();
console.log(`BLOOM_SECURITY_ENCRYPTION_KEY=${encryptionKey}`);

// ✅ Validate configuration at startup
securityClass.validateRequired({ encryption: true });
```

Rotating the key makes existing ciphertext unreadable. Re-encrypt stored
values with the new key before switching, or pass the old key explicitly to
`decrypt(value, oldKey)` during a migration.

## 🧪 Testing

```typescript
import { securityClass } from '@bloomneo/appkit/security';

describe('Security Tests', () => {
  beforeEach(() => securityClass.clearCache());

  test('should encrypt and decrypt correctly', () => {
    const security = securityClass.reset({
      encryption: { key: 'a'.repeat(64), algorithm: 'aes-256-gcm', ivLength: 16, tagLength: 16, keyLength: 32 },
    });

    const data = 'sensitive information';
    const encrypted = security.encrypt(data);

    expect(security.decrypt(encrypted)).toBe(data);
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});
```

## 📈 Performance

- **Rate Limiting**: In-memory with O(1) lookup, automatic cleanup
- **Encryption**: ~2ms per encrypt/decrypt (AES-256-GCM)
- **Memory Usage**: <2MB additional overhead

## 🔍 TypeScript Support

```typescript
import type {
  SecurityConfig,
  ExpressMiddleware,
  RateLimitOptions,
} from '@bloomneo/appkit/security';

const security = securityClass.get();
const middleware: ExpressMiddleware = security.requests();
const encrypted: string = security.encrypt(sensitiveData);
```

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>
