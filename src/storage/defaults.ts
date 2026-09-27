/**
 * Smart defaults and environment validation for file storage with auto-strategy detection
 * @module @bloomneo/appkit/storage
 * @file src/storage/defaults.ts
 * 
 * @llm-rule WHEN: App startup - need to configure storage system and connection strategy
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule NOTE: Auto-detects Local vs S3 based on environment variables. R2, Wasabi and
 *   MinIO use the S3 strategy with S3_ENDPOINT.
 */

import { StorageError } from './errors.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/storage/README.md';

export interface LocalConfig {
  dir: string;
  baseUrl: string;
  maxFileSize: number;
  allowedTypes: string[];
  createDirs: boolean;
}

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  signedUrlExpiry: number;
  cdnUrl?: string;
}

export interface StorageConfig {
  strategy: 'local' | 's3';
  local?: LocalConfig;
  s3?: S3Config;
  environment: {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    nodeEnv: string;
  };
}

/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready storage configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects strategy: S3 env vars → S3, nothing → Local
 */
export function getSmartDefaults(): StorageConfig {
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
    
    // S3 configuration (only used when strategy is 's3'). S3_ENDPOINT points it
    // at any S3-compatible service: Cloudflare R2, Wasabi, MinIO, DO Spaces.
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
 * @llm-rule NOTE: Priority: S3 → Local. R2/Wasabi/MinIO are S3 with S3_ENDPOINT.
 */
function detectStorageStrategy(): 'local' | 's3' {
  // Explicit override wins (for testing/debugging)
  const explicit = process.env.BLOOM_STORAGE_STRATEGY?.toLowerCase();
  if (explicit === 'local' || explicit === 's3') {
    return explicit;
  }

  if (process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.S3_ENDPOINT) {
    return 's3'; // S3-compatible services
  }

  // Default to local for development/single server
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[@bloomneo/appkit/storage] No cloud storage configured in production. ` +
      `Using local filesystem which may not scale. ` +
      `Set AWS_S3_BUCKET (plus S3_ENDPOINT for R2, Wasabi or MinIO) for cloud storage. See: ${DOCS_URL}#environment-variables`
    );
  }

  return 'local'; // Default to local filesystem
}

/**
 * Parse allowed file types from environment with safe defaults
 * @llm-rule WHEN: Setting up file type restrictions for security
 * @llm-rule AVOID: Allowing all file types in production - security risk
 */
function parseAllowedTypes(): string[] {
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
      console.warn(
        `[@bloomneo/appkit/storage] SECURITY WARNING: All file types allowed in production. ` +
        `Set BLOOM_STORAGE_ALLOWED_TYPES to specific types for security. See: ${DOCS_URL}#environment-variables`
      );
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
function validateEnvironment(): void {
  // Validate storage strategy if explicitly set
  const strategy = process.env.BLOOM_STORAGE_STRATEGY;
  if (strategy && !['local', 's3'].includes(strategy.toLowerCase())) {
    const hint = strategy.toLowerCase() === 'r2'
      ? ' The R2 strategy was removed in 6.0; use "s3" with S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com.'
      : '';
    throw new StorageError(
      `[@bloomneo/appkit/storage] Invalid BLOOM_STORAGE_STRATEGY: "${strategy}". Must be "local" or "s3".${hint} See: ${DOCS_URL}#environment-variables`,
      { code: 'STORAGE_INVALID_STRATEGY' }
    );
  }

  // Validate numeric values
  validateNumericEnv('BLOOM_STORAGE_MAX_SIZE', 1048576, 1073741824); // 1MB to 1GB
  validateNumericEnv('BLOOM_STORAGE_SIGNED_EXPIRY', 60, 604800); // 1 minute to 7 days

  // Validate S3 configuration if S3 strategy detected
  if (shouldValidateS3()) {
    validateS3Config();
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
    console.warn(
      `[@bloomneo/appkit/storage] Unusual NODE_ENV: "${nodeEnv}". ` +
      `Expected: development, production, test, or staging. See: ${DOCS_URL}#environment-variables`
    );
  }
}

/**
 * Check if S3 validation is needed
 */
function shouldValidateS3(): boolean {
  return !!(process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.S3_ENDPOINT);
}

/**
 * Check if local validation is needed
 */
function shouldValidateLocal(): boolean {
  const strategy = detectStorageStrategy();
  return strategy === 'local';
}

/**
 * Validates S3 configuration
 */
function validateS3Config(): void {
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
  if (!bucket) {
    throw new StorageError(`[@bloomneo/appkit/storage] S3 bucket name required. Set AWS_S3_BUCKET or S3_BUCKET environment variable. See: ${DOCS_URL}#environment-variables`, { code: 'STORAGE_MISSING_CONFIG' });
  }

  if (!isValidBucketName(bucket)) {
    throw new StorageError(`[@bloomneo/appkit/storage] Invalid S3 bucket name: "${bucket}". Must be 3-63 characters, lowercase, no dots. See: ${DOCS_URL}#environment-variables`, { code: 'STORAGE_INVALID_CONFIG' });
  }

  const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

  if (!accessKey || !secretKey) {
    throw new StorageError(
      `[@bloomneo/appkit/storage] S3 credentials required. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables. See: ${DOCS_URL}#environment-variables`,
      { code: 'STORAGE_MISSING_CONFIG' }
    );
  }

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint && !isValidUrl(endpoint)) {
    throw new StorageError(`[@bloomneo/appkit/storage] Invalid S3 endpoint: "${endpoint}". Must be a valid URL. See: ${DOCS_URL}#environment-variables`, { code: 'STORAGE_INVALID_CONFIG' });
  }
}

/**
 * Validates local configuration
 */
function validateLocalConfig(): void {
  const dir = process.env.BLOOM_STORAGE_DIR;
  if (dir && (dir.includes('..') || dir.startsWith('/') && process.env.NODE_ENV === 'production')) {
    console.warn(
      `[@bloomneo/appkit/storage] Potentially unsafe storage directory: "${dir}". ` +
      `Consider using a relative path for security. See: ${DOCS_URL}#environment-variables`
    );
  }

  const baseUrl = process.env.BLOOM_STORAGE_BASE_URL;
  if (baseUrl && !baseUrl.startsWith('/') && !isValidUrl(baseUrl)) {
    throw new StorageError(`[@bloomneo/appkit/storage] Invalid BLOOM_STORAGE_BASE_URL: "${baseUrl}". Must be a path or valid URL. See: ${DOCS_URL}#environment-variables`, { code: 'STORAGE_INVALID_CONFIG' });
  }
}

/**
 * Validates production storage configuration
 * @llm-rule WHEN: Running in production environment
 * @llm-rule AVOID: Local storage in multi-server production - files won't sync across servers
 */
function validateProductionConfig(): void {
  const strategy = detectStorageStrategy();
  
  if (strategy === 'local') {
    console.warn(
      `[@bloomneo/appkit/storage] Using local storage in production. ` +
      `Files will only exist on single server instance. ` +
      `Set AWS_S3_BUCKET (plus S3_ENDPOINT for R2, Wasabi or MinIO) for distributed storage. See: ${DOCS_URL}#environment-variables`
    );
  }

  // Warn about missing CDN in production
  const cdnUrl = process.env.BLOOM_STORAGE_CDN_URL;
  if (!cdnUrl && strategy !== 'local') {
    console.warn(
      `[@bloomneo/appkit/storage] No CDN URL configured in production. ` +
      `Set BLOOM_STORAGE_CDN_URL for better performance. See: ${DOCS_URL}#environment-variables`
    );
  }
}

/**
 * Validates bucket name format (S3-compatible)
 */
function isValidBucketName(name: string): boolean {
  if (name.length < 3 || name.length > 63) return false;
  if (name !== name.toLowerCase()) return false;
  if (name.includes('..') || name.includes('.-') || name.includes('-.')) return false;
  if (name.startsWith('-') || name.endsWith('-')) return false;
  if (name.startsWith('.') || name.endsWith('.')) return false;
  return /^[a-z0-9.-]+$/.test(name);
}

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates numeric environment variable within acceptable range
 */
function validateNumericEnv(name: string, min: number, max: number): void {
  const value = process.env[name];
  if (!value) return;
  
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new StorageError(
      `[@bloomneo/appkit/storage] Invalid ${name}: "${value}". Must be a number between ${min} and ${max}. See: ${DOCS_URL}#environment-variables`,
      { code: 'STORAGE_INVALID_CONFIG' }
    );
  }
}

/**
 * Checks if cloud storage is available and properly configured
 * @llm-rule WHEN: Conditional logic based on storage capabilities
 * @llm-rule AVOID: Complex storage detection - just use storage normally, strategy handles it
 */
export function hasCloudStorage(): boolean {
  const strategy = detectStorageStrategy();
  return strategy === 's3';
}