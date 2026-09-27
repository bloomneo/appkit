/**
 * Typed error for @bloomneo/appkit/logger.
 * @module @bloomneo/appkit/logger
 * @file src/logger/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown by logger bootstrap / transport setup. Regular log emit paths do NOT
 * throw (a failed transport is swallowed and reported on console) so consumers
 * don't lose app flow over log-delivery problems. `instanceof AppKitError`
 * also true.
 */
export class LoggerError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'logger',
      code: options?.code ?? 'LOGGER_ERROR',
      cause: options?.cause,
    });
    this.name = 'LoggerError';
    this.code = options?.code ?? 'LOGGER_ERROR';
  }
}
