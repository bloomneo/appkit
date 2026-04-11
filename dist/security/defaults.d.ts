/**
 * Smart defaults and environment validation for security
 * @module @bloomneo/appkit/security
 * @file src/security/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure security behavior and encryption keys
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export interface CSRFConfig {
    secret: string;
    tokenField: string;
    headerField: string;
    expiryMinutes: number;
}
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    message: string;
}
export interface SanitizationConfig {
    maxLength: number;
    allowedTags: string[];
    stripAllTags: boolean;
}
export interface EncryptionConfig {
    key?: string;
    algorithm: string;
    ivLength: number;
    tagLength: number;
    keyLength: number;
}
export interface EnvironmentConfig {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    nodeEnv: string;
}
export interface SecurityConfig {
    csrf: CSRFConfig;
    rateLimit: RateLimitConfig;
    sanitization: SanitizationConfig;
    encryption: EncryptionConfig;
    environment: EnvironmentConfig;
}
export interface SecurityError extends Error {
    statusCode: number;
    [key: string]: any;
}
/**
 * Gets smart defaults using BLOOM_SECURITY_* environment variables
 * @llm-rule WHEN: App startup to get production-ready security configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Automatically configures CSRF, rate limiting, and encryption from environment
 */
export declare function getSmartDefaults(): SecurityConfig;
/**
 * Creates security error with status code and additional details
 * @llm-rule WHEN: Creating errors in security functions for proper HTTP status codes
 * @llm-rule AVOID: Using generic Error objects - security errors need status codes
 * @llm-rule NOTE: Use 400 for client errors, 401 for auth failures, 403 for access denied, 500 for server errors
 */
export declare function createSecurityError(message: string, statusCode?: number, details?: Record<string, any>): SecurityError;
//# sourceMappingURL=defaults.d.ts.map