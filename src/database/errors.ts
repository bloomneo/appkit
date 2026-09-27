/**
 * The database module's one error class. `instanceof AppKitError` is true.
 * Lives in its own file so the adapter and defaults can throw it without an
 * import cycle through index.ts.
 */
import { AppKitError } from '../internal/errors.js';

export class DatabaseError extends AppKitError {
  readonly code: string;
  /** HTTP status handleErrors() answers with. Default 500. */
  readonly statusCode: number;
  readonly details: unknown;

  constructor(
    message: string,
    options?: { code?: string; cause?: unknown; statusCode?: number; details?: unknown },
  ) {
    super(message, { module: 'database', code: options?.code ?? 'DATABASE_ERROR', cause: options?.cause });
    this.name = 'DatabaseError';
    this.code = options?.code ?? 'DATABASE_ERROR';
    this.statusCode = options?.statusCode ?? 500;
    this.details = options?.details ?? null;
  }
}
