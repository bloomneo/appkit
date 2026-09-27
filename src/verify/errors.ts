/**
 * Typed error for @bloomneo/appkit/verify.
 * @module @bloomneo/appkit/verify
 * @file src/verify/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown for verifier misuse (missing baseUrl, remote host without allowRemote, too few identities).
 * `instanceof AppKitError` also true.
 */
export class VerifyError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'verify',
      code: options?.code ?? 'VERIFY_ERROR',
      cause: options?.cause,
    });
    this.name = 'VerifyError';
    this.code = options?.code ?? 'VERIFY_ERROR';
  }
}
