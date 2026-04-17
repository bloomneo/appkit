/**
 * Unified error types for @bloomneo/appkit.
 *
 * Every typed error thrown by any module extends `AppKitError`, so consumers
 * can write a single catch clause:
 *
 *   try { ... } catch (err) {
 *     if (err instanceof AppKitError) {
 *       logger.warn('appkit operation failed', { module: err.module, code: err.code });
 *       throw error.server(err.message);
 *     }
 *     throw err;
 *   }
 *
 * Each module's subclass (e.g. `CacheError`, `TokenError`) retains its own
 * `code` and message format, but instanceof-checks against `AppKitError`
 * match all of them.
 *
 * The module-specific constructors format messages as:
 *
 *   [@bloomneo/appkit/<module>] <text>. See: <docs URL>
 *
 * so the original consumer experience is preserved. The only thing that
 * changed in 4.0.0 is the prototype chain.
 *
 * @file src/util/errors.ts
 */

const DOCS_BASE = 'https://github.com/bloomneo/appkit/blob/main';

export interface AppKitErrorOptions {
  /** Module name — populated automatically by subclasses. */
  module?: string;
  /** Machine-readable error code, e.g. 'CACHE_GET_FAILED'. */
  code?: string;
  /** URL to the README section that explains the fix. */
  docsUrl?: string;
  /** Underlying cause (wrapped error). Mirrors Error's `cause` option. */
  cause?: unknown;
}

/**
 * Base class for every typed error in appkit. Consumers check
 * `err instanceof AppKitError` to catch package errors uniformly.
 *
 * Subclasses format their own messages; this base just carries metadata and
 * makes the instanceof check work across modules.
 */
export class AppKitError extends Error {
  readonly module: string;
  readonly code: string;
  readonly docsUrl?: string;

  constructor(message: string, options?: AppKitErrorOptions) {
    super(message);
    this.name = 'AppKitError';
    this.module = options?.module ?? 'appkit';
    this.code = options?.code ?? 'APPKIT_ERROR';
    this.docsUrl = options?.docsUrl;
    if (options?.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}

/**
 * Throw if a required env var is missing. Use at module init / first .get()
 * call so the error is loud and immediate, not deferred to the first request.
 *
 * @example
 *   requireEnv('auth', 'BLOOM_AUTH_SECRET',
 *     'Set this to a 32+ character random string. See examples/.env.example.');
 */
export function requireEnv(module: string, varName: string, hint?: string): string {
  const value = process.env[varName];
  if (value === undefined || value === '') {
    const msg = hint
      ? `[@bloomneo/appkit/${module}] requires env var \`${varName}\`. ${hint}`
      : `[@bloomneo/appkit/${module}] requires env var \`${varName}\`.`;
    const docsUrl = `${DOCS_BASE}/src/${module}/README.md#environment-variables`;
    throw new AppKitError(`${msg}\nSee: ${docsUrl}`, {
      module,
      code: `${module.toUpperCase()}_MISSING_ENV`,
      docsUrl,
    });
  }
  return value;
}

/**
 * Throw if `value` is missing or wrongly typed. Use at the top of public
 * methods that depend on caller-provided data.
 */
export function requireProp<T>(
  module: string,
  prop: string,
  value: T | undefined | null,
  hint?: string,
): T {
  if (value === undefined || value === null) {
    const msg = hint
      ? `[@bloomneo/appkit/${module}] \`${prop}\` is required. ${hint}`
      : `[@bloomneo/appkit/${module}] \`${prop}\` is required.`;
    throw new AppKitError(msg, { module, code: `${module.toUpperCase()}_MISSING_PROP` });
  }
  return value;
}

/**
 * Lighter-weight version that only warns in development. Use for nice-to-have
 * conventions that shouldn't crash a production app on startup.
 */
export function warnInDev(module: string, message: string, slug?: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const base = `${DOCS_BASE}/src/${module}/README.md`;
  const url = slug ? `${base}#${slug}` : base;
  // eslint-disable-next-line no-console
  console.warn(`[@bloomneo/appkit/${module}] ${message}\nSee: ${url}`);
}
