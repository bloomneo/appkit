/**
 * Typed error for @bloomneo/appkit/auth.
 * @module @bloomneo/appkit/auth
 * @file src/auth/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown for auth misuse and configuration problems (bad BLOOM_AUTH_* values, missing secret, invalid payloads, invalid role.level). Token verification failures throw the narrower TokenError instead.
 * `instanceof AppKitError` also true.
 */
export class AuthError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'auth',
      code: options?.code ?? 'AUTH_ERROR',
      cause: options?.cause,
    });
    this.name = 'AuthError';
    this.code = options?.code ?? 'AUTH_ERROR';
  }
}
