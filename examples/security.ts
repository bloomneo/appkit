/**
 * examples/security.ts
 *
 * Runnable tour of the @bloomneo/appkit/security module.
 *
 * Covers:
 *   • requests() — rate-limit middleware
 *   • encrypt() / decrypt() — AES-256-GCM
 *   • generateKey() — a fresh 256-bit key
 *
 * (forms / input / html / escape were removed in 6.0.)
 *
 * Prereqs:
 *   BLOOM_SECURITY_ENCRYPTION_KEY (64 hex chars)
 *
 * Run: tsx examples/security.ts
 */

import { securityClass } from '../src/security/index.js';

function main() {
  // 1. Fail-fast startup validation.
  securityClass.validateRequired({ encryption: true });

  const security = securityClass.get();

  // 2. Middleware builders — mount them on Express routers.
  //
  //    app.use('/api', security.requests(100, 60_000));      // 100 req / min
  //    app.post('/login', security.requests(5, 900_000), h);  // 5 per 15 min
  //
  //    Prove the shapes here:
  const rateMw = security.requests(100, 60_000);
  console.log('rate mw:', typeof rateMw);

  // 3. Quick setup — the default rate limiter in one call.
  const middleware = securityClass.quickSetup({ maxRequests: 100, windowMs: 60_000 });
  console.log('quickSetup produced', middleware.length, 'middleware');

  // 4. Symmetric encryption (AES-256-GCM). Returns a single opaque string.
  const cipher = security.encrypt('account number 4242');
  const plain  = security.decrypt(cipher);
  console.log('round-trip ok =', plain === 'account number 4242');

  // 5. Generate a fresh encryption key (64 hex chars). Persist in your secret store.
  console.log('generated key =', securityClass.generateKey().slice(0, 16), '…');

  // 6. Status for health endpoints (no secrets leaked).
  console.log('status       =', securityClass.getStatus());
}

main();
