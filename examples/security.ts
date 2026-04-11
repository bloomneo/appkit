/**
 * CANONICAL PATTERN — rate limiting, CSRF, encryption, input sanitization.
 *
 * Copy this file when you need security middleware. AppKit's security module
 * covers four common needs from one xxxClass.get() instance.
 *
 * Required env: BLOOM_SECURITY_CSRF_SECRET, BLOOM_SECURITY_ENCRYPTION_KEY
 */

import { securityClass, errorClass } from '@bloomneo/appkit';

const security = securityClass.get();
const error = errorClass.get();

// ── Rate limiting middleware ────────────────────────────────────────
// 100 requests per 15-minute window per IP
export const apiRateLimit = security.requests(100, 15 * 60 * 1000);

// 5 requests per minute (e.g. for a login endpoint)
export const loginRateLimit = security.requests(5, 60 * 1000);

// ── CSRF protection ─────────────────────────────────────────────────
// security.forms() is a single middleware that handles BOTH:
//   - Injecting a CSRF token into the response (GET requests)
//   - Validating the token on state-changing requests (POST/PUT/DELETE)
// Mount it once globally — no separate "require" middleware needed.
export const csrfMiddleware = security.forms();

// ── Encryption (AES-256-GCM) ────────────────────────────────────────
export function encryptApiKey(plaintext: string): string {
  return security.encrypt(plaintext);  // → opaque ciphertext string
}

export function decryptApiKey(ciphertext: string): string {
  return security.decrypt(ciphertext);
}

// ── Input sanitization ──────────────────────────────────────────────
// security.input() strips XSS payloads and control characters from free-form text.
// For email/URL validation, use a dedicated validation library (e.g. zod, validator.js).
export const submitRoute = error.asyncRoute(async (req, res) => {
  const safeMessage = security.input(req.body.message);  // strip XSS
  const safeHtml = security.html(req.body.bio);          // allow safe HTML tags only

  res.json({ ok: true, sanitized: { message: safeMessage, bio: safeHtml } });
});
