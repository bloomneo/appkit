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
import { type SecurityConfig } from './defaults.js';
/**
 * Get security instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any operation that needs security protection - this is your main entry point
 * @llm-rule AVOID: Calling new SecurityClass() directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → security.forms() → security.requests() → security.input()
 */
declare function get(overrides?: Partial<SecurityConfig>): SecurityClass;
/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing security logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<SecurityConfig>): SecurityClass;
/**
 * Clear the cached security instance
 * @llm-rule WHEN: Testing or when you need to reload environment variables
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function clearCache(): void;
/**
 * Get current security configuration for inspection
 * @llm-rule WHEN: Debugging security behavior or documenting security configuration
 * @llm-rule AVOID: Using for runtime security decisions - use get() instead
 */
declare function getConfig(): SecurityConfig;
/**
 * Check if running in development mode (affects security logging)
 * @llm-rule WHEN: Need to conditionally add debug information to security logs
 * @llm-rule AVOID: Manual NODE_ENV checks - use this for consistency
 */
declare function isDevelopment(): boolean;
/**
 * Check if running in production mode (affects security strictness)
 * @llm-rule WHEN: Need to conditionally enable strict security measures
 * @llm-rule AVOID: Manual NODE_ENV checks - use this for consistency
 */
declare function isProduction(): boolean;
/**
 * Generate a secure encryption key for production use
 * @llm-rule WHEN: Setting up encryption for the first time or rotating keys
 * @llm-rule AVOID: Using weak or predictable keys - always use this for key generation
 * @llm-rule NOTE: Returns 64-character hex string suitable for VOILA_SECURITY_ENCRYPTION_KEY
 */
declare function generateKey(): string;
/**
 * Quick security setup helper for common Express app patterns
 * @llm-rule WHEN: Setting up basic security for Express apps quickly
 * @llm-rule AVOID: Using without understanding - review each middleware for your needs
 * @llm-rule NOTE: Returns array of middleware: [CSRF protection, rate limiting]
 */
declare function quickSetup(options?: {
    csrf?: boolean;
    rateLimit?: boolean;
    maxRequests?: number;
    windowMs?: number;
}): Array<any>;
/**
 * Validate security configuration at startup
 * @llm-rule WHEN: App startup to ensure required security config is present
 * @llm-rule AVOID: Using in request handlers - expensive validation
 * @llm-rule NOTE: Throws descriptive errors with environment variable names
 */
declare function validateRequired(checks?: {
    csrf?: boolean;
    encryption?: boolean;
    rateLimit?: boolean;
}): void;
/**
 * Get security status for health checks and monitoring
 * @llm-rule WHEN: Building health check endpoints or security monitoring
 * @llm-rule AVOID: Exposing sensitive security details - this only shows availability
 */
declare function getStatus(): {
    csrf: boolean;
    encryption: boolean;
    rateLimit: boolean;
    environment: string;
};
/**
 * Single security export with enhanced functionality
 */
export declare const securityClass: {
    readonly get: typeof get;
    readonly reset: typeof reset;
    readonly clearCache: typeof clearCache;
    readonly getConfig: typeof getConfig;
    readonly isDevelopment: typeof isDevelopment;
    readonly isProduction: typeof isProduction;
    readonly generateKey: typeof generateKey;
    readonly quickSetup: typeof quickSetup;
    readonly validateRequired: typeof validateRequired;
    readonly getStatus: typeof getStatus;
};
export type { SecurityConfig, CSRFConfig, RateLimitConfig, SanitizationConfig, EncryptionConfig, EnvironmentConfig, SecurityError, } from './defaults.js';
export type { ExpressRequest, ExpressResponse, ExpressNextFunction, ExpressMiddleware, CSRFOptions, RateLimitOptions, InputOptions, HTMLOptions, } from './security.js';
export { SecurityClass } from './security.js';
//# sourceMappingURL=index.d.ts.map