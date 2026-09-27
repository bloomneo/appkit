/**
 * Tenant-isolation verifier — generates the cross-tenant attack matrix
 * @module @bloomneo/appkit/verify
 * @file src/verify/verify.ts
 *
 * @llm-rule WHEN: Proving an agent-written multi-tenant app does not leak across tenants
 * @llm-rule AVOID: Hand-writing per-endpoint leak tests - ids are discovered, so this scales
 * @llm-rule NOTE: Drives a RUNNING server over HTTP; it tests the app, not the framework
 *
 * The design point: resource ids are **discovered, not declared**. The verifier
 * logs in as each identity, harvests the ids that identity can legitimately
 * see, then replays every id against every other identity. That is what makes
 * it a generator rather than a template — it needs no per-app manifest of
 * routes or fixtures, and it grows automatically as the app grows.
 */
import type { VerifyOptions, VerifyReport } from './types.js';
export declare class VerifierClass {
    /**
     * Run the matrix against a live server.
     *
     * @llm-rule WHEN: A CI step, or a test that boots the app and asserts report.ok
     * @llm-rule AVOID: Running against production - refuses non-local URLs unless allowRemote
     * @llm-rule NOTE: DELETE probes run only with allowDestructive: true (use a disposable database)
     */
    run(options: VerifyOptions): Promise<VerifyReport>;
    /**
     * Ask the FBCA api-router which features exist, then probe each list route.
     * Falls back to an empty list, which the caller sees as a `skipped` entry
     * rather than a silent pass.
     */
    private discoverPaths;
    /**
     * Pull id-shaped strings out of a response, whatever its envelope.
     *
     * Handles `[...]`, `{ items: [...] }`, `{ clients: [...] }` and similar
     * without being told which key holds the collection — an app should not have
     * to describe its own response shape to be checked.
     */
    private extractIds;
    private validate;
    /** Human-readable report, for CI logs. */
    format(report: VerifyReport): string;
}
//# sourceMappingURL=verify.d.ts.map