/**
 * Smart defaults and environment validation for configuration management
 * @module @bloomneo/appkit/config
 * @file src/config/defaults.ts
 * 
 * @llm-rule WHEN: App startup - need to parse UPPER_SNAKE_CASE environment variables
 * @llm-rule AVOID: Calling multiple times - expensive parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */

export interface ConfigValue {
  [key: string]: string | number | boolean | ConfigValue;
}

export interface AppConfig extends ConfigValue {
  app: {
    name: string;
    environment: string;
    port?: number;
    host?: string;
  };
  [key: string]: any;
}

/**
 * Parses a string value to its appropriate type (boolean, number, or string)
 * @llm-rule WHEN: Processing environment variables that need type conversion
 * @llm-rule AVOID: Manual string-to-type conversion - this handles edge cases properly
 * @llm-rule NOTE: Supports "true"/"false" → boolean, numeric strings → number
 */
function parseValue(value: string): string | boolean | number {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  
  // Handle empty strings
  if (trimmed === '') return '';

  // Handle booleans
  const lowerValue = trimmed.toLowerCase();
  if (lowerValue === 'true') return true;
  if (lowerValue === 'false') return false;
  
  // Handle special values
  if (lowerValue === 'null') return '';
  if (lowerValue === 'undefined') return '';

  // Handle numbers (but not if they start with 0 - could be IDs)
  if (!trimmed.startsWith('0') && !isNaN(Number(trimmed)) && trimmed !== '') {
    const num = Number(trimmed);
    // Only convert if it's a safe integer or decimal
    if (Number.isSafeInteger(num) || (num % 1 !== 0 && num.toString() === trimmed)) {
      return num;
    }
  }

  return value;
}

/**
 * Sets a value on a nested object using a dot-notation path
 * @llm-rule WHEN: Building nested config object from flat environment variables
 * @llm-rule AVOID: Manual object nesting - this handles deep paths safely
 */
function setNestedValue(obj: ConfigValue, path: string[], value: any): void {
  let current: any = obj;
  
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (typeof current[segment] !== 'object' || current[segment] === null) {
      current[segment] = {};
    }
    current = current[segment];
  }
  
  current[path[path.length - 1]] = value;
}

/**
 * Validates the NODE_ENV for common conventions
 * @llm-rule WHEN: App startup to ensure proper environment configuration
 * @llm-rule AVOID: Skipping validation - improper NODE_ENV causes subtle bugs
 */
function validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
    console.warn(
      `[VoilaJSX AppKit] Unusual NODE_ENV: "${nodeEnv}". ` +
      `Expected: development, production, test, or staging.`
    );
  }

  // Validate common required variables in production
  if (nodeEnv === 'production') {
    const requiredProdVars = ['VOILA_SERVICE_NAME'];
    const missing = requiredProdVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.warn(
        `[VoilaJSX AppKit] Missing recommended production environment variables: ${missing.join(', ')}`
      );
    }
  }
}

/**
 * Check if environment variable is a framework variable that should be ignored
 * @llm-rule WHEN: Filtering out framework variables from app config parsing
 * @llm-rule AVOID: Parsing framework variables as app config - they serve different purposes
 * @llm-rule NOTE: VoilaJSX AppKit uses VOILA_* and FLUX_* for internal configuration
 */
function isFrameworkVariable(envKey: string): boolean {
  const frameworkPrefixes = [
    'VOILA_',      // VoilaJSX AppKit framework configuration
    'FLUX_',       // Flux Framework internal variables
    'NODE_',       // Node.js environment variables
    'npm_',        // npm variables
  ];

  return frameworkPrefixes.some(prefix => envKey.startsWith(prefix));
}

/**
 * Check if environment variable is a system variable that should be ignored
 * @llm-rule WHEN: Filtering out system variables from app config validation
 * @llm-rule AVOID: Validating system variables - they don't follow our conventions
 */
function isSystemVariable(envKey: string): boolean {
  const systemVarPrefixes = [
    '__CF',        // macOS Core Foundation variables
    '__VERCEL_',   // Vercel deployment variables
    '__NEXT_',     // Next.js internal variables
    '_',           // Shell variables starting with underscore
    'TERM',        // Terminal variables
    'SHELL',       // Shell variables
    'PATH',        // System PATH
    'HOME',        // User home directory
    'USER',        // Current user
    'PWD',         // Present working directory
    'OLDPWD',      // Previous working directory
    'SHLVL',       // Shell level
    'PS1',         // Primary prompt string
    'LANG',        // Language settings
    'LC_',         // Locale settings
    'XDG_',        // XDG Base Directory variables
  ];

  // Check system variable prefixes
  if (systemVarPrefixes.some(prefix => envKey.startsWith(prefix))) {
    return true;
  }

  // Check for common system variables
  const systemVars = [
    'TMPDIR', 'TMP', 'TEMP',
    'EDITOR', 'VISUAL',
    'PAGER', 'LESS',
    'DISPLAY', 'XAUTHORITY',
    'SSH_AUTH_SOCK', 'SSH_AGENT_PID',
    'CONDA_DEFAULT_ENV', 'VIRTUAL_ENV',
    'JAVA_HOME', 'ANDROID_HOME',
    'DOCKER_HOST', 'KUBERNETES_SERVICE_HOST',
    'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS_URL',
  ];

  return systemVars.includes(envKey);
}

/**
 * Validates environment variable format for common mistakes
 * @llm-rule WHEN: Processing custom environment variables for format validation
 * @llm-rule AVOID: Silent format errors - validates UPPER_SNAKE_CASE convention
 */
function validateEnvVarFormat(envKey: string): boolean {
  // Skip framework and system variables - they don't follow our conventions
  if (isFrameworkVariable(envKey) || isSystemVariable(envKey)) {
    return true;
  }

  // Check for proper UPPER_SNAKE_CASE format
  if (envKey !== envKey.toUpperCase()) {
    console.warn(
      `[VoilaJSX AppKit] Environment variable "${envKey}" should be uppercase for consistency`
    );
  }
  
  return true;
}

/**
 * Builds the entire configuration object from process.env
 * @llm-rule WHEN: App startup to get production-ready configuration from environment
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule CONVENTION: Only processes non-framework variables for user config
 * @llm-rule CONVENTION: Variables with VOILA_* and FLUX_* are AppKit internal
 */
export function buildConfigFromEnv(): AppConfig {
  validateEnvironment();

  const config: AppConfig = {
    app: {
      name: process.env.VOILA_SERVICE_NAME || process.env.npm_package_name || 'voila-app',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
      host: process.env.HOST || undefined,
    },
  };

  // Process ONLY user configuration variables using UPPER_SNAKE_CASE convention
  // IMPORTANT: Framework variables (VOILA_*, FLUX_*) are NOT processed as user config
  for (const envKey in process.env) {
    // Skip framework variables and system variables
    if (isFrameworkVariable(envKey) || isSystemVariable(envKey)) {
      continue;
    }
    
    // Process remaining variables as user configuration
    if (validateEnvVarFormat(envKey)) {
      const path = envKey.toLowerCase().split('_');
      const value = parseValue(process.env[envKey] || '');
      setNestedValue(config, path, value);
    }
  }

  return config;
}

/**
 * Validates critical configuration at startup
 * @llm-rule WHEN: App startup to ensure required config is present
 * @llm-rule AVOID: Skipping validation - missing config causes runtime errors
 * @llm-rule NOTE: Add your app-specific required config here
 */
export function validateConfig(config: AppConfig): void {
  const environment = config.app.environment;
  
  // Production-specific validations
  if (environment === 'production') {
    if (!config.app.name || config.app.name === 'voila-app') {
      throw new Error(
        'VOILA_SERVICE_NAME is required in production. ' +
        'Set environment variable: VOILA_SERVICE_NAME=your-app-name'
      );
    }
  }
  
  // Port validation
  if (config.app.port && (config.app.port < 1 || config.app.port > 65535)) {
    throw new Error(
      `Invalid PORT: ${config.app.port}. Must be between 1 and 65535.`
    );
  }
}

/**
 * Gets smart defaults with validation
 * @llm-rule WHEN: App startup to get production-ready configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 */
export function getSmartDefaults(): AppConfig {
  const config = buildConfigFromEnv();
  validateConfig(config);
  return config;
}