/**
 * Express types shared by every appkit middleware and handler.
 * @file src/internal/express.ts
 *
 * appkit's middleware (auth.requireLoginToken, security.requests,
 * error.asyncRoute, error.handleErrors, ...) takes and returns Express's own
 * types, so apps pass them straight to `app.get()` / `app.use()` with no
 * `as any`. The imports are type-only: express stays an optional peer and
 * nothing here exists at runtime.
 *
 * It also teaches Express what appkit's auth middleware attaches:
 *
 *   req.user   the verified login token (requireLoginToken)
 *   req.token  the verified API token   (requireApiToken)
 *
 * `req.user` is typed as `Express.User` — the same slot @types/passport uses —
 * so the two augmentations merge instead of conflicting. Apps can add their
 * own claims by augmenting `Express.User`.
 */

import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
} from 'express';
import type { JwtPayload } from '../auth/auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    /** Claims of the verified login token, set by auth.requireLoginToken(). */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
    interface User extends JwtPayload {}

    interface Request {
      /** Verified login token claims — set by auth.requireLoginToken(). */
      user?: User;
      /** Verified API token claims — set by auth.requireApiToken(). */
      token?: JwtPayload;
      /**
       * Per-request metadata set by Bloom's server (request id, start time).
       * Every Bloom app's routes read `req.requestMetadata?.requestId`; before
       * 6.0 appkit's loose request type allowed it implicitly.
       */
      requestMetadata?: { requestId?: string; startTime?: number; [key: string]: unknown };
      /** The request's correlation id, when the server sets one. */
      requestId?: string;
    }
  }
}

/** Express's `Request`. Kept under the pre-6.0 name for compatibility. */
export type ExpressRequest = Request;
/** Express's `Response`. Kept under the pre-6.0 name for compatibility. */
export type ExpressResponse = Response;
/** Express's `NextFunction`. Kept under the pre-6.0 name for compatibility. */
export type ExpressNextFunction = NextFunction;
/** Express's `RequestHandler` — what every appkit middleware factory returns. */
export type ExpressMiddleware = RequestHandler;
/** Express's `ErrorRequestHandler` — what error.handleErrors() returns. */
export type ExpressErrorHandler = ErrorRequestHandler;

/** The minimum getUser()/scopedWhere() read — any real Express request fits. */
export interface AuthenticatedRequestLike {
  user?: JwtPayload | Express.User | null;
  token?: JwtPayload | null;
}
