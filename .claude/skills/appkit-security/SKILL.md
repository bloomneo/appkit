---
name: appkit-security
description: >-
  Use when writing code that needs rate limiting or AES-256-GCM encryption via
  `@bloomneo/appkit/security`. Covers the `securityClass.get()` pattern and the
  `requests / encrypt / decrypt / generateKey` surface.
---

# @bloomneo/appkit/security

Single-entry security primitives: `securityClass.get()` returns an object with
two capabilities — rate limiting (`requests`) and symmetric encryption
(`encrypt` / `decrypt` / `generateKey`).

## Canonical flow

```ts
import { securityClass } from '@bloomneo/appkit/security';

const security = securityClass.get();

// 1. Rate limit — max 100 requests per 15-min window per IP
app.use('/api', security.requests(100, 15 * 60 * 1000));
app.post('/auth/login', security.requests(5, 15 * 60 * 1000), login);

// 2. Encryption — AES-256-GCM
const ciphertext = security.encrypt('sensitive data');
const plaintext  = security.decrypt(ciphertext);
```

Each `requests()` call counts separately; pass `{ name }` as the third
argument to share one budget across routes.

## Public API

### Security instance (from `securityClass.get()`)

```ts
security.requests(max, windowMs?, options?)    // → middleware (rate limit)
security.encrypt(plaintext, key?, aad?)        // → "iv:ciphertext:tag" hex string
security.decrypt(ciphertext, key?, aad?)       // → plaintext string
security.generateKey()                         // → 64 hex chars
```

### securityClass

```ts
securityClass.get(overrides?)                  // → instance
securityClass.reset(cfg?) / clearCache()       // tests
securityClass.getConfig()                      // → diagnostic
securityClass.getStatus()                      // → { encryption, rateLimit, environment }
securityClass.generateKey()                    // → 32-byte hex (for BLOOM_SECURITY_ENCRYPTION_KEY)
securityClass.quickSetup()                     // → [rate limiter]
securityClass.validateRequired({ encryption: true }) // throws if the key is missing
securityClass.isDevelopment() / isProduction()
```

## Env vars

- `BLOOM_SECURITY_RATE_LIMIT` — default 100
- `BLOOM_SECURITY_RATE_WINDOW` — ms, default 900000 (15 min)
- `BLOOM_SECURITY_RATE_MESSAGE` — 429 response message
- `BLOOM_SECURITY_ENCRYPTION_KEY` — 32-byte hex (64 hex chars); `securityClass.generateKey()` produces one

## Methods that DO NOT exist

- `security.forms()` / `security.csrf()` — CSRF was removed in 6.0. Bearer-token
  APIs don't need it; cookie-session HTML forms should use `SameSite` cookies
  or a maintained CSRF middleware.
- `security.input()` / `security.html()` / `security.escape()` — removed in 6.0.
  Validate input with a schema library; let the template engine escape output.
- `security.rateLimit(...)` — method is `security.requests(...)`
- `security.hash(...)` — password hashing lives in `authClass.get().hashPassword(...)`
