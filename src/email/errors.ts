/**
 * Typed error for @bloomneo/appkit/email.
 * @module @bloomneo/appkit/email
 * @file src/email/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown by email validation/send paths. `send()` itself returns an
 * EmailResult with `{success,error}` rather than throwing — EmailError fires
 * for config/bootstrap failures that the consumer needs to see at startup.
 * `instanceof AppKitError` also true.
 */
export class EmailError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'email',
      code: options?.code ?? 'EMAIL_ERROR',
      cause: options?.cause,
    });
    this.name = 'EmailError';
    this.code = options?.code ?? 'EMAIL_ERROR';
  }
}
