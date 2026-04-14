/**
 * Smart defaults and environment validation for security
 * @module @bloomneo/appkit/security
 * @file src/security/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure security behavior and encryption keys
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/security/README.md';
/**
 * Gets smart defaults using BLOOM_SECURITY_* environment variables
 * @llm-rule WHEN: App startup to get production-ready security configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Automatically configures CSRF, rate limiting, and encryption from environment
 */
export function getSmartDefaults() {
    validateEnvironment();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    return {
        // CSRF configuration with fallback to auth secret
        csrf: {
            secret: process.env.BLOOM_SECURITY_CSRF_SECRET || process.env.BLOOM_AUTH_SECRET || '',
            tokenField: process.env.BLOOM_SECURITY_CSRF_FIELD || '_csrf',
            headerField: process.env.BLOOM_SECURITY_CSRF_HEADER || 'x-csrf-token',
            expiryMinutes: parseInt(process.env.BLOOM_SECURITY_CSRF_EXPIRY || '60'),
        },
        // Rate limiting with production-ready defaults
        rateLimit: {
            maxRequests: parseInt(process.env.BLOOM_SECURITY_RATE_LIMIT || '100'),
            windowMs: parseInt(process.env.BLOOM_SECURITY_RATE_WINDOW || String(15 * 60 * 1000)), // 15 minutes
            message: process.env.BLOOM_SECURITY_RATE_MESSAGE || 'Too many requests, please try again later',
        },
        // Input sanitization configuration
        sanitization: {
            maxLength: parseInt(process.env.BLOOM_SECURITY_MAX_INPUT_LENGTH || '1000'),
            allowedTags: process.env.BLOOM_SECURITY_ALLOWED_TAGS
                ? process.env.BLOOM_SECURITY_ALLOWED_TAGS.split(',').map(tag => tag.trim())
                : [],
            stripAllTags: process.env.BLOOM_SECURITY_STRIP_ALL_TAGS === 'true',
        },
        // Encryption configuration with AES-256-GCM
        encryption: {
            key: process.env.BLOOM_SECURITY_ENCRYPTION_KEY,
            algorithm: 'aes-256-gcm',
            ivLength: 16,
            tagLength: 16,
            keyLength: 32,
        },
        // Environment information
        environment: {
            isDevelopment,
            isProduction,
            isTest,
            nodeEnv,
        },
    };
}
/**
 * Validates environment variables for security configuration
 * @llm-rule WHEN: App startup to ensure proper security environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes security vulnerabilities
 * @llm-rule NOTE: Validates CSRF secrets, encryption keys, and rate limit values
 */
function validateEnvironment() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    // Validate CSRF secret in production
    const csrfSecret = process.env.BLOOM_SECURITY_CSRF_SECRET || process.env.BLOOM_AUTH_SECRET;
    if (!csrfSecret && nodeEnv === 'production') {
        console.warn(`[@bloomneo/appkit/security] BLOOM_SECURITY_CSRF_SECRET not set. ` +
            `CSRF protection will not work in production. ` +
            `Set BLOOM_SECURITY_CSRF_SECRET or BLOOM_AUTH_SECRET environment variable. See: ${DOCS_URL}#environment-variables`);
    }
    // Validate encryption key if provided
    const encryptionKey = process.env.BLOOM_SECURITY_ENCRYPTION_KEY;
    if (encryptionKey) {
        validateEncryptionKey(encryptionKey);
    }
    // Validate rate limit values
    const rateLimit = process.env.BLOOM_SECURITY_RATE_LIMIT;
    if (rateLimit) {
        const rateLimitNum = parseInt(rateLimit);
        if (isNaN(rateLimitNum) || rateLimitNum <= 0) {
            throw new Error(`[@bloomneo/appkit/security] Invalid BLOOM_SECURITY_RATE_LIMIT: "${rateLimit}". Must be a positive number. See: ${DOCS_URL}#environment-variables`);
        }
    }
    const rateWindow = process.env.BLOOM_SECURITY_RATE_WINDOW;
    if (rateWindow) {
        const rateWindowNum = parseInt(rateWindow);
        if (isNaN(rateWindowNum) || rateWindowNum <= 0) {
            throw new Error(`[@bloomneo/appkit/security] Invalid BLOOM_SECURITY_RATE_WINDOW: "${rateWindow}". Must be a positive number (milliseconds). See: ${DOCS_URL}#environment-variables`);
        }
    }
    // Validate max input length
    const maxLength = process.env.BLOOM_SECURITY_MAX_INPUT_LENGTH;
    if (maxLength) {
        const maxLengthNum = parseInt(maxLength);
        if (isNaN(maxLengthNum) || maxLengthNum <= 0) {
            throw new Error(`[@bloomneo/appkit/security] Invalid BLOOM_SECURITY_MAX_INPUT_LENGTH: "${maxLength}". Must be a positive number. See: ${DOCS_URL}#environment-variables`);
        }
    }
    // Validate CSRF expiry
    const csrfExpiry = process.env.BLOOM_SECURITY_CSRF_EXPIRY;
    if (csrfExpiry) {
        const csrfExpiryNum = parseInt(csrfExpiry);
        if (isNaN(csrfExpiryNum) || csrfExpiryNum <= 0) {
            throw new Error(`[@bloomneo/appkit/security] Invalid BLOOM_SECURITY_CSRF_EXPIRY: "${csrfExpiry}". Must be a positive number (minutes). See: ${DOCS_URL}#environment-variables`);
        }
    }
    // Production-specific warnings
    if (nodeEnv === 'production') {
        if (!encryptionKey) {
            console.warn(`[@bloomneo/appkit/security] BLOOM_SECURITY_ENCRYPTION_KEY not set. ` +
                `Data encryption will not be available in production. See: ${DOCS_URL}#environment-variables`);
        }
    }
    // Validate NODE_ENV
    if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
        console.warn(`[@bloomneo/appkit/security] Unusual NODE_ENV: "${nodeEnv}". ` +
            `Expected: development, production, test, or staging. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Validates encryption key format and length for AES-256-GCM
 * @llm-rule WHEN: Setting or validating encryption keys for data protection
 * @llm-rule AVOID: Using weak or incorrectly formatted keys - causes encryption failures
 * @llm-rule NOTE: Requires 64-character hex string (32 bytes) for AES-256
 */
function validateEncryptionKey(key) {
    if (typeof key !== 'string') {
        throw new Error(`[@bloomneo/appkit/security] BLOOM_SECURITY_ENCRYPTION_KEY must be a string. See: ${DOCS_URL}#environment-variables`);
    }
    // Check if it's a valid hex string
    if (!/^[0-9a-fA-F]+$/.test(key)) {
        throw new Error(`[@bloomneo/appkit/security] BLOOM_SECURITY_ENCRYPTION_KEY must be a valid hexadecimal string. ` +
            `Generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))". See: ${DOCS_URL}#environment-variables`);
    }
    // Check length (should be 64 hex characters for 32 bytes)
    if (key.length !== 64) {
        throw new Error(`[@bloomneo/appkit/security] BLOOM_SECURITY_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ` +
            `Current length: ${key.length}. ` +
            `Generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))". See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Creates security error with status code and additional details
 * @llm-rule WHEN: Creating errors in security functions for proper HTTP status codes
 * @llm-rule AVOID: Using generic Error objects - security errors need status codes
 * @llm-rule NOTE: Use 400 for client errors, 401 for auth failures, 403 for access denied, 500 for server errors
 */
export function createSecurityError(message, statusCode = 400, details = {}) {
    const error = new Error(message);
    error.statusCode = statusCode;
    Object.assign(error, details);
    return error;
}
//# sourceMappingURL=defaults.js.map