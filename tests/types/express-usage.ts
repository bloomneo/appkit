/**
 * tests/types/express-usage.ts — compiled by `npm run test:types`, never run.
 *
 * appkit middleware must plug into a real Express app with Express's own
 * types and no `as any`, and `req.user` must be typed from the login token.
 * Every line below is how the production apps use appkit; if one needs a cast
 * again, this file stops compiling.
 */

import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { authClass } from '../../src/auth/index.js';
import { errorClass } from '../../src/error/index.js';
import { securityClass } from '../../src/security/index.js';
import type {
  ExpressRequest,
  ExpressResponse,
  ExpressMiddleware,
  JwtPayload,
} from '../../src/auth/index.js';
import type { ExpressErrorHandler, ExpressNextFunction } from '../../src/error/index.js';

const app = express();
const auth = authClass.get();
const error = errorClass.get();
const security = securityClass.get();

app.use(security.requests(100, 60_000));
app.use(...securityClass.quickSetup());

// The canonical protected route: login → role → async handler.
app.get(
  '/x',
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const tenantId: string | null | undefined = req.user?.tenantId;
    const role: string | undefined = req.user?.role;
    const where: { tenantId?: string; clientId?: string } = auth.scopedWhere(req);
    const user: JwtPayload | null = auth.getUser(req);
    res.json({ tenantId, role, where, user });
  }),
);

// Class-level shortcut and route params still typed.
app.post(
  '/items/:id',
  auth.requireLoginToken(),
  errorClass.asyncRoute(async (req, res) => {
    const id = String(req.params.id);
    if (!id) throw error.badRequest('id required');
    res.status(201).json({ id, by: req.user?.userId });
  }),
);

// API tokens land on req.token.
app.get('/api', auth.requireApiToken(), (req: Request, res: Response) => {
  const keyId: string | undefined = req.token?.keyId;
  res.json({ keyId });
});

// Plain Express handlers keep working alongside.
app.get('/plain', (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(error.unauthorized());
  res.json({ userId: req.user.userId });
});

app.use(error.handleErrors());
app.use(errorClass.handleErrors({ showStack: false }));

// Middleware factories return Express RequestHandlers.
const handlers: RequestHandler[] = [auth.requireLoginToken(), auth.requireUserRoles(['user.basic'])];
void handlers;

// The pre-6.0 names are aliases of the Express types.
const aliasReq: ExpressRequest = {} as Request;
const backReq: Request = aliasReq;
const aliasRes: ExpressResponse = {} as Response;
const backRes: Response = aliasRes;
const aliasNext: ExpressNextFunction = (() => {}) as NextFunction;
const aliasMw: ExpressMiddleware = auth.requireLoginToken();
const aliasErr: ExpressErrorHandler = error.handleErrors();
void [backReq, backRes, aliasNext, aliasMw, aliasErr];

// req.user is typed, not any.
app.get('/neg', (req: Request) => {
  // @ts-expect-error tenantId is string | null | undefined, not number
  const n: number = req.user?.tenantId;
  // @ts-expect-error role is a string
  const b: boolean = req.user!.role;
  void [n, b];
});
