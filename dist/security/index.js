/**
 * Ultra-simple enterprise security that just works
 * @module @bloomneo/appkit/security
 * @file src/security/index.ts
 *
 * @llm-rule WHEN: Building apps that need security protection (CSRF, rate limiting, input sanitization, encryption)
 * @llm-rule AVOID: Manual security implementation - this provides enterprise-grade protection automatically
 * @llm-rule NOTE: Common pattern - securityClass.get() → security.forms() → security.requests() → security.input()
 * @llm-rule NOTE: Use middleware first: forms() for CSRF, requests() for rate limiting, then input() for sanitization
 */
import { SecurityClass } from './security.js';
import { getSmartDefaults } from './defaults.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/security/README.md';
// Global security instance for performance
let globalSecurity = null;
/**
 * Get security instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any operation that needs security protection - this is your main entry point
 * @llm-rule AVOID: Calling new SecurityClass() directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → security.forms() → security.requests() → security.input()
 */
function get(overrides = {}) {
    // Lazy initialization - parse environment once
    if (!globalSecurity) {
        const defaults = getSmartDefaults();
        const config = { ...defaults, ...overrides };
        globalSecurity = new SecurityClass(config);
    }
    return globalSecurity;
}
/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing security logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function reset(newConfig = {}) {
    const defaults = getSmartDefaults();
    const config = { ...defaults, ...newConfig };
    globalSecurity = new SecurityClass(config);
    return globalSecurity;
}
/**
 * Clear the cached security instance
 * @llm-rule WHEN: Testing or when you need to reload environment variables
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function clearCache() {
    globalSecurity = null;
}
/**
 * Get current security configuration for inspection
 * @llm-rule WHEN: Debugging security behavior or documenting security configuration
 * @llm-rule AVOID: Using for runtime security decisions - use get() instead
 */
function getConfig() {
    const security = get();
    return security.config;
}
/**
 * Check if running in development mode (affects security logging)
 * @llm-rule WHEN: Need to conditionally add debug information to security logs
 * @llm-rule AVOID: Manual NODE_ENV checks - use this for consistency
 */
function isDevelopment() {
    const config = getConfig();
    return config.environment.isDevelopment;
}
/**
 * Check if running in production mode (affects security strictness)
 * @llm-rule WHEN: Need to conditionally enable strict security measures
 * @llm-rule AVOID: Manual NODE_ENV checks - use this for consistency
 */
function isProduction() {
    const config = getConfig();
    return config.environment.isProduction;
}
/**
 * Generate a secure encryption key for production use
 * @llm-rule WHEN: Setting up encryption for the first time or rotating keys
 * @llm-rule AVOID: Using weak or predictable keys - always use this for key generation
 * @llm-rule NOTE: Returns 64-character hex string suitable for BLOOM_SECURITY_ENCRYPTION_KEY
 */
function generateKey() {
    const security = get();
    return security.generateKey();
}
/**
 * Quick security setup helper for common Express app patterns
 * @llm-rule WHEN: Setting up basic security for Express apps quickly
 * @llm-rule AVOID: Using without understanding - review each middleware for your needs
 * @llm-rule NOTE: Returns array of middleware: [CSRF protection, rate limiting]
 */
function quickSetup(options = {}) {
    const security = get();
    const middleware = [];
    // Add CSRF protection if requested (default: true)
    if (options.csrf !== false) {
        middleware.push(security.forms());
    }
    // Add rate limiting if requested (default: true)
    if (options.rateLimit !== false) {
        middleware.push(security.requests(options.maxRequests, options.windowMs));
    }
    return middleware;
}
/**
 * Validate security configuration at startup
 * @llm-rule WHEN: App startup to ensure required security config is present
 * @llm-rule AVOID: Using in request handlers - expensive validation
 * @llm-rule NOTE: Throws descriptive errors with environment variable names
 */
function validateRequired(checks = {}) {
    const config = getConfig();
    const missing = [];
    if (checks.csrf && !config.csrf.secret) {
        missing.push('BLOOM_SECURITY_CSRF_SECRET or BLOOM_AUTH_SECRET');
    }
    if (checks.encryption && !config.encryption.key) {
        missing.push('BLOOM_SECURITY_ENCRYPTION_KEY');
    }
    if (missing.length > 0) {
        throw new Error(`[@bloomneo/appkit/security] Missing required security configuration: ${missing.join(', ')}. ` +
            `Set environment variables for production security. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Get security status for health checks and monitoring
 * @llm-rule WHEN: Building health check endpoints or security monitoring
 * @llm-rule AVOID: Exposing sensitive security details - this only shows availability
 */
function getStatus() {
    const config = getConfig();
    return {
        csrf: !!config.csrf.secret,
        encryption: !!config.encryption.key,
        rateLimit: true, // Always available
        environment: config.environment.nodeEnv,
    };
}
/**
 * Single security export with enhanced functionality
 */
export const securityClass = {
    // Core method
    get,
    // Utility methods
    reset,
    clearCache,
    getConfig,
    // Environment helpers
    isDevelopment,
    isProduction,
    // Security helpers
    generateKey,
    quickSetup,
    validateRequired,
    getStatus,
};
export { SecurityClass } from './security.js';
// Default export
export default securityClass;
//# sourceMappingURL=index.js.map