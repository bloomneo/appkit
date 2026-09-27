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

import { LoggerError } from './errors.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/logger/README.md';

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: 'minimal' | 'full';
  minimal: boolean;
  
  // Transport enablement (simple boolean flags)
  transports: {
    console: boolean;
    file: boolean;
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
 * @llm-rule NOTE: Only console and file exist; ship logs elsewhere by collecting stdout or the file
 */
function getEnabledTransports(isTest: boolean) {
  return {
    // Console: default on (except test)
    console: process.env.BLOOM_LOGGER_CONSOLE !== 'false' && !isTest,
    
    // File: default on (except test)
    file: process.env.BLOOM_LOGGER_FILE !== 'false' && !isTest,
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
    throw new LoggerError(`[@bloomneo/appkit/logger] Invalid BLOOM_LOGGER_LEVEL: "${level}". Must be: debug, info, warn, error. See: ${DOCS_URL}#environment-variables`, { code: 'LOGGER_INVALID_CONFIG' });
  }

  // Validate scope
  const scope = process.env.BLOOM_LOGGER_SCOPE;
  if (scope && !['minimal', 'full'].includes(scope.toLowerCase())) {
    throw new LoggerError(`[@bloomneo/appkit/logger] Invalid BLOOM_LOGGER_SCOPE: "${scope}". Must be: minimal, full. See: ${DOCS_URL}#environment-variables`, { code: 'LOGGER_INVALID_CONFIG' });
  }

  // Validate visual errors setting
  const visualErrors = process.env.BLOOM_VISUAL_ERRORS;
  if (visualErrors && !['true', 'false'].includes(visualErrors)) {
    throw new LoggerError(`[@bloomneo/appkit/logger] Invalid BLOOM_VISUAL_ERRORS: "${visualErrors}". Must be: true, false. See: ${DOCS_URL}#environment-variables`, { code: 'LOGGER_INVALID_CONFIG' });
  }

  // Validate numeric values
  validateNumericEnv('BLOOM_LOGGER_FILE_SIZE', 1000000, 100000000); // 1MB to 100MB
  validateNumericEnv('BLOOM_LOGGER_FILE_RETENTION', 1, 365); // 1 to 365 days
}

/**
 * Validate numeric environment variable
 */
function validateNumericEnv(name: string, min: number, max: number): void {
  const value = process.env[name];
  if (!value) return;
  
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new LoggerError(`[@bloomneo/appkit/logger] Invalid ${name}: "${value}". Must be number between ${min} and ${max}. See: ${DOCS_URL}#environment-variables`, { code: 'LOGGER_INVALID_CONFIG' });
  }
}
