# Migrating to @bloomneo/appkit 6

> Work in progress on the `next` branch (6.0.0-alpha). Filled in as each change lands.
> The plan: `~/vc/production/BLOOMNEO-6-CHECKLIST.md` (Phases 2–4).

appkit 6 keeps every API the production apps call, with the same names:
`auth.requireLoginToken / requireUserRoles / hashPassword / comparePassword /
generateLoginToken / getUser / verifyToken / hasRole / generateApiToken`,
`error.*`, `database.get()`, `logger.get()`, `security.requests()`,
`email.send`, `config.get`, and the subpath imports.

## Versioning

appkit, uikit and bloom now release together on one version number. 6.0.0 of
each is designed to be used with 6.0.0 of the others.

## Removed

_None yet._

## Changed

_None yet._
