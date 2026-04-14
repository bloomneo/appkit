/**
 * Smart defaults with direct environment access and auto transport detection
 * @module @bloomneo/appkit/logger
 * @file src/logger/defaults.ts
 * 
 * @llm-rule WHEN: App startup - need production-ready logging configuration
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, cache results
 * @llm-rule NOTE: Called once at startup, cached globally for performance like auth module
 * @llm-rule NOTE: Now includes visual error configuration for enhanced developer experience
 */

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/logger/README.md';

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: 'minimal' | 'full';
  minimal: boolean;
  
  // Transport enablement (simple boolean flags)
  transports: {
    console: boolean;
    file: boolean;
    database: boolean;
    http: boolean;
    webhook: boolean;
  };
  
  // Direct environment access (no complex config objects)
  console: {
    colorize: boolean;
    timestamps: boolean;
    prettyPrint: boolean;
  };
  
  file: {
    dir: string;
    filename: string;
    maxSize: number;
    retentionDays: number;
  };
  
  database: {
    url: string | null;
    table: string;
    batchSize: number;
  };
  
  http: {
    url: string | null;
    batchSize: number;
    timeout: number;
  };
  
  webhook: {
    url: string | null;
    level: 'debug' | 'info' | 'warn' | 'error';
    rateLimit: number;
  };
  
  // Service identification
  service: {
    name: string;
    version: string;
    environment: string;
  };
}

/**
 * Get smart defaults using direct BLOOM_LOGGER_* environment access
 * @llm-rule WHEN: App startup to get production-ready logging configuration
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export function getSmartDefaults(): LoggingConfig {
  validateEnvironment();

  // Direct environment access with smart defaults (like auth module)
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';
  
  // Auto-detect logging scope
  const scope = getScope();
  const minimal = scope === 'minimal';
  
  // Auto-detect log level
  const level = getLevel(isProduction, isDevelopment);
  
  // Auto-detect enabled transports
  const transports = getEnabledTransports(isTest);
  
  return {
    level,
    scope,
    minimal,
    transports,
    
    // Console config - direct env access
    console: {
      colorize: process.env.BLOOM_LOGGER_CONSOLE_COLOR !== 'false' && !isProduction,
      timestamps: process.env.BLOOM_LOGGER_CONSOLE_TIME !== 'false',
      prettyPrint: isDevelopment && !minimal,
    },
    
    // File config - direct env access
    file: {
      dir: process.env.BLOOM_LOGGER_DIR || 'logs',
      filename: process.env.BLOOM_LOGGER_FILE_NAME || 'app.log',
      maxSize: parseInt(process.env.BLOOM_LOGGER_FILE_SIZE || (isProduction ? '50000000' : '10000000')),
      retentionDays: parseInt(process.env.BLOOM_LOGGER_FILE_RETENTION || (isProduction ? '30' : '7')),
    },
    
    // Database config - direct env access
    database: {
      url: process.env.DATABASE_URL || null,
      table: process.env.BLOOM_LOGGER_DB_TABLE || 'logs',
      batchSize: parseInt(process.env.BLOOM_LOGGER_DB_BATCH || (minimal ? '50' : '100')),
    },
    
    // HTTP config - direct env access
    http: {
      url: process.env.BLOOM_LOGGER_HTTP_URL || null,
      batchSize: parseInt(process.env.BLOOM_LOGGER_HTTP_BATCH || (minimal ? '25' : '50')),
      timeout: parseInt(process.env.BLOOM_LOGGER_HTTP_TIMEOUT || '30000'),
    },
    
    // Webhook config - direct env access
    webhook: {
      url: process.env.BLOOM_LOGGER_WEBHOOK_URL || null,
      level: (process.env.BLOOM_LOGGER_WEBHOOK_LEVEL as any) || 'error',
      rateLimit: parseInt(process.env.BLOOM_LOGGER_WEBHOOK_RATE || (minimal ? '5' : '10')),
    },
    
    // Service identification - direct env access
    service: {
      name: process.env.BLOOM_SERVICE_NAME || process.env.npm_package_name || 'app',
      version: process.env.BLOOM_SERVICE_VERSION || process.env.npm_package_version || '1.0.0',
      environment: nodeEnv,
    },
  };
}

/**
 * Auto-detect optimal logging scope
 * @llm-rule WHEN: Need to determine minimal vs full logging automatically
 * @llm-rule AVOID: Manual scope selection - auto-detection handles most cases correctly
 */
function getScope(): 'minimal' | 'full' {
  // Manual override wins (like auth module pattern)
  const manual = process.env.BLOOM_LOGGER_SCOPE?.toLowerCase();
  if (manual === 'minimal' || manual === 'full') {
    return manual;
  }
  
  // Auto-detection logic
  if (process.env.CI) return 'minimal'; // CI/CD pipelines
  if (process.env.NODE_ENV === 'production') return 'minimal'; // Production efficiency
  if (process.env.DEBUG || process.env.BLOOM_DEBUG) return 'full'; // Debug sessions
  
  return 'minimal'; // Safe default for clean logs
}

/**
 * Auto-detect appropriate log level
 * @llm-rule WHEN: Need to set log level based on environment automatically
 * @llm-rule AVOID: Hardcoding log levels - environment-based detection is better
 */
function getLevel(isProduction: boolean, isDevelopment: boolean): 'debug' | 'info' | 'warn' | 'error' {
  // Manual override wins (like auth module)
  const manual = process.env.BLOOM_LOGGER_LEVEL?.toLowerCase();
  if (manual && ['debug', 'info', 'warn', 'error'].includes(manual)) {
    return manual as any;
  }
  
  // Smart defaults based on environment
  if (isProduction) return 'warn'; // Production: only warnings and errors
  if (isDevelopment) return 'debug'; // Development: everything
  return 'info'; // Test and others: standard
}

/**
 * Auto-detect enabled transports from environment
 * @llm-rule WHEN: Need to determine which transports to enable automatically
 * @llm-rule AVOID: Manual transport configuration - auto-detection prevents errors
 * @llm-rule NOTE: DATABASE_URL auto-enables database, WEBHOOK_URL auto-enables webhooks
 */
function getEnabledTransports(isTest: boolean) {
  return {
    // Console: default on (except test)
    console: process.env.BLOOM_LOGGER_CONSOLE !== 'false' && !isTest,
    
    // File: default on (except test)
    file: process.env.BLOOM_LOGGER_FILE !== 'false' && !isTest,
    
    // Database: auto-enable if DATABASE_URL exists
    database: process.env.BLOOM_LOGGER_DATABASE === 'true' && !!process.env.DATABASE_URL,
    
    // HTTP: auto-enable if URL provided
    http: !!process.env.BLOOM_LOGGER_HTTP_URL,
    
    // Webhook: auto-enable if URL provided
    webhook: !!process.env.BLOOM_LOGGER_WEBHOOK_URL,
  };
}

/**
 * Validate environment variables (like auth module validation)
 * @llm-rule WHEN: App startup to catch configuration errors early
 * @llm-rule AVOID: Skipping validation - invalid config causes silent failures
 */
export function validateEnvironment(): void {
  // Validate log level
  const level = process.env.BLOOM_LOGGER_LEVEL;
  if (level && !['debug', 'info', 'warn', 'error'].includes(level)) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid BLOOM_LOGGER_LEVEL: "${level}". Must be: debug, info, warn, error. See: ${DOCS_URL}#environment-variables`);
  }

  // Validate scope
  const scope = process.env.BLOOM_LOGGER_SCOPE;
  if (scope && !['minimal', 'full'].includes(scope.toLowerCase())) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid BLOOM_LOGGER_SCOPE: "${scope}". Must be: minimal, full. See: ${DOCS_URL}#environment-variables`);
  }

  // Validate visual errors setting
  const visualErrors = process.env.BLOOM_VISUAL_ERRORS;
  if (visualErrors && !['true', 'false'].includes(visualErrors)) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid BLOOM_VISUAL_ERRORS: "${visualErrors}". Must be: true, false. See: ${DOCS_URL}#environment-variables`);
  }

  // Validate URLs if provided
  const httpUrl = process.env.BLOOM_LOGGER_HTTP_URL;
  if (httpUrl && !isValidUrl(httpUrl)) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid BLOOM_LOGGER_HTTP_URL: "${httpUrl}". See: ${DOCS_URL}#environment-variables`);
  }

  const webhookUrl = process.env.BLOOM_LOGGER_WEBHOOK_URL;
  if (webhookUrl && !isValidUrl(webhookUrl)) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid BLOOM_LOGGER_WEBHOOK_URL: "${webhookUrl}". See: ${DOCS_URL}#environment-variables`);
  }

  // Validate database URL if database logging enabled
  const dbEnabled = process.env.BLOOM_LOGGER_DATABASE === 'true';
  const dbUrl = process.env.DATABASE_URL;
  if (dbEnabled && !dbUrl) {
    throw new Error(`[@bloomneo/appkit/logger] BLOOM_LOGGER_DATABASE=true but DATABASE_URL not provided. See: ${DOCS_URL}#environment-variables`);
  }
  if (dbUrl && !isValidDatabaseUrl(dbUrl)) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid DATABASE_URL: "${dbUrl}". See: ${DOCS_URL}#environment-variables`);
  }

  // Validate numeric values
  validateNumericEnv('BLOOM_LOGGER_FILE_SIZE', 1000000, 100000000); // 1MB to 100MB
  validateNumericEnv('BLOOM_LOGGER_FILE_RETENTION', 1, 365); // 1 to 365 days
  validateNumericEnv('BLOOM_LOGGER_HTTP_TIMEOUT', 1000, 300000); // 1s to 5min
}

/**
 * Validate numeric environment variable
 */
function validateNumericEnv(name: string, min: number, max: number): void {
  const value = process.env[name];
  if (!value) return;
  
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`[@bloomneo/appkit/logger] Invalid ${name}: "${value}". Must be number between ${min} and ${max}. See: ${DOCS_URL}#environment-variables`);
  }
}

/**
 * Validate URL format (like auth module)
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate database URL format
 */
function isValidDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validProtocols = ['postgres:', 'postgresql:', 'mysql:', 'sqlite:'];
    return validProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}