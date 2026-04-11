/**
 * Smart defaults and environment validation for security
 * @module @bloomneo/appkit/security
 * @file src/security/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure security behavior and encryption keys
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
/**
 * Gets smart defaults using VOILA_SECURITY_* environment variables
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
            secret: process.env.VOILA_SECURITY_CSRF_SECRET || process.env.VOILA_AUTH_SECRET || '',
            tokenField: process.env.VOILA_SECURITY_CSRF_FIELD || '_csrf',
            headerField: process.env.VOILA_SECURITY_CSRF_HEADER || 'x-csrf-token',
            expiryMinutes: parseInt(process.env.VOILA_SECURITY_CSRF_EXPIRY || '60'),
        },
        // Rate limiting with production-ready defaults
        rateLimit: {
            maxRequests: parseInt(process.env.VOILA_SECURITY_RATE_LIMIT || '100'),
            windowMs: parseInt(process.env.VOILA_SECURITY_RATE_WINDOW || String(15 * 60 * 1000)), // 15 minutes
            message: process.env.VOILA_SECURITY_RATE_MESSAGE || 'Too many requests, please try again later',
        },
        // Input sanitization configuration
        sanitization: {
            maxLength: parseInt(process.env.VOILA_SECURITY_MAX_INPUT_LENGTH || '1000'),
            allowedTags: process.env.VOILA_SECURITY_ALLOWED_TAGS
                ? process.env.VOILA_SECURITY_ALLOWED_TAGS.split(',').map(tag => tag.trim())
                : [],
            stripAllTags: process.env.VOILA_SECURITY_STRIP_ALL_TAGS === 'true',
        },
        // Encryption configuration with AES-256-GCM
        encryption: {
            key: process.env.VOILA_SECURITY_ENCRYPTION_KEY,
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
    const csrfSecret = process.env.VOILA_SECURITY_CSRF_SECRET || process.env.VOILA_AUTH_SECRET;
    if (!csrfSecret && nodeEnv === 'production') {
        console.warn('[Bloomneo AppKit] VOILA_SECURITY_CSRF_SECRET not set. ' +
            'CSRF protection will not work in production. ' +
            'Set VOILA_SECURITY_CSRF_SECRET or VOILA_AUTH_SECRET environment variable.');
    }
    // Validate encryption key if provided
    const encryptionKey = process.env.VOILA_SECURITY_ENCRYPTION_KEY;
    if (encryptionKey) {
        validateEncryptionKey(encryptionKey);
    }
    // Validate rate limit values
    const rateLimit = process.env.VOILA_SECURITY_RATE_LIMIT;
    if (rateLimit) {
        const rateLimitNum = parseInt(rateLimit);
        if (isNaN(rateLimitNum) || rateLimitNum <= 0) {
            throw new Error(`Invalid VOILA_SECURITY_RATE_LIMIT: "${rateLimit}". Must be a positive number.`);
        }
    }
    const rateWindow = process.env.VOILA_SECURITY_RATE_WINDOW;
    if (rateWindow) {
        const rateWindowNum = parseInt(rateWindow);
        if (isNaN(rateWindowNum) || rateWindowNum <= 0) {
            throw new Error(`Invalid VOILA_SECURITY_RATE_WINDOW: "${rateWindow}". Must be a positive number (milliseconds).`);
        }
    }
    // Validate max input length
    const maxLength = process.env.VOILA_SECURITY_MAX_INPUT_LENGTH;
    if (maxLength) {
        const maxLengthNum = parseInt(maxLength);
        if (isNaN(maxLengthNum) || maxLengthNum <= 0) {
            throw new Error(`Invalid VOILA_SECURITY_MAX_INPUT_LENGTH: "${maxLength}". Must be a positive number.`);
        }
    }
    // Validate CSRF expiry
    const csrfExpiry = process.env.VOILA_SECURITY_CSRF_EXPIRY;
    if (csrfExpiry) {
        const csrfExpiryNum = parseInt(csrfExpiry);
        if (isNaN(csrfExpiryNum) || csrfExpiryNum <= 0) {
            throw new Error(`Invalid VOILA_SECURITY_CSRF_EXPIRY: "${csrfExpiry}". Must be a positive number (minutes).`);
        }
    }
    // Production-specific warnings
    if (nodeEnv === 'production') {
        if (!encryptionKey) {
            console.warn('[Bloomneo AppKit] VOILA_SECURITY_ENCRYPTION_KEY not set. ' +
                'Data encryption will not be available in production.');
        }
    }
    // Validate NODE_ENV
    if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
        console.warn(`[Bloomneo AppKit] Unusual NODE_ENV: "${nodeEnv}". ` +
            `Expected: development, production, test, or staging`);
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
        throw new Error('VOILA_SECURITY_ENCRYPTION_KEY must be a string.');
    }
    // Check if it's a valid hex string
    if (!/^[0-9a-fA-F]+$/.test(key)) {
        throw new Error('VOILA_SECURITY_ENCRYPTION_KEY must be a valid hexadecimal string. ' +
            'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    // Check length (should be 64 hex characters for 32 bytes)
    if (key.length !== 64) {
        throw new Error(`VOILA_SECURITY_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ` +
            `Current length: ${key.length}. ` +
            `Generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
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