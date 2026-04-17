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
export declare class AppKitError extends Error {
    readonly module: string;
    readonly code: string;
    readonly docsUrl?: string;
    constructor(message: string, options?: AppKitErrorOptions);
}
/**
 * Throw if a required env var is missing. Use at module init / first .get()
 * call so the error is loud and immediate, not deferred to the first request.
 *
 * @example
 *   requireEnv('auth', 'BLOOM_AUTH_SECRET',
 *     'Set this to a 32+ character random string. See examples/.env.example.');
 */
export declare function requireEnv(module: string, varName: string, hint?: string): string;
/**
 * Throw if `value` is missing or wrongly typed. Use at the top of public
 * methods that depend on caller-provided data.
 */
export declare function requireProp<T>(module: string, prop: string, value: T | undefined | null, hint?: string): T;
/**
 * Lighter-weight version that only warns in development. Use for nice-to-have
 * conventions that shouldn't crash a production app on startup.
 */
export declare function warnInDev(module: string, message: string, slug?: string): void;
//# sourceMappingURL=errors.d.ts.map