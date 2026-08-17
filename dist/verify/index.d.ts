/**
 * Prove a multi-tenant app does not leak across tenants
 * @module @bloomneo/appkit/verify
 * @file src/verify/index.ts
 *
 * @llm-rule WHEN: CI, or a test that boots the app and asserts report.ok
 * @llm-rule AVOID: Creating VerifierClass directly - always use verifyClass.get()
 * @llm-rule NOTE: Drives a RUNNING server over HTTP; ids are discovered, never declared
 *
 * ```ts
 * const report = await verifyClass.get().run({
 *   baseUrl: 'http://localhost:3000',
 *   identities: [
 *     { label: 'firm-a', email: 'a@x.test', password: 'pw' },
 *     { label: 'firm-b', email: 'b@x.test', password: 'pw' },
 *   ],
 * });
 * expect(report.ok).toBe(true);
 * ```
 */
import { VerifierClass } from './verify.js';
import type { FindingKind, VerifyFinding, VerifyIdentity, VerifyOptions, VerifyReport } from './types.js';
/**
 * Get the verifier - the only function you need to learn
 * @llm-rule WHEN: Adding a tenant-isolation gate to CI
 * @llm-rule AVOID: Creating VerifierClass directly - always use this function
 */
declare function get(): VerifierClass;
/**
 * Drop the cached verifier - essential for testing
 * @llm-rule WHEN: Testing the verifier itself
 * @llm-rule AVOID: Using in production - only for tests
 */
declare function reset(): VerifierClass;
/** No connections are held; present so the teardown verb is uniform. */
declare function disconnectAll(): void;
export declare const verifyClass: {
    get: typeof get;
    reset: typeof reset;
    disconnectAll: typeof disconnectAll;
};
export { VerifierClass };
export type { VerifyOptions, VerifyReport, VerifyFinding, VerifyIdentity, FindingKind };
//# sourceMappingURL=index.d.ts.map