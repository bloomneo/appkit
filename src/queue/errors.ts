/**
 * Typed error for @bloomneo/appkit/queue.
 * @module @bloomneo/appkit/queue
 * @file src/queue/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown by queue operations (invalid job type, serialization errors, handler
 * timeout, transport failures). `instanceof AppKitError` also true.
 */
export class QueueError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'queue',
      code: options?.code ?? 'QUEUE_ERROR',
      cause: options?.cause,
    });
    this.name = 'QueueError';
    this.code = options?.code ?? 'QUEUE_ERROR';
  }
}
