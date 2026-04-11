# Examples

One minimal `.ts` file per module. Each example is the smallest runnable shape
of the canonical pattern — copy, modify the data, ship.

For composed multi-module patterns (auth-protected CRUD, multi-tenant API,
file upload + queue, real-time chat), see [`../cookbook/`](../cookbook/).

## Conventions

- Always import from `@bloomneo/appkit` (or the subpath form).
- Always use `xxxClass.get()` to obtain a module instance.
- Always cache the module instance at module scope, not inside route handlers.
- Use semantic error throwers (`error.badRequest()`, `error.unauthorized()`),
  never `throw new Error(...)` in route handlers.
- See [`.env.example`](./.env.example) for the canonical environment template.
