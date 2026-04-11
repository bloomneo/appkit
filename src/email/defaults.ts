/**
 * Smart defaults and environment validation for email with auto-strategy detection
 * @module @bloomneo/appkit/email
 * @file src/email/defaults.ts
 * 
 * @llm-rule WHEN: App startup - need to configure email strategy and connection settings
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule NOTE: Auto-detects Resend → SMTP → Console based on environment variables
 */

export interface ResendConfig {
  apiKey: string;
  baseURL: string;
  timeout: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  timeout: number;
  pool: boolean;
}

export interface ConsoleConfig {
  colorize: boolean;
  showPreview: boolean;
  format: 'simple' | 'detailed';
}

export interface EmailConfig {
  strategy: 'resend' | 'smtp' | 'console';
  from: {
    name: string;
    email: string;
  };
  resend?: ResendConfig;
  smtp?: SmtpConfig;
  console?: ConsoleConfig;
  environment: {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    nodeEnv: string;
  };
}

/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready email configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects strategy: RESEND_API_KEY → Resend, SMTP_HOST → SMTP, default → Console
 */
export function getSmartDefaults(): EmailConfig {
  validateEnvironment();

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  // Auto-detect strategy from environment
  const strategy = detectEmailStrategy();

  return {
    // Strategy selection with smart detection
    strategy,
    
    // Default sender with service identification
    from: {
      name: process.env.VOILA_EMAIL_FROM_NAME || process.env.VOILA_SERVICE_NAME || 'App',
      email: process.env.VOILA_EMAIL_FROM_EMAIL || getDefaultFromEmail(strategy),
    },
    
    // Resend configuration (only used when strategy is 'resend')
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
      baseURL: process.env.RESEND_BASE_URL || 'https://api.resend.com',
      timeout: parseInt(process.env.VOILA_EMAIL_RESEND_TIMEOUT || '30000'),
    },
    
    // SMTP configuration (only used when strategy is 'smtp')
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || getDefaultSmtpPort()),
      secure: process.env.SMTP_SECURE === 'true' || isDefaultSecurePort(),
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      timeout: parseInt(process.env.VOILA_EMAIL_SMTP_TIMEOUT || '30000'),
      pool: process.env.SMTP_POOL !== 'false', // Default to true for performance
    },
    
    // Console configuration (only used when strategy is 'console')
    console: {
      colorize: process.env.VOILA_EMAIL_CONSOLE_COLOR !== 'false' && !isProduction,
      showPreview: process.env.VOILA_EMAIL_CONSOLE_PREVIEW !== 'false' && isDevelopment,
      format: (process.env.VOILA_EMAIL_CONSOLE_FORMAT as 'simple' | 'detailed') || 'simple',
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
 * Auto-detect email strategy from environment variables
 * @llm-rule WHEN: Determining which email strategy to use automatically
 * @llm-rule AVOID: Manual strategy selection - environment detection handles most cases
 * @llm-rule NOTE: Priority: RESEND_API_KEY → SMTP_HOST → Console (perfect for dev/prod)
 */
function detectEmailStrategy(): 'resend' | 'smtp' | 'console' {
  // Explicit override wins (for testing/debugging)
  const explicit = process.env.VOILA_EMAIL_STRATEGY?.toLowerCase();
  if (explicit === 'resend' || explicit === 'smtp' || explicit === 'console') {
    return explicit;
  }

  // Auto-detection logic (priority order)
  if (process.env.RESEND_API_KEY) {
    return 'resend'; // Resend API key available
  }

  if (process.env.SMTP_HOST) {
    return 'smtp'; // SMTP configuration available
  }

  // Default to console for development/testing
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[Bloomneo AppKit] No email provider configured in production. ' +
      'Using console strategy which will only log emails. ' +
      'Set RESEND_API_KEY or SMTP_HOST for production email sending.'
    );
  }

  return 'console'; // Default to console for development
}

/**
 * Get default FROM email based on strategy
 * @llm-rule WHEN: No explicit FROM email configured - provides sensible defaults
 * @llm-rule AVOID: Hardcoded defaults - strategy-specific defaults work better
 */
function getDefaultFromEmail(strategy: string): string {
  switch (strategy) {
    case 'resend':
      return 'noreply@example.com'; // Resend requires verified domain
    case 'smtp':
      return process.env.SMTP_USER || 'noreply@localhost';
    case 'console':
      return 'noreply@localhost';
    default:
      return 'noreply@localhost';
  }
}

/**
 * Get default SMTP port based on configuration
 * @llm-rule WHEN: No explicit SMTP port configured - uses standard ports
 * @llm-rule AVOID: Hardcoded port - security settings affect port choice
 */
function getDefaultSmtpPort(): string {
  const secure = process.env.SMTP_SECURE === 'true';
  const host = process.env.SMTP_HOST?.toLowerCase() || '';
  
  // Gmail and common providers use specific ports
  if (host.includes('gmail.com')) {
    return secure ? '465' : '587';
  }
  
  // Standard SMTP ports
  return secure ? '465' : '587';
}

/**
 * Check if SMTP should use secure connection by default
 * @llm-rule WHEN: No explicit SMTP_SECURE setting - auto-detects from port
 * @llm-rule AVOID: Insecure connections - defaults to secure when possible
 */
function isDefaultSecurePort(): boolean {
  const port = parseInt(process.env.SMTP_PORT || '587');
  return port === 465; // Port 465 is SSL, 587 is TLS
}

/**
 * Validates environment variables for email configuration
 * @llm-rule WHEN: App startup to ensure proper email environment configuration
 * @llm-rule AVOID: Skipping validation - improper config causes silent email failures
 * @llm-rule NOTE: Validates API keys, email addresses, and SMTP settings
 */
function validateEnvironment(): void {
  // Validate email strategy if explicitly set
  const strategy = process.env.VOILA_EMAIL_STRATEGY;
  if (strategy && !['resend', 'smtp', 'console'].includes(strategy.toLowerCase())) {
    throw new Error(
      `Invalid VOILA_EMAIL_STRATEGY: "${strategy}". Must be "resend", "smtp", or "console"`
    );
  }

  // Validate Resend API key format if provided
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && !resendApiKey.startsWith('re_')) {
    throw new Error(
      `Invalid RESEND_API_KEY format: "${resendApiKey}". Must start with "re_"`
    );
  }

  // Validate SMTP configuration if provided
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    validateSmtpConfig();
  }

  // Validate FROM email if provided
  const fromEmail = process.env.VOILA_EMAIL_FROM_EMAIL;
  if (fromEmail && !isValidEmail(fromEmail)) {
    throw new Error(
      `Invalid VOILA_EMAIL_FROM_EMAIL: "${fromEmail}". Must be a valid email address`
    );
  }

  // Validate numeric values
  validateNumericEnv('SMTP_PORT', 1, 65535);
  validateNumericEnv('VOILA_EMAIL_RESEND_TIMEOUT', 1000, 300000); // 1s to 5min
  validateNumericEnv('VOILA_EMAIL_SMTP_TIMEOUT', 1000, 300000); // 1s to 5min

  // Validate console format if provided
  const consoleFormat = process.env.VOILA_EMAIL_CONSOLE_FORMAT;
  if (consoleFormat && !['simple', 'detailed'].includes(consoleFormat)) {
    throw new Error(
      `Invalid VOILA_EMAIL_CONSOLE_FORMAT: "${consoleFormat}". Must be "simple" or "detailed"`
    );
  }

  // Production-specific validations
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    validateProductionConfig();
  }

  // Validate NODE_ENV
  if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
    console.warn(
      `[Bloomneo AppKit] Unusual NODE_ENV: "${nodeEnv}". ` +
      `Expected: development, production, test, or staging`
    );
  }
}

/**
 * Validates SMTP configuration for completeness
 * @llm-rule WHEN: SMTP_HOST is configured - ensures complete SMTP setup
 * @llm-rule AVOID: Partial SMTP config - causes authentication failures
 */
function validateSmtpConfig(): void {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error('SMTP_HOST is required when using SMTP strategy');
  }

  // Many SMTP servers require authentication
  if (!user && !pass) {
    console.warn(
      '[Bloomneo AppKit] SMTP configured without authentication. ' +
      'Set SMTP_USER and SMTP_PASS if your server requires authentication.'
    );
  }

  if (user && !pass) {
    throw new Error('SMTP_PASS is required when SMTP_USER is set');
  }

  if (!user && pass) {
    throw new Error('SMTP_USER is required when SMTP_PASS is set');
  }
}

/**
 * Validates production email configuration
 * @llm-rule WHEN: Running in production environment
 * @llm-rule AVOID: Console strategy in production - emails won't be sent
 */
function validateProductionConfig(): void {
  const strategy = detectEmailStrategy();
  
  if (strategy === 'console') {
    console.warn(
      '[Bloomneo AppKit] Using console email strategy in production. ' +
      'Emails will only be logged, not sent. ' +
      'Set RESEND_API_KEY or SMTP_HOST for production email sending.'
    );
  }

  // Validate FROM email is set in production
  const fromEmail = process.env.VOILA_EMAIL_FROM_EMAIL;
  if (!fromEmail) {
    console.warn(
      '[Bloomneo AppKit] No FROM email configured in production. ' +
      'Set VOILA_EMAIL_FROM_EMAIL for professional email sending.'
    );
  }
}

/**
 * Validates email address format
 * @llm-rule WHEN: Validating email addresses in configuration
 * @llm-rule AVOID: Complex regex - simple validation for config purposes
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates numeric environment variable within acceptable range
 * @llm-rule WHEN: Validating email configuration numeric values
 * @llm-rule AVOID: Using values outside safe ranges - causes timeout or connection issues
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
 * Gets email configuration summary for debugging and health checks
 * @llm-rule WHEN: Debugging email configuration or building health check endpoints
 * @llm-rule AVOID: Exposing sensitive API keys or passwords - this only shows safe info
 */
export function getConfigSummary(): {
  strategy: string;
  fromName: string;
  fromEmail: string;
  resendConfigured: boolean;
  smtpConfigured: boolean;
  environment: string;
} {
  const config = getSmartDefaults();
  
  return {
    strategy: config.strategy,
    fromName: config.from.name,
    fromEmail: config.from.email,
    resendConfigured: config.strategy === 'resend' && !!config.resend?.apiKey,
    smtpConfigured: config.strategy === 'smtp' && !!config.smtp?.host,
    environment: config.environment.nodeEnv,
  };
}

/**
 * Validates that required email configuration is present for production
 * @llm-rule WHEN: App startup validation for production deployments
 * @llm-rule AVOID: Skipping validation - missing email config causes runtime issues
 */
export function validateProductionRequirements(): void {
  const config = getSmartDefaults();
  
  if (config.environment.isProduction) {
    if (config.strategy === 'console') {
      console.warn(
        '[Bloomneo AppKit] Using console email strategy in production. ' +
        'Emails will only be logged, not sent. ' +
        'Set RESEND_API_KEY or SMTP_HOST for production email sending.'
      );
    }
    
    if (config.strategy === 'resend' && !config.resend?.apiKey) {
      throw new Error(
        'Resend strategy selected but RESEND_API_KEY not configured. ' +
        'Set RESEND_API_KEY environment variable for Resend email sending.'
      );
    }
    
    if (config.strategy === 'smtp' && !config.smtp?.host) {
      throw new Error(
        'SMTP strategy selected but SMTP_HOST not configured. ' +
        'Set SMTP_HOST environment variable for SMTP email sending.'
      );
    }
  }
}

/**
 * Validates startup configuration and throws detailed errors
 * @llm-rule WHEN: App startup to ensure email configuration is valid before starting
 * @llm-rule AVOID: Skipping validation - catches config issues early
 * @llm-rule NOTE: Comprehensive validation for production readiness
 */
export function validateStartupConfiguration(): {
  strategy: string;
  warnings: string[];
  errors: string[];
  ready: boolean;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    const config = getSmartDefaults();
    const strategy = config.strategy;
    
    // Strategy-specific validation
    switch (strategy) {
      case 'resend':
        if (!config.resend?.apiKey) {
          errors.push('RESEND_API_KEY is required for Resend strategy');
        } else if (!config.resend.apiKey.startsWith('re_')) {
          errors.push('RESEND_API_KEY must start with "re_"');
        }
        break;
        
      case 'smtp':
        if (!config.smtp?.host) {
          errors.push('SMTP_HOST is required for SMTP strategy');
        }
        if (config.smtp?.auth.user && !config.smtp?.auth.pass) {
          errors.push('SMTP_PASS is required when SMTP_USER is set');
        }
        if (!config.smtp?.auth.user && config.smtp?.auth.pass) {
          errors.push('SMTP_USER is required when SMTP_PASS is set');
        }
        break;
        
      case 'console':
        if (config.environment.isProduction) {
          warnings.push('Console strategy in production - emails will only be logged');
        }
        break;
    }
    
    // FROM email validation
    if (!config.from.email || config.from.email.includes('example.com')) {
      if (config.environment.isProduction) {
        errors.push('VOILA_EMAIL_FROM_EMAIL must be set in production');
      } else {
        warnings.push('VOILA_EMAIL_FROM_EMAIL not configured - using default');
      }
    }
    
    // Environment-specific warnings
    if (config.environment.isProduction && strategy === 'console') {
      warnings.push('No real email provider configured in production');
    }
    
    if (config.environment.isDevelopment && strategy !== 'console') {
      warnings.push('Using real email provider in development');
    }
    
    return {
      strategy,
      warnings,
      errors,
      ready: errors.length === 0,
    };
    
  } catch (error) {
    errors.push(`Configuration validation failed: ${(error as Error).message}`);
    
    return {
      strategy: 'unknown',
      warnings,
      errors,
      ready: false,
    };
  }
}

/**
 * Performs comprehensive email system health check
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Running in critical path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed health status without exposing sensitive data
 */
export function performHealthCheck(): {
  status: 'healthy' | 'warning' | 'error';
  strategy: string;
  configured: boolean;
  issues: string[];
  ready: boolean;
  timestamp: string;
} {
  const issues: string[] = [];
  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  
  try {
    const validation = validateStartupConfiguration();
    
    // Determine overall status
    if (validation.errors.length > 0) {
      status = 'error';
      issues.push(...validation.errors);
    } else if (validation.warnings.length > 0) {
      status = 'warning';
      issues.push(...validation.warnings);
    }
    
    const configured = validation.strategy !== 'console' || 
                      process.env.NODE_ENV !== 'production';
    
    return {
      status,
      strategy: validation.strategy,
      configured,
      issues,
      ready: validation.ready,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    return {
      status: 'error',
      strategy: 'unknown',
      configured: false,
      issues: [`Health check failed: ${(error as Error).message}`],
      ready: false,
      timestamp: new Date().toISOString(),
    };
  }
}