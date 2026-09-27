/**
 * Typed error for @bloomneo/appkit/storage.
 * @module @bloomneo/appkit/storage
 * @file src/storage/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown by storage operations (missing creds, invalid key, file not found
 * on get(), upload failures). `instanceof AppKitError` also true.
 */
export class StorageError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'storage',
      code: options?.code ?? 'STORAGE_ERROR',
      cause: options?.cause,
    });
    this.name = 'StorageError';
    this.code = options?.code ?? 'STORAGE_ERROR';
  }
}
