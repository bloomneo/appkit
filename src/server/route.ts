/**
 * Enforce a route contract on the server.
 *
 * `route(contract, handler)` gives the handler exactly what the contract
 * promised — validated params, query and body, the signed-in user — and
 * applies, from the contract alone and in this order:
 *
 *   1. the auth decision   ('public' | 'user' | 'apiToken' | { roles })
 *   2. the tenant context  (database.context() for tenant-scoped routes)
 *   3. input validation    (400 with the failing fields)
 *
 * The handler returns the response body; appkit sends it (201 for POST).
 * Nothing about auth or tenancy is left for the handler to remember.
 *
 * ```ts
 * export default contractRouter([
 *   route(getInvoice, async ({ params }) => {
 *     const db = await databaseClass.get();        // scoped to the caller's tenant
 *     return db.invoice.findUniqueOrThrow({ where: { id: params.id } });
 *   }),
 * ]);
 * ```
 */
import type { Request, Response as ExpressResponse, NextFunction, RequestHandler } from 'express';
import { authClass } from '../auth/index.js';
import { databaseClass } from '../database/index.js';
import { errorClass, AppError } from '../error/index.js';
import { loadExpress } from './peers.js';
import {
  isTenantScoped,
  validateWith,
  type Body,
  type Params,
  type Query,
  type Response,
  type RouteContract,
} from './contract.js';
import { ServerError } from './errors.js';

export interface HandlerContext<C extends RouteContract> {
  params: Params<C>;
  query: Query<C>;
  body: Body<C>;
  /** The verified token payload; undefined on public routes. */
  user: Express.User | undefined;
  req: Request;
  res: ExpressResponse;
}

export type ContractHandler<C extends RouteContract> = (
  ctx: HandlerContext<C>,
) => Response<C> | Promise<Response<C>> | void | Promise<void>;

export interface ContractRoute<C extends RouteContract = RouteContract> {
  readonly contract: C;
  readonly handlers: RequestHandler[];
}

function authMiddleware(contract: RouteContract): RequestHandler[] {
  const a = contract.auth;
  // Public routes never touch auth, so an app with no BLOOM_AUTH_SECRET
  // (no auth at all) can still serve them.
  if (a === 'public') return [];
  const auth = authClass.get();
  if (a === 'user') return [auth.requireLoginToken()];
  if (a === 'apiToken') return [auth.requireApiToken()];
  if (a && typeof a === 'object' && Array.isArray(a.roles) && a.roles.length) {
    return [auth.requireLoginToken(), auth.requireUserRoles([...a.roles])];
  }
  // defineRoute() already refuses this; a hand-written object might not.
  throw new ServerError(
    `[@bloomneo/appkit/server] ${contract.method} ${contract.path}: auth must be 'public', 'user', 'apiToken' or { roles }`,
    { code: 'SERVER_CONTRACT_NO_AUTH' },
  );
}

/**
 * Turn a contract and its handler into Express handlers. The handler's
 * inputs and return type come from the contract.
 */
export function route<C extends RouteContract>(contract: C, handler: ContractHandler<C>): ContractRoute<C> {
  if (!contract || typeof contract.path !== 'string' || !contract.method) {
    throw new ServerError('[@bloomneo/appkit/server] route(contract, handler) needs a contract from defineRoute()', {
      code: 'SERVER_NOT_A_CONTRACT',
    });
  }
  const error = errorClass.get();
  const isProduction = process.env.NODE_ENV === 'production';

  const validateInput: RequestHandler = async (req, _res, next) => {
    try {
      const failures: Array<{ part: string; path: string; message: string }> = [];
      for (const part of ['params', 'query', 'body'] as const) {
        const result = await validateWith(contract[part], (req as any)[part]);
        if (result.ok) (req as any)[`validated_${part}`] = result.value;
        else failures.push(...result.issues.map((i) => ({ part, ...i })));
      }
      if (failures.length) {
        return next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', { issues: failures }));
      }
      next();
    } catch (err) {
      next(err);
    }
  };

  const run: RequestHandler = error.asyncRoute(async (req: Request, res: ExpressResponse) => {
    const r = req as any;
    const result = await handler({
      params: r.validated_params,
      query: r.validated_query,
      body: r.validated_body,
      user: req.user,
      req,
      res,
    });
    if (res.headersSent) return;
    if (!isProduction && contract.response && result !== undefined) {
      // A response that breaks its own contract is a server bug; report it
      // loudly in development instead of shipping the wrong shape silently.
      const check = await validateWith(contract.response, result);
      if (!check.ok) {
        console.warn(
          `[@bloomneo/appkit/server] ${contract.method} ${contract.path} returned a body that does not match its contract:`,
          check.issues,
        );
      }
    }
    if (result === undefined) res.status(204).end();
    else res.status(contract.method === 'POST' ? 201 : 200).json(result);
  }) as RequestHandler;

  const handlers: RequestHandler[] = [
    ...authMiddleware(contract),
    ...(isTenantScoped(contract) ? [databaseClass.context() as RequestHandler] : []),
    validateInput,
    run,
  ];
  return { contract, handlers };
}

export const CONTRACT_ROUTER = Symbol.for('bloomneo.appkit.contractRouter');

/**
 * An Express router serving a feature's contract routes. Mount it where the
 * API is mounted: contract paths start with /api, and the /api prefix is
 * matched by the mount point.
 */
export async function contractRouter(routes: ContractRoute[]): Promise<any> {
  const express = await loadExpress();
  const router = (express.default ?? express).Router();
  for (const { contract, handlers } of routes) {
    const path = contract.path.replace(/^\/api(?=\/|$)/, '') || '/';
    (router as any)[contract.method.toLowerCase()](path, ...handlers);
  }
  Object.defineProperty(router, CONTRACT_ROUTER, {
    value: routes.map((r) => r.contract),
    enumerable: false,
  });
  return router;
}

export type { NextFunction };
