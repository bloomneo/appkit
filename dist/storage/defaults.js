/**
 * Smart defaults and environment validation for file storage with auto-strategy detection
 * @module @bloomneo/appkit/storage
 * @file src/storage/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure storage system and connection strategy
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule NOTE: Auto-detects Local vs S3 vs R2 based on environment variables
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/storage/README.md';
/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready storage configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects strategy: S3/R2 env vars → Cloud, nothing → Local
 */
export function getSmartDefaults() {
    validateEnvironment();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    // Auto-detect strategy from environment
    const strategy = detectStorageStrategy();
    return {
        // Strategy selection with smart detection
        strategy,
        // Local configuration (only used when strategy is 'local')
        local: {
            dir: process.env.BLOOM_STORAGE_DIR || './uploads',
            baseUrl: process.env.BLOOM_STORAGE_BASE_URL || '/uploads',
            maxFileSize: parseInt(process.env.BLOOM_STORAGE_MAX_SIZE || '52428800'), // 50MB default
            allowedTypes: parseAllowedTypes(),
            createDirs: process.env.BLOOM_STORAGE_CREATE_DIRS !== 'false',
        },
        // S3 configuration (only used when strategy is 's3')
        s3: {
            bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '',
            region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
            endpoint: process.env.S3_ENDPOINT,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
            signedUrlExpiry: parseInt(process.env.BLOOM_STORAGE_SIGNED_EXPIRY || '3600'), // 1 hour
            cdnUrl: process.env.BLOOM_STORAGE_CDN_URL,
        },
        // R2 configuration (only used when strategy is 'r2')
        r2: {
            bucket: process.env.CLOUDFLARE_R2_BUCKET || '',
            accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
            cdnUrl: process.env.CLOUDFLARE_R2_CDN_URL,
            signedUrlExpiry: parseInt(process.env.BLOOM_STORAGE_SIGNED_EXPIRY || '3600'), // 1 hour
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
 * Auto-detect storage strategy from environment variables
 * @llm-rule WHEN: Determining which storage strategy to use automatically
 * @llm-rule AVOID: Manual strategy selection - environment detection handles most cases
 * @llm-rule NOTE: Priority: R2 → S3 → Local (R2 has zero egress fees)
 */
function detectStorageStrategy() {
    // Explicit override wins (for testing/debugging)
    const explicit = process.env.BLOOM_STORAGE_STRATEGY?.toLowerCase();
    if (explicit && ['local', 's3', 'r2'].includes(explicit)) {
        return explicit;
    }
    // Auto-detection logic - prioritize R2 for cost savings
    if (process.env.CLOUDFLARE_R2_BUCKET) {
        return 'r2'; // Cloudflare R2 - zero egress fees
    }
    if (process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.S3_ENDPOINT) {
        return 's3'; // S3-compatible services
    }
    // Default to local for development/single server
    if (process.env.NODE_ENV === 'production') {
        console.warn(`[@bloomneo/appkit/storage] No cloud storage configured in production. ` +
            `Using local filesystem which may not scale. ` +
            `Set AWS_S3_BUCKET or CLOUDFLARE_R2_BUCKET for cloud storage. See: ${DOCS_URL}#environment-variables`);
    }
    return 'local'; // Default to local filesystem
}
/**
 * Parse allowed file types from environment with safe defaults
 * @llm-rule WHEN: Setting up file type restrictions for security
 * @llm-rule AVOID: Allowing all file types in production - security risk
 */
function parseAllowedTypes() {
    const envTypes = process.env.BLOOM_STORAGE_ALLOWED_TYPES;
    if (!envTypes) {
        // Safe defaults - common web file types
        return [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'text/plain', 'text/csv', 'application/json',
            'application/pdf', 'application/zip',
            'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'
        ];
    }
    if (envTypes === '*') {
        if (process.env.NODE_ENV === 'production') {
            console.warn(`[@bloomneo/appkit/storage] SECURITY WARNING: All file types allowed in production. ` +
                `Set BLOOM_STORAGE_ALLOWED_TYPES to specific types for security. See: ${DOCS_URL}#environment-variables`);
        }
        return ['*']; // Allow all types (use with caution)
    }
    return envTypes.split(',').map(type => type.trim()).filter(Boolean);
}
/**
 * Validates environment variables for storage configuration
 * @llm-rule WHEN: App startup to ensure proper storage environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes runtime failures
 * @llm-rule NOTE: Validates cloud credentials, bucket names, and numeric values
 */
function validateEnvironment() {
    // Validate storage strategy if explicitly set
    const strategy = process.env.BLOOM_STORAGE_STRATEGY;
    if (strategy && !['local', 's3', 'r2'].includes(strategy.toLowerCase())) {
        throw new Error(`[@bloomneo/appkit/storage] Invalid BLOOM_STORAGE_STRATEGY: "${strategy}". Must be "local", "s3", or "r2". See: ${DOCS_URL}#environment-variables`);
    }
    // Validate numeric values
    validateNumericEnv('BLOOM_STORAGE_MAX_SIZE', 1048576, 1073741824); // 1MB to 1GB
    validateNumericEnv('BLOOM_STORAGE_SIGNED_EXPIRY', 60, 604800); // 1 minute to 7 days
    // Validate S3 configuration if S3 strategy detected
    if (shouldValidateS3()) {
        validateS3Config();
    }
    // Validate R2 configuration if R2 strategy detected
    if (shouldValidateR2()) {
        validateR2Config();
    }
    // Validate local configuration if local strategy
    if (shouldValidateLocal()) {
        validateLocalConfig();
    }
    // Production-specific validations
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
        validateProductionConfig();
    }
    // Validate NODE_ENV
    if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
        console.warn(`[@bloomneo/appkit/storage] Unusual NODE_ENV: "${nodeEnv}". ` +
            `Expected: development, production, test, or staging. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Check if S3 validation is needed
 */
function shouldValidateS3() {
    return !!(process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.S3_ENDPOINT);
}
/**
 * Check if R2 validation is needed
 */
function shouldValidateR2() {
    return !!process.env.CLOUDFLARE_R2_BUCKET;
}
/**
 * Check if local validation is needed
 */
function shouldValidateLocal() {
    const strategy = detectStorageStrategy();
    return strategy === 'local';
}
/**
 * Validates S3 configuration
 */
function validateS3Config() {
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
    if (!bucket) {
        throw new Error(`[@bloomneo/appkit/storage] S3 bucket name required. Set AWS_S3_BUCKET or S3_BUCKET environment variable. See: ${DOCS_URL}#environment-variables`);
    }
    if (!isValidBucketName(bucket)) {
        throw new Error(`[@bloomneo/appkit/storage] Invalid S3 bucket name: "${bucket}". Must be 3-63 characters, lowercase, no dots. See: ${DOCS_URL}#environment-variables`);
    }
    const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
    if (!accessKey || !secretKey) {
        throw new Error(`[@bloomneo/appkit/storage] S3 credentials required. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables. See: ${DOCS_URL}#environment-variables`);
    }
    const endpoint = process.env.S3_ENDPOINT;
    if (endpoint && !isValidUrl(endpoint)) {
        throw new Error(`[@bloomneo/appkit/storage] Invalid S3 endpoint: "${endpoint}". Must be a valid URL. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Validates R2 configuration
 */
function validateR2Config() {
    const bucket = process.env.CLOUDFLARE_R2_BUCKET;
    if (!bucket) {
        throw new Error(`[@bloomneo/appkit/storage] R2 bucket name required. Set CLOUDFLARE_R2_BUCKET environment variable. See: ${DOCS_URL}#environment-variables`);
    }
    if (!isValidBucketName(bucket)) {
        throw new Error(`[@bloomneo/appkit/storage] Invalid R2 bucket name: "${bucket}". Must be 3-63 characters, lowercase. See: ${DOCS_URL}#environment-variables`);
    }
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKey || !secretKey) {
        throw new Error(`[@bloomneo/appkit/storage] R2 credentials required. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY environment variables. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Validates local configuration
 */
function validateLocalConfig() {
    const dir = process.env.BLOOM_STORAGE_DIR;
    if (dir && (dir.includes('..') || dir.startsWith('/') && process.env.NODE_ENV === 'production')) {
        console.warn(`[@bloomneo/appkit/storage] Potentially unsafe storage directory: "${dir}". ` +
            `Consider using a relative path for security. See: ${DOCS_URL}#environment-variables`);
    }
    const baseUrl = process.env.BLOOM_STORAGE_BASE_URL;
    if (baseUrl && !baseUrl.startsWith('/') && !isValidUrl(baseUrl)) {
        throw new Error(`[@bloomneo/appkit/storage] Invalid BLOOM_STORAGE_BASE_URL: "${baseUrl}". Must be a path or valid URL. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Validates production storage configuration
 * @llm-rule WHEN: Running in production environment
 * @llm-rule AVOID: Local storage in multi-server production - files won't sync across servers
 */
function validateProductionConfig() {
    const strategy = detectStorageStrategy();
    if (strategy === 'local') {
        console.warn(`[@bloomneo/appkit/storage] Using local storage in production. ` +
            `Files will only exist on single server instance. ` +
            `Set AWS_S3_BUCKET or CLOUDFLARE_R2_BUCKET for distributed storage. See: ${DOCS_URL}#environment-variables`);
    }
    // Warn about missing CDN in production
    const cdnUrl = process.env.BLOOM_STORAGE_CDN_URL || process.env.CLOUDFLARE_R2_CDN_URL;
    if (!cdnUrl && strategy !== 'local') {
        console.warn(`[@bloomneo/appkit/storage] No CDN URL configured in production. ` +
            `Set BLOOM_STORAGE_CDN_URL for better performance. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Validates bucket name format (S3/R2 compatible)
 */
function isValidBucketName(name) {
    if (name.length < 3 || name.length > 63)
        return false;
    if (name !== name.toLowerCase())
        return false;
    if (name.includes('..') || name.includes('.-') || name.includes('-.'))
        return false;
    if (name.startsWith('-') || name.endsWith('-'))
        return false;
    if (name.startsWith('.') || name.endsWith('.'))
        return false;
    return /^[a-z0-9.-]+$/.test(name);
}
/**
 * Validates URL format
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validates numeric environment variable within acceptable range
 */
function validateNumericEnv(name, min, max) {
    const value = process.env[name];
    if (!value)
        return;
    const num = parseInt(value);
    if (isNaN(num) || num < min || num > max) {
        throw new Error(`[@bloomneo/appkit/storage] Invalid ${name}: "${value}". Must be a number between ${min} and ${max}. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Checks if cloud storage is available and properly configured
 * @llm-rule WHEN: Conditional logic based on storage capabilities
 * @llm-rule AVOID: Complex storage detection - just use storage normally, strategy handles it
 */
export function hasCloudStorage() {
    const strategy = detectStorageStrategy();
    return strategy === 's3' || strategy === 'r2';
}
//# sourceMappingURL=defaults.js.map