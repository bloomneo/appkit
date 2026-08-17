/**
 * examples/verify.ts
 *
 * Runnable tour of the @bloomneo/appkit/verify module.
 *
 * Proves a multi-tenant app doesn't leak across tenants, by generating the
 * cross-tenant attack matrix from the app itself. Resource ids are DISCOVERED,
 * not declared — so this needs no per-app manifest of routes or fixtures, and
 * it covers new features automatically as they are added.
 *
 * Prereqs:  a RUNNING server with a seeded test database, and at least two
 *           logins in different tenants.
 * Run:      tsx examples/verify.ts
 *
 * WARNING: it issues writes and deletes. Never point it at production.
 */

import { verifyClass } from '@bloomneo/appkit/verify';

const verifier = verifyClass.get();

const report = await verifier.run({
  baseUrl: process.env.VERIFY_BASE_URL ?? 'http://localhost:3000',

  // At least two same-privilege identities in DIFFERENT tenants — isolation is
  // only observable by comparison. Mark platform/superuser logins crossTenant
  // so their (legitimate) cross-tenant reads aren't reported as leaks.
  identities: [
    { label: 'firm-a', email: 'owner@a.test', password: 'test1234' },
    { label: 'firm-b', email: 'owner@b.test', password: 'test1234' },
    { label: 'platform', email: 'admin@x.test', password: 'test1234', crossTenant: true },
  ],

  // Optional — omit and the FBCA api-router at /api is asked which features exist.
  // paths: ['/api/clients', '/api/invoices'],
});

console.log(verifier.format(report));

// Assert `report.ok`, NOT `findings.length === 0`. `ok` additionally requires
// that checks actually ran and nothing was skipped, so an incomplete run fails
// instead of going green on an app the verifier never reached.
if (!report.ok) {
  console.error('\nTenant isolation is not proven. See findings/skips above.');
  process.exit(1);
}
