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
let instance = null;
/**
 * Get the verifier - the only function you need to learn
 * @llm-rule WHEN: Adding a tenant-isolation gate to CI
 * @llm-rule AVOID: Creating VerifierClass directly - always use this function
 */
function get() {
    if (!instance)
        instance = new VerifierClass();
    return instance;
}
/**
 * Drop the cached verifier - essential for testing
 * @llm-rule WHEN: Testing the verifier itself
 * @llm-rule AVOID: Using in production - only for tests
 */
function reset() {
    instance = null;
    return get();
}
/** No connections are held; present so the teardown verb is uniform. */
function disconnectAll() {
    instance = null;
}
export const verifyClass = {
    get,
    reset,
    disconnectAll,
};
export { VerifierClass };
//# sourceMappingURL=index.js.map