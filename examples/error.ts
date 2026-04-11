/**
 * CANONICAL PATTERN — semantic HTTP errors + centralized middleware.
 *
 * Copy this file when you need error handling in routes. The pattern:
 *   1. Wrap async route handlers in error.asyncRoute(...)
 *   2. Throw semantic errors (badRequest, unauthorized, notFound, etc.)
 *      — never `throw new Error(...)` in route handlers
 *   3. Mount error.handleErrors() as the LAST middleware in the Express stack
 *
 * The asyncRoute wrapper catches the throw, and handleErrors() converts
 * the semantic error into the right HTTP status + JSON response.
 */

import express from 'express';
import { errorClass, databaseClass } from '@bloomneo/appkit';

const error = errorClass.get();
const database = await databaseClass.get();
const app = express();

// ── Routes use asyncRoute + semantic error throws ───────────────────
app.get('/api/users/:id', error.asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw error.badRequest('id must be a number');

  const user = await database.user.findUnique({ where: { id } });
  if (!user) throw error.notFound('User not found');

  res.json({ user });
}));

app.post('/api/admin', error.asyncRoute(async (req, res) => {
  if (req.body.role !== 'admin') throw error.forbidden('Admin role required');
  // ...
}));

// ── Available semantic error throwers ───────────────────────────────
//
//   throw error.badRequest('message')        → 400
//   throw error.unauthorized('message')      → 401
//   throw error.forbidden('message')         → 403
//   throw error.notFound('message')          → 404
//   throw error.conflict('message')          → 409
//   throw error.tooMany('message')           → 429  (rate limiting)
//   throw error.serverError('message')       → 500
//   throw error.internal('message')          → 500  (alias for serverError)
//   throw error.createError(503, 'message')  → any code

// ── MOUNT error.handleErrors() LAST in the middleware stack ─────────
app.use(error.handleErrors());
