/** Errors from @bloomneo/appkit/server. `instanceof AppKitError` is true. */
import { AppKitError } from '../internal/errors.js';

export class ServerError extends AppKitError {
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, { module: 'server', code: options?.code ?? 'SERVER_ERROR', cause: options?.cause });
    this.name = 'ServerError';
  }
}
