# Changelog

All notable changes to AppKit will be documented in this file.

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

### Not changed

- **`VOILA_*` environment variable prefix is unchanged.** AppKit still reads
  `VOILA_AUTH_SECRET`, `VOILA_DB_URL`, etc. Renaming the prefix would be a
  breaking change for every consumer with deployed `.env` files, so it stays.
  The prefix is a schema convention, not a brand mention. A future major
  release may introduce a `BLOOMNEO_*` alias with a deprecation period.

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
