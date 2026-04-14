/**
 * examples/error.ts
 *
 * Runnable tour of the @bloomneo/appkit/error module.
 *
 * Two usage styles, pick whichever reads better:
 *   • Shortcut:   errorClass.badRequest('...')
 *   • Instance:   errorClass.get().badRequest('...')
 *
 * Run: tsx examples/error.ts
 */

import { errorClass } from '../src/error/index.js';

function main() {
  // 1. Create typed HTTP errors with one call. They're thrown like any Error.
  const errs = [
    errorClass.badRequest('Email required'),
    errorClass.unauthorized('Login required'),
    errorClass.forbidden('Admin only'),
    errorClass.notFound('User not found'),
    errorClass.conflict('Email already exists'),
    errorClass.tooMany('Slow down'),
    errorClass.serverError('Database unavailable'),
    errorClass.createError(503, 'Maintenance mode', 'MAINTENANCE'),
  ];
  for (const e of errs) {
    console.log(e.statusCode, e.message);
  }

  // 2. Classifying errors (useful for logging/metrics).
  const e = errorClass.notFound('gone');
  console.log('isClientError =', errorClass.isClientError(e));
  console.log('isServerError =', errorClass.isServerError(e));

  // 3. Express wiring — two pieces:
  //
  //    (a) Wrap async handlers so thrown errors reach the middleware.
  //    app.get('/users/:id', errorClass.asyncRoute(async (req, res) => {
  //      const user = await db.user.findUnique({ where: { id: req.params.id } });
  //      if (!user) throw errorClass.notFound('User not found');
  //      res.json(user);
  //    }));
  //
  //    (b) Install the global handler LAST. It serializes AppError
  //    responses, hides stacks in production, and logs as appropriate.
  //    app.use(errorClass.handleErrors());
  //
  //    Build them here to prove the shapes are correct:
  const wrapped = errorClass.asyncRoute(async (_req, res) => res.json({ ok: true }));
  const handler = errorClass.handleErrors({ showStack: false, logErrors: true });
  console.log('asyncRoute()   →', typeof wrapped);
  console.log('handleErrors() →', typeof handler);
}

main();
