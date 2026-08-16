# Changelog

All notable changes to AppKit will be documented in this file.

## [4.2.1] - 2026-08-16

A full-module review before the 5.0 work. Found the 4.0.1 SQLite fix was
incomplete, plus the same env-coupling defect in two more modules.

### Fixed — queue was unusable on SQLite

`queue/defaults.ts` rejected Prisma's `file:./dev.db` scheme, and
`getTransport()` auto-selects the **database** transport whenever
`DATABASE_URL` is set with no `REDIS_URL`. So any SQLite app that touched
`queueClass` crashed at import — the same defect fixed in `logger` for 4.0.1,
in a module the original fix didn't reach.

### Fixed — shared env vars are now validated only by the module that uses them

`REDIS_URL` and `DATABASE_URL` belong to no single module. Validating one a
module will never open turns another module's configuration into an
import-time crash:

- `queue` validates `DATABASE_URL` only on the database transport, `REDIS_URL`
  only on the redis transport
- `cache` and `event` validate `REDIS_URL` only when their resolved strategy
  is redis

An app running events in memory while cache uses Redis no longer dies on a
URL it never opens.

### Fixed — `mcpClass.reset()`

Every other stateful module exposes `get` / `reset` / `disconnectAll`. The new
MCP module shipped with only two of the three. "One pattern, no exceptions" is
the whole value proposition, so the gap was drift rather than a shortcut.

### Added — the doc-drift check is now bidirectional

`scripts/check-doc-drift.ts` only scanned for names that were **removed** and
came back. It could not catch the opposite failure — a whole module shipping
with no mention in `llms.txt` or `AGENTS.md` — which is worse, because an
agent never calls what it cannot find. It now fails when any exported
`xxxClass` is absent from either file. It caught `mcpClass` on the first run.

### Docs

`llms.txt` gains Module 13 (MCP), the matrix-mode section, capability-vs-data-
scope, PII masking, and the new env vars. `AGENTS.md` gains the MCP rules, the
multi-tenant matrix-mode section, and a "never gate data access on the role
alone" rule. README module table 12 → 13.

Suite: 722 → 738 passing.

## [4.2.0] - 2026-08-16

Implements steps 1 and 2 of the scoped-roles RFC. **Not breaking** — matrix
mode is opt-in and linear-mode apps are untouched, which is why this is a
minor and not 5.0.

### Added — matrix mode: roles as (tier × scope)

```bash
BLOOM_AUTH_SCOPES="client,tenant,org,system"   # reach,      low → high
BLOOM_AUTH_TIERS="user,moderator,admin"        # capability, low → high
```

Set both and inheritance becomes the **product** of two chains rather than a
single line: a role satisfies a requirement only when its scope AND its tier
are both high enough.

The bug this fixes: on a linear ladder `moderator.system` outranks
`admin.tenant` and therefore **inherits delete**. A platform moderator could
delete firm data. Every app then re-implemented "moderators never delete" as
an ad-hoc `role === 'admin'` check — and the benchmark confirmed the cost:
adding a read-only reviewer role took an *identical* hand-rolled deny set
with the framework and without it. The linear ladder was worth zero on the
most common change type in a multi-tenant app.

Under the product order those two roles are deliberately **incomparable**,
so gating delete at `admin.<scope>` is enough and the workaround disappears.

Any pair from the cross-product is valid without per-pair registration.
Setting only one axis throws rather than guessing the other — a
half-configured lattice would silently hand the app a different
authorization model than it asked for.

### Added — data scope in the token

`tenantId` and `clientId` are now first-class claims, plus `tier`/`scope` as
the derived split. Capability ("may they do this?") stays the role;
data scope ("on whose data?") is these claims:

```ts
const rows = await db.invoice.findMany({
  where: { ...auth.scopedWhere(req), status: 'open' },
});
```

Carrying the binding removes the per-request lookup two production apps had
to write by hand, and it is the prerequisite for cross-platform: an offline
or mobile client can know its own reach without a round trip, which a
server-side lookup can never give it.

### Added — helpers

- `auth.roleParts(roleLevel)` → `{ tier, scope, tierRank, scopeRank }` (null in linear mode)
- `auth.requireTier('admin')` — capability, any reach
- `auth.requireScope('tenant')` — reach, any capability
- `auth.scopedWhere(req)` — `{ tenantId?, clientId? }`, `{}` for platform accounts

### Tests

+19, including the RFC's full truth table as executable cases. Suite:
703 → 722 passing.

## [4.1.0] - 2026-08-16

### Added — `mcpClass`, a 13th module: your app as an MCP server

```ts
const mcp = mcpClass.get();
await mcp.discover(join(__dirname, 'features'));

const { wellKnown, mcp: mcpRouter } = await mcp.routers({ serviceName, authenticate });
app.use(wellKnown);          // ROOT, before any SPA catch-all
app.use('/mcp', mcpRouter);
```

Turns a Bloom backend into a claude.ai custom connector. What ships:

- **OAuth 2.1 authorization server** — RFC 9728 protected-resource metadata,
  RFC 8414 authorization-server metadata, RFC 7591 dynamic client
  registration, and an authorization-code + PKCE (S256) grant. This is the
  part that matters: a connector client cannot attach to a bare bearer-token
  endpoint, so without it there is no connector.
- **Discovery served where clients actually look.** `routers()` returns a
  `wellKnown` router for the ROOT alongside the mounted one, because RFC
  8414/9728 clients probe `/.well-known/oauth-authorization-server/mcp` at the
  root — not under the mount. Served only under the mount, those paths fall
  through to the app's SPA, the client receives HTML, and it reports
  "couldn't register" while `/mcp/register` works perfectly when called
  directly. Metadata references `{origin}{mountPath}` rather than
  `req.baseUrl`, so one set of handlers is correct from either mount. Both
  routers come from one config so they cannot drift apart.
- **Stateless by construction.** Every artefact — client id, auth code,
  access and refresh token — is a signed JWT, and the transport builds a
  fresh server per request. An app running N workers in cluster mode needs no
  shared store and no sticky sessions.
- **FBCA tool discovery.** `features/<name>/<name>.mcp.ts` is auto-registered,
  mirroring `<name>.route.ts`. Tool names are namespaced by feature, so two
  features can both expose `list`.
- **Per-tool roles.** With a `resolveRoles` hook, `roles: ['admin.tenant']`
  uses the same inheritance as `auth.requireUserRoles()` — and a caller
  without the role never sees the tool in `tools/list` at all, rather than
  being refused on call.

The OAuth and transport layers are extracted from a production deployment
already serving a live claude.ai connector.

### Added — two optional peer dependencies

`express` and `@modelcontextprotocol/sdk`, both `optional: true`. The other
twelve modules stay importable with neither installed; only apps that mount
MCP pay for them. A missing peer throws at `mcp.routers()` — at boot, with the
install command in the message — not on the first agent request.

The SDK owns the wire format deliberately: the protocol is still moving, and
tracking spec revisions by hand is a bad trade.

### Added — `src/mcp/README.md` + 38 tests

Covering tool validation, role visibility and inheritance, server building,
and the full OAuth flow including PKCE-verifier mismatch, unregistered
redirect_uri, and sub-S256 challenge rejection — plus a root-discovery
regression test that mounts a real express app WITH an SPA catch-all and
asserts the metadata is JSON pointing at {origin}/mcp. Suite: 656 → 703
passing.

## [4.0.1] - 2026-08-16

Two bug fixes. Together they were blocking **appkit + Prisma + SQLite
entirely** — which is the data layer for the desktop templates. Found by a
controlled two-arm benchmark (`bloom-bench`) that built the same multi-tenant
spec with and without appkit; the framework arm could not boot.

### Fixed — logger no longer validates `DATABASE_URL` it doesn't use

`validateEnvironment()` checked `DATABASE_URL`'s format unconditionally, so
merely *setting* the var to something the logger didn't recognise threw at
import time and killed the process before a single route loaded — even with
`BLOOM_LOGGER_DATABASE` unset. The check is now guarded by `dbEnabled`, which
is what the adjacent "missing URL" check already did.

### Fixed — Prisma's SQLite URL (`file:./dev.db`) is now accepted

Both validators required a `sqlite://` scheme. Prisma's SQLite datasource
format is `file:./dev.db` — it has no `://` authority, and the database
module additionally rejected any URL containing `..`, which is a legitimate
relative segment in a local path (`file:../../app.db`). The two formats were
mutually exclusive, so the SQLite support advertised in the database docs
could never have worked.

- `file:` is accepted by `database/defaults.ts` and `logger/defaults.ts`
- `detectProvider()` maps `file:` → `sqlite` (adapter `prisma`)
- Path-traversal rejection still applies to network URLs, where it belongs
- `sqlite://` is still accepted for anyone who took the old docs literally

### Tests

+17 regression tests across `database.test.ts` and `logger.test.ts` covering
every accepted and rejected URL shape, and both sides of the `dbEnabled`
guard. Suite: 639 → 656 passing.

## [4.0.0] - 2026-04-17

First public release since 2.0.0. Rolls up the unpublished 3.0.x internal
audits plus an API-wide cleanup. `latest` on npm goes `2.0.0 → 4.0.0`.

> Versions `3.0.0` / `3.0.1` / `3.0.2` exist only in git history and were
> never published to npm. They represent incremental commits of the same
> audit work that 4.0.0 collapses into one release.

### Why 4.0.0

Strict semver. The public surface has breaking renames (removed redundant
class-level `clear()`, renamed `shutdown()` → `disconnectAll()` for every
stateful module, renamed `databaseClass.disconnect()` → `disconnectAll()`).
Safer to ship as a new major than to re-shuffle 2.x.y patches.

### Breaking — teardown verb (unified across every stateful module)

One canonical call: `xxxClass.disconnectAll()`. Every stateful module uses
the same name. `shutdown()` and class-level `clear()` are removed and
forbidden by `scripts/check-doc-drift.ts`.

| 2.0.0 | 4.0.0 |
|---|---|
| `cacheClass.flushAll()` | `cacheClass.clearAll()` (bulk data, keeps connections) |
| `cacheClass.shutdown()` | `cacheClass.disconnectAll()` |
| `queueClass.clear()` | `queueClass.disconnectAll()` |
| `emailClass.shutdown()` | `emailClass.disconnectAll()` |
| `emailClass.clear()` | `emailClass.disconnectAll()` |
| `eventClass.shutdown()` | `eventClass.disconnectAll()` |
| `eventClass.clear()` | `eventClass.disconnectAll()` |
| `storageClass.shutdown()` | `storageClass.disconnectAll()` |
| `storageClass.clear()` | `storageClass.disconnectAll()` |
| `loggerClass.clear()` | `loggerClass.disconnectAll()` |
| `databaseClass.disconnect()` | `databaseClass.disconnectAll()` *(first time exposed on class)* |

Instance-level `cache.clear()` stays — that's the per-namespace data wipe,
a distinct operation.

### Breaking — storage default export

- `import StorageClass from '@bloomneo/appkit/storage'` used to pull the
  **class**. Now pulls the lowercase singleton, matching every other module.
  Switch to the named import `import { StorageClass } from '@bloomneo/appkit/storage'`
  if you want the class.

### Breaking — library hygiene (from the 3.0.x audit)

- `email`, `event`, `storage`, `queue` no longer register `process.on(SIGTERM/…)`
  handlers at import time. A library must not commandeer the host app's
  signal handling. Wire shutdown yourself:
  ```ts
  process.on('SIGTERM', () => cacheClass.disconnectAll().finally(() => process.exit(0)));
  // ...one line per module you use
  ```

### Breaking — production refuses silent fallbacks

- `emailClass.get()` in `NODE_ENV=production` with no `RESEND_API_KEY` and no
  `SMTP_HOST` now throws `EmailError` (`EMAIL_PROD_NO_PROVIDER`) at boot
  instead of silently logging to Console. Silent console email in prod is
  silent data loss.

### Added — unified error base

- `AppKitError` re-exported from the package root. Every typed error extends
  it: `TokenError`, `CacheError`, `AppError`, `SecurityError`, plus new
  `DatabaseError`, `EmailError`, `EventError`, `QueueError`, `LoggerError`,
  `StorageError`.
- Consumer can write one unified catch:
  ```ts
  try { ... } catch (err) {
    if (err instanceof AppKitError) {
      logger.warn('appkit error', { module: err.module, code: err.code });
    }
    throw err;
  }
  ```
- `llms.txt` gains an error-code reference table (per-module code → fix).

### Added — queue handler timeout

- `queue.process(type, handler, { timeout?: ms })`. Default **30 000 ms**.
  Handler promise is rejected on timeout and the job retries per `attempts`
  config. Opt-out with `timeout: 0`. Fixes the class of "one stuck handler
  wedges the worker forever" bugs.

### Added — database tenant-filter safety net

- First call to `databaseClass.get()` logs a one-shot `console.warn` if
  `BLOOM_DB_TENANT` is unset. The warn explicitly points at the `=auto` /
  `=false` choices. Silent unfiltered queries in multi-tenant apps was the
  #1 prod risk pre-4.0; the warn makes it loud.
- Database test count raised from 7 to 41 (integration-style coverage of
  validators, error shapes, and the new tenant warn).

### Added — scaffolding template validates prod config at boot

- `bin/templates/backend/src/api/server.ts.template` now has a
  commented-out `validateProduction()` / `validateConfig()` block in its
  startup path. Consumers uncomment the modules they use so prod-misconfig
  surfaces immediately at boot instead of on first request.

### Added — docs / gates / meta

- `AppKitError` base + `requireEnv` / `requireProp` / `warnInDev` helpers
  wired together so every module can use the same error shape.
- `scripts/check-doc-drift.ts` scans `src/` in addition to docs/examples/
  cookbook/bin. Bans every removed method name (`emailClass.clear(`,
  `eventClass.clear(`, `storageClass.clear(`, `loggerClass.clear(`,
  `databaseClass.disconnect(`, `xxxClass.shutdown(`, the cache synonyms).
- `tests/public-surface.test.ts` extended — now 90+ assertions including
  `AppKitError` inheritance for every typed error and `disconnectAll`
  presence on every stateful module.
- `docs/NAMING.md` has an explicit *"one teardown verb across every stateful
  module"* section with the instance-vs-class split spelled out.
- `src/security/README.md` has a loud section about the in-memory rate
  limiter not being distributed (recommends nginx / Cloudflare / envoy for
  multi-process deployments).
- `examples/{email,storage,logger}.ts` updated to the new teardown verb.
- `examples/.env.example` removed (canonical `.env.example` is at repo root).
- `CONTRIBUTING.md` testing section replaced with current reality
  (`check:docs` + `check:anchors` + vitest + CI on Node 18/20/22).

### Migration from 2.0.0

Run this project-wide find-and-replace. Every breaking rename, one list:

```
cacheClass.flushAll(     → cacheClass.clearAll(
cacheClass.shutdown(     → cacheClass.disconnectAll(
queueClass.clear(        → queueClass.disconnectAll(
emailClass.shutdown(     → emailClass.disconnectAll(
emailClass.clear(        → emailClass.disconnectAll(
eventClass.shutdown(     → eventClass.disconnectAll(
eventClass.clear(        → eventClass.disconnectAll(
storageClass.shutdown(   → storageClass.disconnectAll(
storageClass.clear(      → storageClass.disconnectAll(
loggerClass.clear(       → loggerClass.disconnectAll(
databaseClass.disconnect( → databaseClass.disconnectAll(
```

Then:

- If you relied on the library auto-registering `process.on('SIGTERM', …)`,
  wire it yourself in your server bootstrap. Recommended pattern is in the
  backend template at `bin/templates/backend/src/api/server.ts.template`.
- If you use email / storage / database / security in production, confirm
  the required env vars are set — 4.0.0 refuses to silently fall back.
- If you caught errors with ad-hoc `instanceof CacheError` / `instanceof TokenError`
  etc., consider switching to a single `instanceof AppKitError` guard.

### Known gaps — deferred to a future major

Explicitly out of scope for 4.0.0; filed here so users know they are NOT
getting these:

- Email templates / HTML rendering engine
- Multipart upload for storage (streaming uploads limited to full buffer)
- Distributed rate limiting (in-memory only; see `src/security/README.md`)
- Queue handler priority across job types
- Event dead-letter queue
- Database schema-migration tooling

---

## [3.0.2] - 2026-04-16 (unpublished, folded into 4.0.0)

One teardown verb across every module. Resolves the cross-module split that
3.0.1 flagged as "deferred to 4.0.0" — we chose to land it in the 3.x line
while there are no external consumers of 3.0.0/3.0.1 (neither was published
to npm).

### Breaking — email, event, storage

- `emailClass.shutdown()`   → `emailClass.disconnectAll()` (no alias)
- `eventClass.shutdown()`   → `eventClass.disconnectAll()` (no alias)
- `storageClass.shutdown()` → `storageClass.disconnectAll()` (no alias)

After this change, every module in the package uses the same teardown verb
(`xxxClass.disconnectAll()`). An agent that learns the pattern for one
module gets the same pattern for all 12.

### Migration from 3.0.x

Project-wide find-and-replace (exactly these three):

- `emailClass.shutdown(`    → `emailClass.disconnectAll(`
- `eventClass.shutdown(`    → `eventClass.disconnectAll(`
- `storageClass.shutdown(`  → `storageClass.disconnectAll(`

### Enforcement

`scripts/check-doc-drift.ts` bans the old names — any doc, example, cookbook,
template, or `src/` file using `emailClass.shutdown(` / `eventClass.shutdown(`
/ `storageClass.shutdown(` fails `npm test`.

### Versioning note

Strict semver would call this 4.0.0. It shipped as 3.0.2 because 3.0.0 and
3.0.1 were never published to npm — the public `latest` is still 2.0.0, so no
external code references the removed names. Future breaking changes after an
npm publish will take a proper major.

## [3.0.1] - 2026-04-16 (unpublished, folded into 4.0.0)

Patch — fixes a template regression introduced by 3.0.0 removing the
library's auto-registered signal handlers.

### Fixed

- `bin/templates/backend/src/api/server.ts.template` now wires
  `process.on('SIGTERM' | 'SIGINT', …)` to a `gracefulShutdown` block that
  closes the HTTP server, flushes the logger, and shows a commented menu of
  per-module drain calls consumers uncomment for whichever modules they use.
  Scaffolded apps from `appkit generate app` no longer exit abruptly under
  SIGTERM.

## [3.0.0] - 2026-04-16 (unpublished, folded into 4.0.0)

Post-2.0.0 audit cleanup. Shipped as a major per NAMING.md ("any rename
requires a new major"). Library hygiene fixes that surfaced after 2.0.0's
release; upgrading from 2.0.0 requires small renames, mostly in teardown code.

### Breaking — cache

- `cacheClass.flushAll()` renamed to `cacheClass.clearAll()` (no alias) —
  NAMING.md §69 forbids `flush` / `clear` synonym drift.
- `cacheClass.shutdown()` removed (no alias) — use `cacheClass.disconnectAll()`.
  NAMING.md §70 forbids `shutdown` / `disconnect` drift.

### Breaking — queue

- `queueClass.clear()` renamed to `queueClass.disconnectAll()` (no alias) —
  aligns teardown naming with cache.

### Breaking — library hygiene

- `email`, `event`, `storage`, and `queue` no longer register `SIGTERM` /
  `SIGINT` / `uncaughtException` / `unhandledRejection` handlers at import
  time. A library must not commandeer the host app's signal handling. Wire
  shutdown yourself:
  ```ts
  process.on('SIGTERM', () => cacheClass.disconnectAll().finally(() => process.exit(0)));
  // ...etc for each module you use (3.0.2 unified the teardown verb across
  // all modules, so every one uses disconnectAll())
  ```
- `storage` default export was the class (`StorageClass`); now the lowercase
  singleton (`storageClass`), matching the other modules. If you did
  `import StorageClass from '@bloomneo/appkit/storage'` and used it as a
  class, switch to the named import `import { StorageClass } from ...`.

### Added

- Every module now ships `export default <lowercase singleton>` (auth, config,
  error, security, util previously lacked one).
- `queue` now re-exports `QueueClass`, `QueueConfig` to match other modules.
- Root `.env.example` with every common BLOOM_* var organized by module.
- Root README quick-start calls out the three fresh-consumer stumbles: ESM
  requirement, `BLOOM_AUTH_SECRET` bootstrap, dotenv is not auto-loaded.
- `src/auth/README.md` documents `generateLoginToken` payload pass-through
  (any extra JSON-serializable field is preserved into `req.user`).
- `scripts/check-readme-anchors.ts` + `npm run check:anchors`: every error
  message's `See: .../README.md#anchor` URL is verified to resolve.
- `scripts/check-doc-drift.ts` now scans `src/` (plugged the gap that let
  the cache synonym drift land in the first place).
- `tests/public-surface.test.ts`: top-level shape assertions over every
  module — defaults, class re-exports, flat-vs-deep identity.
- GitHub Actions CI workflow (`check:docs` + `check:anchors` + `vitest` on
  Node 18/20/22 for push + PR).
- Claude Code skills at `.claude/skills/` — one `appkit` overview + one per
  module (12 modules × 1 skill each). Shipped in the tarball; consumers copy
  into their own `.claude/skills/` to activate.

### Framing

- `docs/NAMING.md`, `README.md`, `AGENTS.md`, `llms.txt`, `CHANGELOG.md`:
  remove "pre-v1" language. The public API is stable from 2.0.0 forward;
  this 3.0.0 exists because the 2.0.0 audit itself needed a few more renames
  after shipping, and per our own policy those require a major.

### Migration from 2.0.0

Project-wide find-and-replace:

- `cacheClass.flushAll(`     → `cacheClass.clearAll(`
- `cacheClass.shutdown(`     → `cacheClass.disconnectAll(`
- `queueClass.clear(`        → `queueClass.disconnectAll(`

Remove any top-level `import '@bloomneo/appkit/email'` (or event/storage/queue)
code that relied on the old auto-registered signal handlers; wire them
explicitly into your process lifecycle.

## [2.0.0] - 2026-04-15

Stable-API compatibility break. Full revamp: breaking renames, removed
hallucinated methods, and aligned the public surface across all 12 modules to
a single canonical pattern. Upgrading from 1.5.x requires code changes. After
2.0.0 the API is stable — any further breaking rename requires a new major.

### Breaking — auth

- `auth.user(req)` renamed to `auth.getUser(req)` (no alias).
- `auth.can(user, perm)` renamed to `auth.hasPermission(user, perm)` (no alias).
- `auth.requireLogin()` and `auth.requireRole()` never existed — use
  `auth.requireLoginToken()` and `auth.requireUserRoles([...])`. Docs and
  templates that referenced the hallucinated names are now fixed.

### Breaking — security

- `security.csrf()` renamed to `security.forms()` (no alias).

### Breaking — logger

- Removed the accidentally-public `logger.gethasTransport()` and
  `logger.getclear()`. Use `loggerClass.hasTransport()` and
  `loggerClass.clear()` at the class level.

### Breaking — error

- `error.handleErrors()` option renamed: `includeStack` → `showStack`, and
  `logErrors` is now an explicit option rather than implicit.

### Added

- `docs/NAMING.md` — authoritative API naming policy for the package.
- `docs/AGENT_DEV_SCORING_ALGORITHM.md` — 15-dimension agent-dev friendliness
  rubric; per-module scores are in each `src/<module>/README.md`.
- `scripts/check-doc-drift.ts` — CI drift gate that fails the build if any
  renamed or hallucinated method reappears in docs, examples, cookbook,
  per-module READMEs, or `bin/templates/`.
- `./event` subpath export in `package.json` (previously documented but not
  wired up).
- `appkit generate app` now copies `AGENTS.md` and `llms.txt` into the
  scaffold root so agents landing in downstream projects have the rules
  file and full API reference without digging into `node_modules/`.
- Per-module "See also" pointer block in every `src/<module>/README.md`
  linking AGENTS.md, llms.txt, the module's example, and relevant cookbook
  recipes.
- Task-oriented TOC ("Pick your starting point") in `AGENTS.md`.

### Fixed

- Queue test (`queue.add() + queue.process()`) was flaky under
  `NODE_ENV=test` because the memory transport's processing loop was
  disabled. Test now force-enables the worker and polls deterministically.
- `bin/templates/feature-user/user.route.ts.template`: 4 call sites used
  the old `auth.user()` — now `auth.getUser()`.
- `bin/templates/backend/src/api/server.ts.template`: `VOILA_FRONTEND_KEY`
  references → `BLOOM_FRONTEND_KEY`.
- `bin/commands/generate.js`: random frontend key prefix `voila_` →
  `bloom_`.
- `llms.txt`: `config.getMany(['A','B'])` signature was wrong; corrected to
  the object-form `config.getMany({a: 'section.key_a', ...})`. `userId`
  type broadened to `string | number`. `error.internal` → `error.serverError`.

### Moved

- `NAMING.md` → `docs/NAMING.md`
- `AGENT_DEV_SCORING_ALGORITHM.md` → `docs/AGENT_DEV_SCORING_ALGORITHM.md`

Neither ships in the tarball (internal governance only). All references in
per-module READMEs and CONTRIBUTING.md updated.

### Removed

- `uploads/` directory and stale test artifacts.

## [1.5.2] - 2026-04-11

### Behavior fix — `auth.can()` permission resolution

**Breaking semantic change in the auth module.** The `permissions` field on
the JWT payload now correctly **replaces** the role's default permissions
instead of supplementing them. This matches AWS IAM, Casbin, OPA, Auth0
RBAC, and every mainstream permission system: explicit permissions are the
truth, defaults are the fallback.

**Old (buggy) behavior:**
```ts
const user = auth.generateLoginToken({
  userId: 1, role: 'admin', level: 'tenant',
  permissions: ['view:own'],   // expected: user is restricted to view:own
});
auth.can(user, 'manage:tenant'); // returned TRUE (additive — bug)
                                  // because admin.tenant defaults included it
```

**New (fixed) behavior:**
```ts
const user = auth.generateLoginToken({
  userId: 1, role: 'admin', level: 'tenant',
  permissions: ['view:own'],   // explicit permissions REPLACE role defaults
});
auth.can(user, 'manage:tenant'); // now FALSE — defaults are not consulted
auth.can(user, 'view:own');      // TRUE — exact match
```

**Resolution rule:**
- If `user.permissions` is present (any array, including `[]`), it is the
  COMPLETE permission set. Role defaults are NOT consulted.
- If `user.permissions` is absent, the role.level's default permissions
  from the configured RolePermissionConfig apply.

**Action inheritance still works** within whichever set is in scope:
`manage:scope` grants `view`, `create`, `edit`, `delete` for that scope.
**No upward inheritance**: `edit:scope` does NOT grant `manage:scope`.

**Why this is a fix, not a feature:**
- The original JSDoc on `can()` said `auth.hasRole('edit:tenant', 'manage:tenant') → FALSE`
  meaning the author intended no upward inheritance. The implementation
  silently bypassed this via the additive fallback. The fix aligns the code
  with its own documented intent.
- Documentation alone could not fix the consumer trap because the bug was
  silent — devs writing `permissions: ['view:own']` thought they were
  restricting the user, but the user could still do `manage:tenant`. That's
  the worst class of security bug.
- No deployed consumers were on `@bloomneo/appkit@1.5.1` at the time of this
  fix, so the breaking change has zero blast radius.

**Migration:** anyone who was relying on the additive behavior (passing
`permissions: [...]` expecting it to extend role defaults) needs to either:
1. Remove the explicit `permissions` array entirely (defaults will apply)
2. Add the role's defaults to the explicit array manually if you want the union

**Tests:** `src/auth/auth.test.ts` now has 8 `can()` tests covering
explicit replacement, no upward inheritance, empty-array downgrade, and
no-explicit-permissions fallback. 55/55 vitest passing.

### error / logger / database / config module audit

- **error**: Added `tooMany()` (429) and `internal()` (500 alias for `serverError()`) as real
  methods on `ErrorClass` and as shortcuts on `errorClass`. Both were previously in example
  comments only — examples referenced them as if callable.
- **logger**: Added `fatal(message, meta?)` to the `Logger` interface and `LoggerClass`.
  Delegates to `error()` with `{ fatal: true }` in meta. Was in `examples/logger.ts` line 24
  but not in the interface — would throw "not a function" at runtime.
- **config**: Fixed `examples/config.ts` — `config.isDevelopment()` / `config.isProduction()`
  do NOT exist on the `ConfigClass` instance; they live on `configClass` (the module-level
  object). Fixed to `configClass.isDevelopment()` with a comment explaining the distinction.
  Also fixed `config.getNumber()` / `config.getBoolean()` — neither exist on `ConfigClass`;
  examples now use `Number(config.get(...))` / `config.get(...) === 'true'`.
- **database**: `disconnect()` error prefix changed to `[@bloomneo/appkit/database]` for
  consistency with other modules.
- Added test files: `src/error/error.test.ts` (31 tests), `src/logger/logger.test.ts`
  (25 tests), `src/config/config.test.ts` (31 tests), `src/database/database.test.ts`
  (9 tests). **Total: 216/216 vitest passing.**

### Cache module audit

- Fixed `examples/cache.ts`: `cache.del()` → `cache.delete()` (wrong name), removed
  `cache.has()` (internal `CacheStrategy` method, not on the public `Cache` interface)
- Fixed `src/cache/README.md` testing section: `cacheClass.clear()` (disconnects all
  instances) → `cacheClass.flushAll()` (clears cached data — the right call between tests)
- Added `src/cache/cache.test.ts` (49 vitest tests, full public API coverage, drift-check
  section asserting hallucinated method names `del` and `has` don't exist on the public
  `Cache` interface)
- Score block added to `src/cache/README.md`: **75.3/100 🟡 Solid** (no cap).
- Added `CacheError` class (exported from `@bloomneo/appkit/cache`) — all cache
  operations now throw `CacheError` instead of swallowing errors via `console.error`.
  Use `instanceof CacheError` to distinguish infrastructure failures from your own
  errors and decide whether to fall back or re-throw. Error codes: `CACHE_GET_FAILED`,
  `CACHE_SET_FAILED`, `CACHE_DELETE_FAILED`, `CACHE_CLEAR_FAILED`, `CACHE_CONNECT_FAILED`,
  `CACHE_INVALID_KEY`, `CACHE_INVALID_VALUE`.
- `cacheClass.clear()` renamed to `cacheClass.disconnectAll()` — eliminates the naming
  collision with `cache.clear()` (which clears data in a namespace). The two methods had
  opposite effects under the same name.
- Added generics to `Cache` interface: `get<T>()`, `set<T>()`, `getOrSet<T>()` — no more
  `any` casts when working with typed values.
- All error messages use `[@bloomneo/appkit/cache]` prefix (consistent with auth module).

### Other fixes (auth-only revamp)

- Added `src/auth/auth.test.ts` (55 tests, full public API coverage,
  drift-check section asserting hallucinated method names don't exist)
- Added `vitest.setup.ts` for env var bootstrapping before module init
- Updated `vitest.config.js` to wire the setup file
- Fixed README hero example: `auth.requireRole` → `auth.requireLoginToken()` +
  `auth.requireUserRoles([...])` (was hallucinated)
- Fixed AGENTS.md `auth.requireLogin()` / `requireRole()` / `signToken()` →
  real method names
- Fixed llms.txt auth section: rewrote 12 method signatures, role hierarchy,
  middleware chaining rules, and 2 worked examples to match runtime
- Fixed src/auth/README.md `service.webhook` / `api.external` examples to use
  valid `admin.system` role.level (the old examples threw at runtime)
- Fixed `examples/auth.ts` to demonstrate all 12 public methods (added
  `verifyTokenManually` + `permissionCheckHandler`)
- Improved auth.ts runtime errors: now `[@bloomneo/appkit/auth] message + DOCS_URL#anchor`
  format so devs and AI agents can self-correct from the error alone
- Added `AGENT_DEV_SCORING_ALGORITHM.md` at repo root: 15-dimension rubric
  for scoring AI-agent + dev friendliness, applied to the auth module first
- Added agent-dev friendliness score block to `src/auth/README.md`
  (current: 83.6/100 uncapped, 50/100 capped due to broken cookbook files
  pending repair in a follow-up release)
- Added "Which case is your app?" decision tree to `src/auth/README.md`
  mapping the 9-level default hierarchy to three real-world app shapes:
  Case 1 (admin + users, ~50% of apps), Case 2 (admin + orgs + users, ~30%),
  Case 3 (admin + orgs + tenants, ~20%). Establishes a 3-role core
  (`user.basic` + `moderator.manage` + `admin.system`) shared by all cases,
  with pricing tiers (`user.pro`, `user.max`) and admin level scoping
  (`admin.tenant`, `admin.org`) marked optional. Multi-tenancy is reframed
  as a database concern (`BLOOM_DB_TENANT=auto`), not an auth concern.
  Lifts the auth README's Reading Order score 9 → 10 and Learning Curve 7 → 9.

### security / util / queue / storage / email / event module audit

- **security**: Fixed `examples/security.ts` — removed hallucinated `csrf()`, `requireCsrf()`,
  `email()`, `url()`. Real CSRF method is `forms()` (single middleware handles both injection
  and validation). Added `html()` and `escape()` examples. Noted that email/URL validation
  should use zod or validator.js.
- **util**: Fixed `examples/util.ts` — removed `util.set()`, `util.omit()`, `util.throttle()`,
  `util.retry()` (none exist). Added real methods: `util.unique()`, `util.clamp()`,
  `util.truncate()`. Added note that `util.get()` is read-only (no `set()`), `util.pick()` is
  the correct "exclude keys" approach (no `omit()`).
- **queue**: Fixed `examples/queue.ts` — `retries: 3` → `attempts: 3` in `JobOptions`.
  `queue.schedule('name', '0 3 * * *', {})` (cron-style, wrong) → `queue.schedule('name', {}, delayMs)`
  (delay in milliseconds — there is no built-in cron scheduler; use node-cron to call `queue.add()`).
- **storage**: Fixed `examples/storage.ts` — `storage.has(key)` → `storage.exists(key)`.
- **email**: Fixed `examples/email.ts` — `email.send({ template, data })` → `email.sendTemplate(name, data)`.
  Added note that `EmailData` has no `template` or `data` fields.
- **event**: `examples/event.ts` was already correct — no changes.
- Added test files for all 6 modules: `src/security/security.test.ts`, `src/util/util.test.ts`,
  `src/queue/queue.test.ts`, `src/storage/storage.test.ts`, `src/email/email.test.ts`,
  `src/event/event.test.ts`. Each includes a drift-check section asserting hallucinated
  method names do not exist at runtime.

### Cookbook fixes

All 5 cookbook files corrected — the two root hallucinations that had propagated everywhere:
- `auth.requireLogin()` → `auth.requireLoginToken()` (5 occurrences across 4 files)
- `auth.requireRole('admin.tenant')` → `auth.requireUserRoles(['admin.tenant'])` (6 occurrences)
- `cache.del()` → `cache.delete()` (`multi-tenant-saas.ts`)
- `{ retries: 3 }` → `{ attempts: 3 }` + updated inline comment (`file-upload-pipeline.ts`)

### llms.txt and AGENTS.md

- Added `AGENTS.md` (new file): concise agent rules — always/never lists, canonical patterns,
  CLI reference, migration notes. Ships with the package for consumption by AI coding agents.
- Fixed `llms.txt` — 7 sections with stale or hallucinated API:
  - Security: corrected to `forms()`, `html()`, `escape()`; removed `csrf()`, `requireCsrf()`,
    `email()`, `url()`
  - Cache: `del()` → `delete()`; removed `has()` with null-check pattern documented
  - Storage: `del()` → `delete()`; `has()` → `exists()`; added `list()`, `copy()`
  - Queue: `retries` → `attempts`; `schedule(name, cron, data)` → `schedule(name, data, delayMs)`
  - Email: removed `template`/`data` from `EmailData`; added `sendTemplate()` signature
  - Util: removed `set()`, `omit()`, `throttle()`, `retry()`; added `isEmpty()`, `unique()`,
    `clamp()`, `truncate()`
  - Config: split instance methods (`get`, `has`, `getRequired`, `getMany`, `getAll`) vs
    module-level helpers (`configClass.isDevelopment()` / `isProduction()` / `isTest()`);
    documented `getNumber()`/`getBoolean()` pattern via `Number()` / `=== 'true'`

### VOILA_* env var prefix removed (breaking change)

The legacy `VOILA_*` env var prefix is gone entirely. Rename in your `.env` files:
- `VOILA_AUTH_SECRET` → `BLOOM_AUTH_SECRET`
- `VOILA_SECURITY_CSRF_SECRET` → `BLOOM_SECURITY_CSRF_SECRET`
- `VOILA_SECURITY_ENCRYPTION_KEY` → `BLOOM_SECURITY_ENCRYPTION_KEY`
- And so on for all other `VOILA_*` vars.

There is no fallback, no deprecation warning, no compatibility shim.

## [1.5.1] - 2026-04-11

> **Note on version jump.** Previous releases of `@bloomneo/appkit` were `1.2.9`
> and earlier (and the package was previously published as `@voilajsx/appkit`
> at `1.2.8`). This release jumps to `1.5.1` to align with the
> bloomneo trio (`@bloomneo/uikit@1.5.1`, `@bloomneo/appkit@1.5.1`,
> `@bloomneo/bloom@1.5.1`) so consumers can install matched versions in one
> step. **No breaking changes** between 1.2.9 and 1.5.1 — every export, every
> method, every default behavior is identical. The version bump is purely for
> trio alignment.

### Fixed

- **Stale `[VoilaJSX AppKit]` brand strings in runtime warnings.** The 1.2.9
  rebrand updated the package metadata, README, and documentation but missed
  ~70 hardcoded brand strings inside the source files (warning messages, log
  prefixes, HTTP `User-Agent` headers, JSDoc comments). Smoke testing surfaced
  these as `[VoilaJSX AppKit] Environment variable …` warnings printed to
  consumer terminals. All cleaned up:
  - `[VoilaJSX AppKit]` → `[Bloomneo AppKit]` (runtime warning prefix in
    `cache/defaults.ts`, `util/defaults.ts`, `config/defaults.ts`)
  - `[VoilaJSX Utils]` → `[Bloomneo Utils]` (in `util/util.ts`)
  - HTTP `User-Agent: VoilaJSX-AppKit-Logging/1.0.0` → `Bloomneo-AppKit-Logging/1.0.0`
    (in `logger/transports/http.ts` and `logger/transports/webhook.ts`)
  - HTTP `User-Agent: VoilaJSX-AppKit-Email/1.0.0` → `Bloomneo-AppKit-Email/1.0.0`
    (in `email/strategies/resend.ts`)
  - Webhook footer string `VoilaJSX AppKit Logging` → `Bloomneo AppKit Logging`
    (in `logger/transports/webhook.ts`)
  - JSDoc references to `VoilaJSX framework`, `VoilaJSX standard`,
    `VoilaJSX app discovery`, `VoilaJSX structure`, `VoilaJSX startup` →
    all renamed to `Bloomneo` equivalents
  - Module README license footers `MIT © [VoilaJSX]` → `MIT © [Bloomneo]`

### Not changed (in 1.5.1 — see 1.5.2 for the env var rename)

- **`VOILA_*` environment variable prefix was unchanged in 1.5.1.** At the
  time, AppKit still read `VOILA_AUTH_SECRET`, `VOILA_DB_URL`, etc. Renaming
  the prefix was deferred from this release. The prefix was treated as a
  schema convention, not a brand mention.
- **The `VOILA_*` prefix was removed entirely in the next release (1.5.2).**
  See the 1.5.2 entry below for migration instructions.

### Verification

- Final grep sweep: 0 `VoilaJSX` references in `src/`
- `npm run build` (tsc): green, all 11 sub-modules compile
- `npm pack --dry-run`: tarball name updated to `bloomneo-appkit-1.5.1.tgz`

## [1.2.9] - 2026-04-10

Republish under the `@bloomneo` scope (was `@voilajsx/appkit`). API,
behavior, and types are identical to `@voilajsx/appkit@1.2.8`. The
`@voilajsx` npm account was lost; this release migrates the package to
the new `@bloomneo` namespace. Run `npm install @bloomneo/appkit` and
do a project-wide find-and-replace of `@voilajsx/appkit` →
`@bloomneo/appkit` to migrate.
