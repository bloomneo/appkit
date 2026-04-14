/**
 * Smart defaults and environment validation for utilities
 * @module @bloomneo/appkit/util
 * @file src/util/defaults.ts
 * 
 * @llm-rule WHEN: App startup - need to configure utility behavior and performance settings
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance like other modules
 */

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/util/README.md';

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
}

export interface PerformanceConfig {
  enabled: boolean;
  memoization: boolean;
  largeArrayThreshold: number;
  chunkSizeLimit: number;
}

export interface DebugConfig {
  enabled: boolean;
  logOperations: boolean;
  trackPerformance: boolean;
}

export interface SlugifyConfig {
  lowercase: boolean;
  strict: boolean;
  locale: string;
  replacement: string;
}

export interface FormatConfig {
  locale: string;
  currency: string;
  dateFormat: string;
  numberPrecision: number;
}

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  nodeEnv: string;
}

export interface UtilConfig {
  version: string;
  cache: CacheConfig;
  performance: PerformanceConfig;
  debug: DebugConfig;
  slugify: SlugifyConfig;
  format: FormatConfig;
  environment: EnvironmentConfig;
}

/**
 * Gets smart defaults using BLOOM_UTIL_* environment variables
 * @llm-rule WHEN: App startup to get production-ready utility configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export function getSmartDefaults(): UtilConfig {
  validateEnvironment();

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  return {
    version: process.env.npm_package_version || '1.0.0',

    // Cache configuration with direct environment access
    cache: {
      enabled: process.env.BLOOM_UTIL_CACHE !== 'false' && !isTest,
      maxSize: parseInt(process.env.BLOOM_UTIL_CACHE_SIZE || '1000'),
      ttl: parseInt(process.env.BLOOM_UTIL_CACHE_TTL || '300000'), // 5 minutes
    },

    // Performance optimization settings
    performance: {
      enabled: process.env.BLOOM_UTIL_PERFORMANCE !== 'false',
      memoization: process.env.BLOOM_UTIL_MEMOIZATION !== 'false' && !isTest,
      largeArrayThreshold: parseInt(process.env.BLOOM_UTIL_ARRAY_THRESHOLD || '10000'),
      chunkSizeLimit: parseInt(process.env.BLOOM_UTIL_CHUNK_LIMIT || '100000'),
    },

    // Debug configuration - enabled in development
    debug: {
      enabled: process.env.BLOOM_UTIL_DEBUG === 'true' || isDevelopment,
      logOperations: process.env.BLOOM_UTIL_LOG_OPS === 'true' || isDevelopment,
      trackPerformance: process.env.BLOOM_UTIL_TRACK_PERF === 'true' || isDevelopment,
    },

    // Slugify configuration with locale support
    slugify: {
      lowercase: process.env.BLOOM_UTIL_SLUGIFY_LOWERCASE !== 'false',
      strict: process.env.BLOOM_UTIL_SLUGIFY_STRICT === 'true',
      locale: process.env.BLOOM_UTIL_LOCALE || 'en',
      replacement: process.env.BLOOM_UTIL_SLUGIFY_REPLACEMENT || '-',
    },

    // Format configuration for locale-aware formatting
    format: {
      locale: process.env.BLOOM_UTIL_LOCALE || 'en-US',
      currency: process.env.BLOOM_UTIL_CURRENCY || 'USD',
      dateFormat: process.env.BLOOM_UTIL_DATE_FORMAT || 'YYYY-MM-DD',
      numberPrecision: parseInt(process.env.BLOOM_UTIL_NUMBER_PRECISION || '2'),
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
 * Validates environment variables for utility configuration
 * @llm-rule WHEN: App startup to ensure proper utility environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes performance issues
 * @llm-rule NOTE: Validates cache sizes, performance thresholds, and locale settings
 */
function validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validate cache configuration
  const cacheSize = process.env.BLOOM_UTIL_CACHE_SIZE;
  if (cacheSize) {
    const cacheSizeNum = parseInt(cacheSize);
    if (isNaN(cacheSizeNum) || cacheSizeNum <= 0) {
      throw new Error(
        `[@bloomneo/appkit/util] Invalid BLOOM_UTIL_CACHE_SIZE: "${cacheSize}". Must be a positive number. See: ${DOCS_URL}#environment-variables`
      );
    }
    if (cacheSizeNum > 100000) {
      console.warn(
        `[@bloomneo/appkit/util] Large cache size: ${cacheSizeNum}. This may impact memory usage. See: ${DOCS_URL}#environment-variables`
      );
    }
  }

  // Validate cache TTL
  const cacheTTL = process.env.BLOOM_UTIL_CACHE_TTL;
  if (cacheTTL) {
    const cacheTTLNum = parseInt(cacheTTL);
    if (isNaN(cacheTTLNum) || cacheTTLNum <= 0) {
      throw new Error(
        `[@bloomneo/appkit/util] Invalid BLOOM_UTIL_CACHE_TTL: "${cacheTTL}". Must be a positive number (milliseconds). See: ${DOCS_URL}#environment-variables`
      );
    }
  }

  // Validate array threshold
  const arrayThreshold = process.env.BLOOM_UTIL_ARRAY_THRESHOLD;
  if (arrayThreshold) {
    const thresholdNum = parseInt(arrayThreshold);
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      throw new Error(
        `[@bloomneo/appkit/util] Invalid BLOOM_UTIL_ARRAY_THRESHOLD: "${arrayThreshold}". Must be a positive number. See: ${DOCS_URL}#environment-variables`
      );
    }
  }

  // Validate chunk size limit
  const chunkLimit = process.env.BLOOM_UTIL_CHUNK_LIMIT;
  if (chunkLimit) {
    const chunkLimitNum = parseInt(chunkLimit);
    if (isNaN(chunkLimitNum) || chunkLimitNum <= 0) {
      throw new Error(
        `[@bloomneo/appkit/util] Invalid BLOOM_UTIL_CHUNK_LIMIT: "${chunkLimit}". Must be a positive number. See: ${DOCS_URL}#environment-variables`
      );
    }
  }

  // Validate number precision
  const numberPrecision = process.env.BLOOM_UTIL_NUMBER_PRECISION;
  if (numberPrecision) {
    const precisionNum = parseInt(numberPrecision);
    if (isNaN(precisionNum) || precisionNum < 0 || precisionNum > 20) {
      throw new Error(
        `[@bloomneo/appkit/util] Invalid BLOOM_UTIL_NUMBER_PRECISION: "${numberPrecision}". Must be between 0 and 20. See: ${DOCS_URL}#environment-variables`
      );
    }
  }

  // Validate locale if provided
  const locale = process.env.BLOOM_UTIL_LOCALE;
  if (locale && !isValidLocale(locale)) {
    console.warn(
      `[@bloomneo/appkit/util] Invalid locale: "${locale}". Using default 'en-US'. See: ${DOCS_URL}#environment-variables`
    );
  }

  // Validate currency if provided
  const currency = process.env.BLOOM_UTIL_CURRENCY;
  if (currency && !isValidCurrency(currency)) {
    console.warn(
      `[@bloomneo/appkit/util] Invalid currency: "${currency}". Using default 'USD'. See: ${DOCS_URL}#environment-variables`
    );
  }

  // Validate slugify replacement
  const replacement = process.env.BLOOM_UTIL_SLUGIFY_REPLACEMENT;
  if (replacement && replacement.length > 5) {
    console.warn(
      `[@bloomneo/appkit/util] Long slugify replacement: "${replacement}". Consider using shorter replacement. See: ${DOCS_URL}#environment-variables`
    );
  }

  // Production-specific warnings
  if (nodeEnv === 'production') {
    if (process.env.BLOOM_UTIL_DEBUG === 'true') {
      console.warn(
        `[@bloomneo/appkit/util] Debug mode enabled in production. This may impact performance. See: ${DOCS_URL}#environment-variables`
      );
    }

    if (process.env.BLOOM_UTIL_LOG_OPS === 'true') {
      console.warn(
        `[@bloomneo/appkit/util] Operation logging enabled in production. This may impact performance. See: ${DOCS_URL}#environment-variables`
      );
    }
  }

  // Validate NODE_ENV
  if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
    console.warn(
      `[@bloomneo/appkit/util] Unusual NODE_ENV: "${nodeEnv}". ` +
      `Expected: development, production, test, or staging. See: ${DOCS_URL}#environment-variables`
    );
  }
}

/**
 * Validates locale format using basic pattern matching
 * @llm-rule WHEN: Validating user-provided locale settings
 * @llm-rule AVOID: Complex locale validation - basic pattern matching is sufficient
 */
function isValidLocale(locale: string): boolean {
  // Basic locale pattern: language[-Country]
  const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
  return localePattern.test(locale);
}

/**
 * Validates currency code format (ISO 4217)
 * @llm-rule WHEN: Validating user-provided currency settings
 * @llm-rule AVOID: Full ISO 4217 validation - basic pattern matching is sufficient
 */
function isValidCurrency(currency: string): boolean {
  // Basic currency pattern: 3 uppercase letters
  const currencyPattern = /^[A-Z]{3}$/;
  return currencyPattern.test(currency);
}

/**
 * Creates utility error with helpful context
 * @llm-rule WHEN: Creating errors in utility functions for better debugging
 * @llm-rule AVOID: Using generic Error objects - utility errors need context
 */
export function createUtilityError(
  message: string,
  operation?: string,
  input?: any
): Error {
  const error = new Error(message);
  
  if (operation) {
    (error as any).operation = operation;
  }
  
  if (input !== undefined) {
    (error as any).input = input;
  }
  
  return error;
}

/**
 * Default configuration constants for reference
 */
export const DEFAULT_CACHE_SIZE = 1000;
export const DEFAULT_CACHE_TTL = 300000; // 5 minutes
export const DEFAULT_ARRAY_THRESHOLD = 10000;
export const DEFAULT_CHUNK_LIMIT = 100000;
export const DEFAULT_NUMBER_PRECISION = 2;
export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_SLUGIFY_REPLACEMENT = '-';