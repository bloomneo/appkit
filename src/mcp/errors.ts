/**
 * Typed error for @bloomneo/appkit/mcp.
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/errors.ts
 *
 * Lives in its own file so every file in the module can import it without
 * an import cycle through index.ts.
 */

import { AppKitError } from '../internal/errors.js';

export class McpError extends AppKitError {
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, {
      module: 'mcp',
      code: options?.code ?? 'MCP_ERROR',
      cause: options?.cause,
    });
    this.name = 'McpError';
    this.code = options?.code ?? 'MCP_ERROR';
  }
}
