# Changelog

All notable changes to AppKit will be documented in this file.

## [3.0.1] - 2026-04-16

Patch — fixes a template regression introduced by 3.0.0 removing the
library's auto-registered signal handlers.

### Fixed

- `bin/templates/backend/src/api/server.ts.template` now wires
  `process.on('SIGTERM' | 'SIGINT', …)` to a `gracefulShutdown` block that
  closes the HTTP server, flushes the logger, and shows a commented menu of
  per-module drain calls consumers uncomment for whichever modules they use.
  Scaffolded apps from `appkit generate app` no longer exit abruptly under
  SIGTERM.

### Known — deferred to 4.0.0

- Cross-module shutdown verb split. After 3.0.0, cache and queue expose
  `disconnectAll()` while email, event, and storage still expose `shutdown()`.
  Not a NAMING.md violation (policy forbids drift **within** a module, not
  across), but real agent-predictability friction — e.g. `cookbook/real-time-chat.ts`
  has `eventClass.shutdown()` and `cacheClass.disconnectAll()` on adjacent
  lines. Unifying requires a major (renaming `shutdown` → `disconnectAll`
  in email/event/storage is breaking).

## [3.0.0] - 2026-04-16

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
  process.on('SIGTERM', () => emailClass.shutdown().finally(() => process.exit(0)));
  process.on('SIGTERM', () => cacheClass.disconnectAll().finally(() => process.exit(0)));
  // ...etc for each module you use
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
