/**
 * Environment-driven defaults for the MCP module
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/defaults.ts
 *
 * @llm-rule WHEN: App startup - resolving MCP server identity and auth posture
 * @llm-rule AVOID: Reading process.env for MCP settings elsewhere - it all funnels through here
 * @llm-rule NOTE: BLOOM_MCP_REQUIRE_AUTH defaults to true; an unauthenticated MCP endpoint is an open API
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/mcp/README.md';
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
export function getSmartDefaults() {
    const requireAuthRaw = process.env.BLOOM_MCP_REQUIRE_AUTH;
    if (requireAuthRaw && !['true', 'false'].includes(requireAuthRaw)) {
        throw new Error(`[@bloomneo/appkit/mcp] Invalid BLOOM_MCP_REQUIRE_AUTH: "${requireAuthRaw}". Must be: true, false. See: ${DOCS_URL}#environment-variables`);
    }
    const version = process.env.BLOOM_MCP_VERSION ?? '1.0.0';
    if (!/^\d+\.\d+\.\d+/.test(version)) {
        throw new Error(`[@bloomneo/appkit/mcp] Invalid BLOOM_MCP_VERSION: "${version}". Must be semver. See: ${DOCS_URL}#environment-variables`);
    }
    return {
        name: process.env.BLOOM_MCP_NAME ?? process.env.npm_package_name ?? 'bloom-app',
        version,
        protocolVersion: process.env.BLOOM_MCP_PROTOCOL_VERSION ?? DEFAULT_PROTOCOL_VERSION,
        // Secure by default. An MCP endpoint with no auth is an unauthenticated
        // copy of your API surface, which is a worse hole than an open REST route
        // because it is self-describing.
        requireAuth: requireAuthRaw !== 'false',
        featuresDir: process.env.BLOOM_MCP_FEATURES_DIR ?? 'features',
    };
}
//# sourceMappingURL=defaults.js.map