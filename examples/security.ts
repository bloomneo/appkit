/**
 * examples/security.ts
 *
 * Runnable tour of the @bloomneo/appkit/security module.
 *
 * Covers:
 *   • forms()    — CSRF middleware for HTML form flows
 *   • requests() — rate-limit middleware
 *   • input()    — strip / sanitize untrusted text
 *   • html()     — sanitize HTML fragments
 *   • escape()   — HTML-escape for interpolation
 *   • encrypt() / decrypt() — AES-256-GCM
 *
 * Prereqs:
 *   BLOOM_SECURITY_CSRF_SECRET  (or falls back to BLOOM_AUTH_SECRET)
 *   BLOOM_SECURITY_ENCRYPTION_KEY (64 hex chars)
 *
 * Run: tsx examples/security.ts
 */

import { securityClass } from '../src/security/index.js';

function main() {
  // 1. Fail-fast startup validation.
  securityClass.validateRequired({ csrf: true, encryption: true });

  const security = securityClass.get();

  // 2. Middleware builders — mount them on Express routers.
  //
  //    app.use(security.forms());                           // CSRF
  //    app.use(security.requests(100, 60_000));             // 100 req / min
  //
  //    Prove the shapes here:
  const csrfMw = security.forms();
  const rateMw = security.requests(100, 60_000);
  console.log('csrf mw:', typeof csrfMw, '| rate mw:', typeof rateMw);

  // 3. Quick setup — both in one call (useful for most apps).
  const middleware = securityClass.quickSetup({
    csrf: true, rateLimit: true, maxRequests: 100, windowMs: 60_000,
  });
  console.log('quickSetup produced', middleware.length, 'middlewares');

  // 4. Input sanitization — strip scripts, trim, etc.
  const clean = security.input('  <script>alert(1)</script>hello  ');
  console.log('input(clean) =', JSON.stringify(clean));

  // 5. HTML sanitization — keep a small allow-list of tags.
  const safe = security.html('<p onclick="x">ok <b>bold</b></p><script>bad</script>');
  console.log('html(clean)  =', safe);

  // 6. Escape — for when you're interpolating into HTML yourself.
  console.log('escape       =', security.escape('Tom & Jerry <script>'));

  // 7. Symmetric encryption (AES-256-GCM). Returns a single opaque string.
  const cipher = security.encrypt('account number 4242');
  const plain  = security.decrypt(cipher);
  console.log('round-trip ok =', plain === 'account number 4242');

  // 8. Generate a fresh encryption key (64 hex chars). Persist in your secret store.
  console.log('generated key =', securityClass.generateKey().slice(0, 16), '…');

  // 9. Status for health endpoints (no secrets leaked).
  console.log('status       =', securityClass.getStatus());
}

main();
