/**
 * Shared metadata filter for minimal-scope transports
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/meta.ts
 *
 * @llm-rule WHEN: A transport needs to shrink caller-supplied meta in minimal scope
 * @llm-rule AVOID: Filtering by field name - measurements like lagMs or rssMB are exactly
 *                  the fields you need when debugging, and they cost a handful of bytes
 * @llm-rule NOTE: Minimal scope exists to bound file size, so this drops by cost (bulky
 *                 strings, arrays, objects) rather than by name, and always leaves a trace
 */
/**
 * Correlation fields kept whatever their type.
 */
const CORRELATION_KEYS = new Set([
    'traceId',
    'spanId',
    'sessionId',
    'tenantId',
    'appName',
    'ip',
]);
/** Longest string value kept before it is truncated. */
const MAX_STRING_LENGTH = 200;
/**
 * Keep correlation IDs and cheap diagnostic values, summarize bulky payloads.
 * @llm-rule WHEN: Building a minimal-scope log entry in any transport
 * @llm-rule AVOID: Dropping a key entirely - a summarized value tells the reader to
 *                  re-run with BLOOM_LOGGER_SCOPE=full, a missing key tells them nothing
 */
export function filterEssentialMeta(meta) {
    const essential = {};
    if (!meta || typeof meta !== 'object')
        return essential;
    for (const [key, value] of Object.entries(meta)) {
        if (value === undefined)
            continue;
        // Correlation data survives regardless of shape.
        if (CORRELATION_KEYS.has(key) || key.endsWith('Id')) {
            essential[key] = value;
            continue;
        }
        // Scalars are the measurements - lagMs, rssMB, statusCode, retry counts. These
        // are what make a line actionable, and they cost a few bytes each.
        if (value === null ||
            typeof value === 'number' ||
            typeof value === 'boolean') {
            essential[key] = value;
            continue;
        }
        if (typeof value === 'string') {
            essential[key] =
                value.length > MAX_STRING_LENGTH
                    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
                    : value;
            continue;
        }
        // Arrays and objects are the real file-size risk. Record the shape so the line
        // still names the field, without inlining its contents.
        if (Array.isArray(value)) {
            essential[key] = `[${value.length} items]`;
            continue;
        }
        if (typeof value === 'object') {
            essential[key] = `{${Object.keys(value).length} keys}`;
        }
    }
    return essential;
}
//# sourceMappingURL=meta.js.map