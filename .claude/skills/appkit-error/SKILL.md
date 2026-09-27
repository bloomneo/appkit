---
name: appkit-error
description: >-
  Use when writing Express routes that need typed HTTP errors,
  `asyncRoute` error propagation, or the `handleErrors()` middleware from
  `@bloomneo/appkit/error`. Covers the canonical throw-semantic-errors pattern
  and how to avoid `try { } catch { res.status(500) }` boilerplate.
---

# @bloomneo/appkit/error

Single-entry HTTP error handling. Instead of `try/catch` + manual `res.status(...)`
in every route, you:

1. **Throw** semantic errors from anywhere (`error.badRequest`, `error.notFound`, ...)
2. **Wrap** route handlers with `error.asyncRoute(...)` so rejections propagate
3. **Register** `error.handleErrors()` as the last middleware to convert errors → HTTP responses

## Canonical flow

```ts
import express from 'express';
import { errorClass } from '@bloomneo/appkit/error';

const app = express();
const error = errorClass.get();

app.get('/users/:id',
  error.asyncRoute(async (req, res) => {
    const user = await db.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw error.notFound('User not found');
    if (!user.active) throw error.forbidden('User is deactivated');
    res.json(user);
  })
);

// LAST middleware — converts thrown errors into JSON responses
app.use(error.handleErrors());
```

## Error types — semantic not numeric

Throw by meaning, not by status code. The middleware maps to the right status.

| Method | Status | When |
|---|---:|---|
| `error.badRequest(msg)` | 400 | Client sent invalid input |
| `error.unauthorized(msg)` | 401 | No/invalid auth |
| `error.forbidden(msg)` | 403 | Authed but not allowed |
| `error.notFound(msg)` | 404 | Resource doesn't exist |
| `error.conflict(msg)` | 409 | State conflict (dup email, etc.) |
| `error.tooMany(msg)` | 429 | Rate limited |
| `error.serverError(msg)` | 500 | Unexpected server error (alias `error.internal`) |
| `error.createError(status, msg, type?)` | any | A status with no named method (502, 503, ...) |

Prefer the semantic method over `throw new Error(...)` — the middleware can't
classify a bare `Error` and will fall back to 500.

## Why `asyncRoute`

Plain `async` Express handlers that throw don't propagate to error middleware
automatically (Express 4 quirk; Express 5 fixes this). `asyncRoute` wraps the
handler so rejected promises reach `handleErrors()`.

In Express 5 it is still the canonical wrapper: one pattern for both majors,
and it returns Express's own `RequestHandler` type, so no casts are needed.

## What `handleErrors()` does (6.0)

- Errors with a `statusCode` (`AppError`, `SecurityError`) keep their status,
  type and message. `AppError` `details` (e.g. a failed contract validation's
  `issues`) are merged into the body.
- Anything else — including appkit configuration/misuse errors, every one an
  `AppKitError` — is a 500. In production its message is replaced by the
  generic server-error message; outside production the appkit `code` is sent.
- A 4xx `AppError` is logged as one `console.warn` line with no stack; server
  errors are logged with the stack.

## Public API

```ts
// Instance (from errorClass.get())
error.badRequest(msg?)               // → AppError (400)
error.unauthorized(msg?)             // 401
error.forbidden(msg?)                // 403
error.notFound(msg?)                 // 404
error.conflict(msg?)                 // 409
error.tooMany(msg?)                  // 429
error.serverError(msg?)              // 500 (alias: error.internal)
error.createError(status, msg, type?)
error.asyncRoute(handler)            // → Express RequestHandler (async-safe)
error.handleErrors({ showStack?, logErrors? })  // → error middleware (register LAST)

// Errors with client-safe details
new AppError(message, statusCode, type, details?)   // import { AppError } from '@bloomneo/appkit/error'

// Class
errorClass.get()                     // → instance
errorClass.reset(newConfig?)         // → void (tests only)
```

## Env vars

- `BLOOM_ERROR_STACK` — show stack traces in responses (default: `true` in dev)
- `BLOOM_ERROR_LOG` — log errors to console (default: `true`)
- `BLOOM_AUTH_MESSAGE` — override default 401 message

## Mistakes to avoid

- Throwing bare `new Error(...)` in route handlers — middleware returns 500.
- Registering `handleErrors()` before routes — Express runs middleware in order.
- `try { } catch (e) { res.status(500).json({ error: e.message }) }` — undoes the whole point.
- Calling the middleware as `error.handleErrors` (without `()`) — it's a factory.
