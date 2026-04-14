/**
 * Smart defaults and environment validation for error handling
 * @module @bloomneo/appkit/error
 * @file src/error/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure error handling behavior and messages
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/error/README.md';

export interface ErrorMessages {
  badRequest: string;
  unauthorized: string;
  forbidden: string;
  notFound: string;
  conflict: string;
  serverError: string;
}

export interface MiddlewareConfig {
  showStack: boolean;
  logErrors: boolean;
}

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  nodeEnv: string;
}

export interface ErrorConfig {
  messages: ErrorMessages;
  middleware: MiddlewareConfig;
  environment: EnvironmentConfig;
}

/**
 * Gets smart defaults using BLOOM_ERROR_* environment variables
 * @llm-rule WHEN: App startup to get production-ready error configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Automatically configures dev vs production error behavior
 */
export function getSmartDefaults(): ErrorConfig {
  validateEnvironment();

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  return {
    // Error message defaults with environment awareness
    messages: {
      badRequest: 'Bad Request',
      unauthorized: process.env.BLOOM_AUTH_MESSAGE || 'Authentication required',
      forbidden: 'Access denied',
      notFound: 'Not found',
      conflict: 'Conflict',
      serverError: isDevelopment ? 'Internal server error' : 'Server error',
    },

    // Error handling behavior with smart defaults
    middleware: {
      showStack: process.env.BLOOM_ERROR_STACK === 'true' || isDevelopment,
      logErrors: process.env.BLOOM_ERROR_LOG !== 'false',
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
 * Validates environment variables for error configuration
 * @llm-rule WHEN: App startup to ensure proper error environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes silent failures
 * @llm-rule NOTE: Validates essential boolean environment variables and NODE_ENV only
 */
function validateEnvironment(): void {
  // Validate BLOOM_ERROR_STACK (essential for security)
  const errorStack = process.env.BLOOM_ERROR_STACK;
  if (errorStack && !['true', 'false'].includes(errorStack.toLowerCase())) {
    throw new Error(
      `[@bloomneo/appkit/error] Invalid BLOOM_ERROR_STACK: "${errorStack}". Must be "true" or "false". See: ${DOCS_URL}#environment-variables`
    );
  }

  // Validate BLOOM_ERROR_LOG (essential for debugging)
  const errorLog = process.env.BLOOM_ERROR_LOG;
  if (errorLog && !['true', 'false'].includes(errorLog.toLowerCase())) {
    throw new Error(
      `[@bloomneo/appkit/error] Invalid BLOOM_ERROR_LOG: "${errorLog}". Must be "true" or "false". See: ${DOCS_URL}#environment-variables`
    );
  }

  // Validate NODE_ENV (essential for environment detection)
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
    console.warn(
      `[@bloomneo/appkit/error] Unusual NODE_ENV: "${nodeEnv}". Expected: development, production, test, or staging`
    );
  }

  // Essential production safety check
  if (nodeEnv === 'production' && process.env.BLOOM_ERROR_STACK === 'true') {
    console.warn(
      `[@bloomneo/appkit/error] Security warning: BLOOM_ERROR_STACK=true in production. Stack traces may expose internal application structure. Consider setting to false. See: ${DOCS_URL}#production-deployment`
    );
  }
}