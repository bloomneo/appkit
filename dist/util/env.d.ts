/**
 * Environment variable reader for @bloomneo/appkit.
 *
 * Canonical prefix is `BLOOM_`. The legacy `VOILA_*` prefix from the original
 * `@voilajsx/appkit` package was removed entirely in 1.5.2 — there is no
 * backwards-compatibility, no fallback, no deprecation warning. Consumers
 * upgrading must rename their env vars in one go.
 *
 * Internal use only. Consumers should call `configClass.get()` instead of
 * touching env vars directly. This file exists so future code has one
 * canonical helper for reading env vars, instead of scattering
 * `process.env.BLOOM_*` calls across the codebase.
 *
 * @file src/util/env.ts
 */
/**
 * Read an env var by its bare name (no prefix).
 *
 * @example
 *   env('AUTH_SECRET')         // → process.env.BLOOM_AUTH_SECRET
 *   env('DB_TENANT')           // → process.env.BLOOM_DB_TENANT
 *   env('FOO', 'default-val')  // → returns 'default-val' if BLOOM_FOO unset
 */
export declare function env(name: string, fallback?: string): string | undefined;
/**
 * Read a numeric env var. Returns the fallback if the var is unset or
 * the value can't be parsed as a finite number.
 */
export declare function envNumber(name: string, fallback: number): number;
/**
 * Read a boolean env var. Truthy: 'true' / '1' / 'yes' / 'on' (case-insensitive).
 * Returns the fallback if the var is unset.
 */
export declare function envBool(name: string, fallback: boolean): boolean;
//# sourceMappingURL=env.d.ts.map