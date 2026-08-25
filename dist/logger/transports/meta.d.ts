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
 * Keep correlation IDs and cheap diagnostic values, summarize bulky payloads.
 * @llm-rule WHEN: Building a minimal-scope log entry in any transport
 * @llm-rule AVOID: Dropping a key entirely - a summarized value tells the reader to
 *                  re-run with BLOOM_LOGGER_SCOPE=full, a missing key tells them nothing
 */
export declare function filterEssentialMeta(meta: any): Record<string, any>;
//# sourceMappingURL=meta.d.ts.map