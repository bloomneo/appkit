---
name: appkit-security
description: >-
  Use when writing code that needs CSRF protection, rate limiting, input
  sanitization, or AES-256-GCM encryption via `@bloomneo/appkit/security`.
  Covers the `securityClass.get()` pattern and the `forms / requests / input /
  encrypt` surface.
---

# @bloomneo/appkit/security

Single-entry security primitives: `securityClass.get()` returns an object with
four capabilities — CSRF tokens (`forms`), rate limiting (`requests`), input
sanitization (`input`), and symmetric encryption (`encrypt`/`decrypt`).

## Canonical flow

```ts
import { securityClass } from '@bloomneo/appkit/security';

const security = securityClass.get();

// 1. CSRF — for HTML forms
app.get('/form', (req, res) => {
  const token = security.forms().generate();
  res.render('form', { csrfToken: token });
});
app.post('/form', security.forms(), handler);   // verifies token

// 2. Rate limit — max 100 requests per 15-min window per IP
app.use('/api', security.requests(100, 15 * 60 * 1000));

// 3. Input sanitization — strip HTML/scripts
const clean = security.input(userSupplied, { stripAllTags: true });

// 4. Encryption — AES-256-GCM
const ciphertext = security.encrypt('sensitive data');
const plaintext  = security.decrypt(ciphertext);
```

## The `forms()` vs `csrf()` rename

In 2.0.0, `security.csrf()` was renamed to `security.forms()`. The old name
is permanently removed (drift gate enforces it).

- `security.forms()` with no args → returns a middleware that verifies
- `security.forms().generate()` → returns a new token string

## Public API

### Security instance (from `securityClass.get()`)

```ts
security.forms(options?)                       // → middleware (CSRF verify)
security.forms().generate()                    // → token string
security.requests(max, windowMs?, options?)    // → middleware (rate limit)
security.input(value, options?)                // → sanitized string
security.html(value, options?)                 // → HTML-safe string (escapes entities)
security.encrypt(plaintext)                    // → ciphertext string
security.decrypt(ciphertext)                   // → plaintext string
```

### securityClass

```ts
securityClass.get(overrides?)                  // → instance
securityClass.reset(cfg?) / clearCache()       // tests
securityClass.getConfig()                      // → diagnostic
securityClass.generateKey()                    // → 32-byte hex (for BLOOM_SECURITY_ENCRYPTION_KEY)
securityClass.quickSetup()                     // → convenience bundle for minimal apps
securityClass.validateRequired()               // throws if prod prereqs missing
securityClass.isDevelopment() / isProduction()
```

## Env vars

- `BLOOM_SECURITY_CSRF_SECRET` — falls back to `BLOOM_AUTH_SECRET`
- `BLOOM_SECURITY_CSRF_FIELD` — default `_csrf`
- `BLOOM_SECURITY_CSRF_HEADER` — default `x-csrf-token`
- `BLOOM_SECURITY_CSRF_EXPIRY` — minutes, default 60
- `BLOOM_SECURITY_RATE_LIMIT` — default 100
- `BLOOM_SECURITY_RATE_WINDOW` — ms, default 900000 (15 min)
- `BLOOM_SECURITY_ENCRYPTION_KEY` — 32-byte hex (64 hex chars); `securityClass.generateKey()` produces one

## Methods that DO NOT exist

- `security.csrf()` — renamed to `security.forms()` in 2.0.0 (no alias)
- `security.rateLimit(...)` — method is `security.requests(...)`
- `security.sanitize(...)` — method is `security.input(...)`
- `security.hash(...)` — password hashing lives in `authClass.get().hashPassword(...)`
