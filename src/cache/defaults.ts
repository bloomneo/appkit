/**
 * Smart defaults and environment validation for caching
 * @module @bloomneo/appkit/cache
 * @file src/cache/defaults.ts
 * 
 * @llm-rule WHEN: App startup - need to configure cache behavior and connection strategy
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */

export interface RedisConfig {
  url: string;
  password?: string;
  maxRetries: number;
  retryDelay: number;
  connectTimeout: number;
  commandTimeout: number;
}

export interface MemoryConfig {
  maxItems: number;
  maxSizeBytes: number;
  checkInterval: number;
}

export interface CacheConfig {
  strategy: 'redis' | 'memory';
  keyPrefix: string;
  defaultTTL: number;
  namespace: string;
  redis?: RedisConfig;
  memory?: MemoryConfig;
  environment: {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    nodeEnv: string;
  };
}

/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready cache configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects Redis vs Memory based on REDIS_URL environment variable
 */
export function getSmartDefaults(): CacheConfig {
  validateEnvironment();

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  // Auto-detect strategy from environment
  const strategy = detectCacheStrategy();

  return {
    // Strategy selection with smart detection
    strategy,
    
    // Key management with service identification
    keyPrefix: process.env.VOILA_CACHE_PREFIX || process.env.VOILA_SERVICE_NAME || 'app',
    namespace: process.env.VOILA_CACHE_NAMESPACE || 'default',
    
    // TTL configuration with environment awareness
    defaultTTL: parseInt(process.env.VOILA_CACHE_TTL || (isProduction ? '3600' : '300')), // 1hr prod, 5min dev
    
    // Redis configuration (only used when strategy is 'redis')
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      maxRetries: parseInt(process.env.VOILA_CACHE_REDIS_RETRIES || '3'),
      retryDelay: parseInt(process.env.VOILA_CACHE_REDIS_RETRY_DELAY || '1000'),
      connectTimeout: parseInt(process.env.VOILA_CACHE_REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.VOILA_CACHE_REDIS_COMMAND_TIMEOUT || '5000'),
    },
    
    // Memory configuration (only used when strategy is 'memory')
    memory: {
      maxItems: parseInt(process.env.VOILA_CACHE_MEMORY_MAX_ITEMS || '10000'),
      maxSizeBytes: parseInt(process.env.VOILA_CACHE_MEMORY_MAX_SIZE || '100000000'), // 100MB
      checkInterval: parseInt(process.env.VOILA_CACHE_MEMORY_CHECK_INTERVAL || '60000'), // 1 minute
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
 * Auto-detect cache strategy from environment variables
 * @llm-rule WHEN: Determining which cache strategy to use automatically
 * @llm-rule AVOID: Manual strategy selection - environment detection handles most cases
 * @llm-rule NOTE: REDIS_URL = Redis, no REDIS_URL = Memory (perfect for dev/test)
 */
function detectCacheStrategy(): 'redis' | 'memory' {
  // Explicit override wins (for testing/debugging)
  const explicit = process.env.VOILA_CACHE_STRATEGY?.toLowerCase();
  if (explicit === 'redis' || explicit === 'memory') {
    return explicit;
  }

  // Auto-detection logic
  if (process.env.REDIS_URL) {
    return 'redis'; // Redis URL available
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[VoilaJSX AppKit] No REDIS_URL found in production. ' +
      'Using memory cache which will not persist across server restarts. ' +
      'Set REDIS_URL for production caching.'
    );
  }

  return 'memory'; // Default to memory for development/testing
}

/**
 * Validates environment variables for cache configuration
 * @llm-rule WHEN: App startup to ensure proper cache environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes silent cache failures
 * @llm-rule NOTE: Validates Redis URLs, numeric values, and production requirements
 */
function validateEnvironment(): void {
  // Validate Redis URL if provided
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && !isValidRedisUrl(redisUrl)) {
    throw new Error(`Invalid REDIS_URL: "${redisUrl}". Must start with redis:// or rediss://`);
  }

  // Validate cache strategy if explicitly set
  const strategy = process.env.VOILA_CACHE_STRATEGY;
  if (strategy && !['redis', 'memory'].includes(strategy.toLowerCase())) {
    throw new Error(
      `Invalid VOILA_CACHE_STRATEGY: "${strategy}". Must be "redis" or "memory"`
    );
  }

  // Validate numeric values
  validateNumericEnv('VOILA_CACHE_TTL', 1, 86400 * 7); // 1 second to 1 week
  validateNumericEnv('VOILA_CACHE_REDIS_RETRIES', 0, 10);
  validateNumericEnv('VOILA_CACHE_REDIS_RETRY_DELAY', 100, 10000);
  validateNumericEnv('VOILA_CACHE_REDIS_CONNECT_TIMEOUT', 1000, 60000);
  validateNumericEnv('VOILA_CACHE_REDIS_COMMAND_TIMEOUT', 1000, 30000);
  validateNumericEnv('VOILA_CACHE_MEMORY_MAX_ITEMS', 100, 1000000);
  validateNumericEnv('VOILA_CACHE_MEMORY_MAX_SIZE', 1000000, 1000000000); // 1MB to 1GB
  validateNumericEnv('VOILA_CACHE_MEMORY_CHECK_INTERVAL', 10000, 300000); // 10s to 5min

  // Validate key prefix
  const keyPrefix = process.env.VOILA_CACHE_PREFIX;
  if (keyPrefix && !/^[a-zA-Z0-9_-]+$/.test(keyPrefix)) {
    throw new Error(
      `Invalid VOILA_CACHE_PREFIX: "${keyPrefix}". Must contain only letters, numbers, underscores, and hyphens`
    );
  }

  // Validate namespace
  const namespace = process.env.VOILA_CACHE_NAMESPACE;
  if (namespace && !/^[a-zA-Z0-9_-]+$/.test(namespace)) {
    throw new Error(
      `Invalid VOILA_CACHE_NAMESPACE: "${namespace}". Must contain only letters, numbers, underscores, and hyphens`
    );
  }

  // Production-specific validations
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    if (!redisUrl) {
      console.warn(
        '[VoilaJSX AppKit] Production environment detected without REDIS_URL. ' +
        'Memory cache will not persist across server restarts. ' +
        'Consider setting REDIS_URL for production deployments.'
      );
    }
  }

  // Validate NODE_ENV
  if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
    console.warn(
      `[VoilaJSX AppKit] Unusual NODE_ENV: "${nodeEnv}". ` +
      `Expected: development, production, test, or staging`
    );
  }
}

/**
 * Validates Redis URL format
 * @llm-rule WHEN: Checking Redis connection string validity
 * @llm-rule AVOID: Using invalid Redis URLs - causes connection failures
 */
function isValidRedisUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['redis:', 'rediss:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates numeric environment variable within acceptable range
 * @llm-rule WHEN: Validating cache configuration numeric values
 * @llm-rule AVOID: Using values outside safe ranges - causes performance or memory issues
 */
function validateNumericEnv(name: string, min: number, max: number): void {
  const value = process.env[name];
  if (!value) return;
  
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(
      `Invalid ${name}: "${value}". Must be a number between ${min} and ${max}`
    );
  }
}

/**
 * Gets cache configuration summary for debugging and health checks
 * @llm-rule WHEN: Debugging cache configuration or building health check endpoints
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
export function getConfigSummary(): {
  strategy: string;
  keyPrefix: string;
  namespace: string;
  defaultTTL: number;
  redisConnected: boolean;
  environment: string;
} {
  const config = getSmartDefaults();
  
  return {
    strategy: config.strategy,
    keyPrefix: config.keyPrefix,
    namespace: config.namespace,
    defaultTTL: config.defaultTTL,
    redisConnected: config.strategy === 'redis' && !!config.redis?.url,
    environment: config.environment.nodeEnv,
  };
}

/**
 * Validates that required cache configuration is present for production
 * @llm-rule WHEN: App startup validation for production deployments
 * @llm-rule AVOID: Skipping validation - missing cache config causes runtime issues
 */
export function validateProductionRequirements(): void {
  const config = getSmartDefaults();
  
  if (config.environment.isProduction) {
    if (config.strategy === 'memory') {
      console.warn(
        '[VoilaJSX AppKit] Using memory cache in production. ' +
        'Data will not persist across server restarts. ' +
        'Set REDIS_URL for persistent caching.'
      );
    }
    
    if (config.strategy === 'redis' && !config.redis?.url) {
      throw new Error(
        'Redis strategy selected but REDIS_URL not configured. ' +
        'Set REDIS_URL environment variable for Redis caching.'
      );
    }
  }
}