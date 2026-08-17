---
name: appkit-verify
description: >-
  Use when adding a tenant-isolation gate to a multi-tenant app's tests or CI
  via `@bloomneo/appkit/verify`. Covers the `verifyClass.get().run()` pattern,
  why ids are discovered rather than declared, and why an incomplete run must
  fail rather than pass.
---

# @bloomneo/appkit/verify

Proves a multi-tenant app doesn't leak across tenants, by generating the
cross-tenant attack matrix from the app itself.

```ts
import { verifyClass } from '@bloomneo/appkit/verify';

const report = await verifyClass.get().run({
  baseUrl: 'http://localhost:3000',
  identities: [
    { label: 'firm-a', email: 'owner@a.test', password: 'pw' },
    { label: 'firm-b', email: 'owner@b.test', password: 'pw' },
    { label: 'platform', email: 'admin@x.test', password: 'pw', crossTenant: true },
  ],
});

console.log(verifyClass.get().format(report));
if (!report.ok) process.exit(1);
```

## Why it needs no configuration

Ids are **discovered, not declared**. The verifier:

1. Logs in as every identity.
2. Asks the FBCA api-router at `/api` which features exist.
3. Harvests the ids each identity can legitimately see.
4. Replays every id against every other identity — GET / PATCH / DELETE.
5. Flags anything that isn't a 404.

No per-app manifest of routes, fixtures or response shapes. Add a feature and
it is covered on the next run. **Don't hand-write per-endpoint leak tests when
this is available** — they go stale the moment someone adds a route.

## A skip is never a pass

`report.ok` is true only when checks actually ran AND nothing was skipped. A
CI gate going green on an app the verifier never reached is worse than no gate,
so an incomplete run reports `INCONCLUSIVE` and fails.

Read `report.skipped` when a run is inconclusive — a failed login, fewer than
two tenant-scoped identities, or no endpoints discovered.

## Findings

| Kind | Meaning |
|---|---|
| `cross-tenant-read` | GET on another tenant's id returned 200 |
| `cross-tenant-write` | PATCH reached another tenant's row |
| `cross-tenant-delete` | DELETE removed another tenant's row |
| `unauthenticated-read` | Endpoint returned 200 with no credentials |

## Public API

```ts
verifyClass.get()                  // → VerifierClass
verifyClass.reset()                // tests only
verifyClass.disconnectAll()        // uniform teardown verb; holds no connections

await verifyClass.get().run(options): Promise<VerifyReport>
verifyClass.get().format(report): string
```

## Options

| Option | Default | Purpose |
|---|---|---|
| `baseUrl` | — | Running server. Required. |
| `identities` | — | At least two. Isolation is only observable by comparison. |
| `loginPath` | `/api/auth/login` | Where to POST `{ email, password }` |
| `tokenField` | `token` | Where the JWT is in the login response |
| `paths` | auto | Endpoints to probe; omit to auto-discover |
| `exclude` | `[]` | Extra segments never to probe |
| `timeoutMs` | `5000` | Per request |

## Common mistakes

- **Running it against production.** It issues writes and deletes. Seeded test
  database only.
- **Asserting `report.findings.length === 0` instead of `report.ok`.** That
  passes on a run where nothing happened.
- **Giving it one identity.** Isolation is only observable by comparison; it
  throws.
- **Forgetting `crossTenant: true` on platform logins.** They're supposed to
  see everything, so without the flag they look like leaks.
