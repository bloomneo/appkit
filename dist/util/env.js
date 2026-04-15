/**
 * Environment variable reader for @bloomneo/appkit.
 *
 * All env vars use the `BLOOM_` prefix. Internal use only — consumers should
 * call `configClass.get()` instead of touching env vars directly.
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
export function env(name, fallback) {
    const value = process.env[`BLOOM_${name}`];
    return value !== undefined ? value : fallback;
}
/**
 * Read a numeric env var. Returns the fallback if the var is unset or
 * the value can't be parsed as a finite number.
 */
export function envNumber(name, fallback) {
    const raw = env(name);
    if (raw === undefined)
        return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}
/**
 * Read a boolean env var. Truthy: 'true' / '1' / 'yes' / 'on' (case-insensitive).
 * Returns the fallback if the var is unset.
 */
export function envBool(name, fallback) {
    const raw = env(name);
    if (raw === undefined)
        return fallback;
    const v = raw.toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}
//# sourceMappingURL=env.js.map