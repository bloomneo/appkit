# @bloomneo/appkit/verify

Prove a multi-tenant app doesn't leak across tenants — by generating the
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

## Why this exists

Nobody reviews 414 route handlers. A production audit of one 176k-line app
found **4 of 44 route files** missing the tenant filter — in a codebase that
had already been audited by hand. As agents write more of the code, the
number of places a scope can be forgotten grows faster than anyone's ability
to read them.

Conventional test suites don't help, because you have to know what to assert.
This works the other way round.

## Usage

Ids are **discovered, not declared**. The verifier:

1. Logs in as every identity you give it.
2. Asks the FBCA api-router at `/api` which features exist.
3. Harvests the ids each identity can legitimately see.
4. **Replays every id against every other identity** — GET and PATCH, plus DELETE when `allowDestructive: true`.
5. Flags anything that isn't a 404.

That's what makes it a generator rather than a template: no per-app manifest
of routes, fixtures, or response shapes. Add a feature, and it's covered on
the next run.

| Option | Default | Purpose |
|---|---|---|
| `baseUrl` | — | Running server. Required. |
| `identities` | — | At least two. Isolation is only observable by comparison. |
| `loginPath` | `/api/auth/login` | Where to POST `{ email, password }` |
| `tokenField` | `token` | Where the JWT is in the login response |
| `paths` | auto | Endpoints to probe. Omit to auto-discover. |
| `exclude` | `[]` | Extra segments never to probe |
| `timeoutMs` | `5000` | Per request |

Mark platform/superuser logins `crossTenant: true` — they're *supposed* to see
everything, so their reads are excluded from leak assertions.

## A skip is never a pass

`report.ok` is true only when checks actually ran **and** nothing was skipped.
A CI gate going green on an app the verifier never reached is worse than no
gate at all, so an incomplete run reports `INCONCLUSIVE` and fails.

Causes of a skip — each is reported in `report.skipped`:

- a login failed
- fewer than two tenant-scoped identities logged in
- no endpoints were discovered (pass `paths` explicitly)

## Findings

| Kind | Meaning |
|---|---|
| `cross-tenant-read` | `GET` on another tenant's id returned 200. Expected 404. |
| `cross-tenant-write` | `PATCH` reached another tenant's row. |
| `cross-tenant-delete` | `DELETE` removed another tenant's row. |
| `unauthenticated-read` | Endpoint returned 200 with no credentials. |

## Known limits

- **It issues writes.** Run it against a seeded test database, never
  production. It refuses a `baseUrl` that isn't localhost unless you pass
  `allowRemote: true`.
- **DELETE probes are opt-in.** When the app leaks, the probe really deletes
  the other tenant's row, so it only runs with `allowDestructive: true`.
  `report.destructive` records whether it did.
- **`PATCH` returning 400/422 is reported as a leak.** The reasoning: the row
  was found before validation rejected it. An app that validates the body
  *before* looking up the row will false-positive here. False positives in a
  security check are the right side to err on, but check the route before
  filing a bug.
- **Only list endpoints are auto-discovered.** Nested routes
  (`/api/clients/:id/invoices`) need to be passed via `paths`.
- **It proves isolation, not correctness.** A route can be perfectly scoped
  and still wrong.

## CI

```yaml
- run: npm run build && npm start &
- run: npx wait-on http://localhost:3000/health
- run: node scripts/verify-tenancy.mjs   # exits 1 when report.ok is false
```
