/**
 * Typed error for @bloomneo/appkit/config.
 * @module @bloomneo/appkit/config
 * @file src/config/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

/**
 * Thrown for configuration misuse (missing required config, bad env values, overrides passed after first get()).
 * `instanceof AppKitError` also true.
 */
export class ConfigError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'config',
      code: options?.code ?? 'CONFIG_ERROR',
      cause: options?.cause,
    });
    this.name = 'ConfigError';
    this.code = options?.code ?? 'CONFIG_ERROR';
  }
}
