/**
 * Smart defaults and environment validation for configuration management
 * @module @bloomneo/appkit/config
 * @file src/config/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to parse UPPER_SNAKE_CASE environment variables
 * @llm-rule AVOID: Calling multiple times - expensive parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/config/README.md';
/**
 * Parses a string value to its appropriate type (boolean, number, or string)
 * @llm-rule WHEN: Processing environment variables that need type conversion
 * @llm-rule AVOID: Manual string-to-type conversion - this handles edge cases properly
 * @llm-rule NOTE: Supports "true"/"false" → boolean, numeric strings → number
 */
function parseValue(value) {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    // Handle empty strings
    if (trimmed === '')
        return '';
    // Handle booleans
    const lowerValue = trimmed.toLowerCase();
    if (lowerValue === 'true')
        return true;
    if (lowerValue === 'false')
        return false;
    // Literal "null"/"undefined" strings are preserved as-is. Users who want
    // a falsy value should set the variable to an empty string.
    // Handle numbers. Leading "0" guards preserve ID-like strings ("007") as
    // strings, but decimals starting with "0." ("0.5") must still parse as numbers.
    const isLeadingZeroInt = trimmed.startsWith('0') && !trimmed.startsWith('0.');
    if (!isLeadingZeroInt && !isNaN(Number(trimmed))) {
        const num = Number(trimmed);
        // Only convert if it's a safe integer or a decimal that round-trips exactly.
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
function setNestedValue(obj, path, value, sourceKey) {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        const segment = path[i];
        const existing = current[segment];
        if (existing !== undefined && (typeof existing !== 'object' || existing === null)) {
            // Collision: a scalar already exists at this path, but we'd need to
            // descend into it. Warn and SKIP to avoid silent data loss. The first
            // writer wins; the user must rename one of the colliding env vars.
            console.warn(`[@bloomneo/appkit/config] Env var "${sourceKey}" collides with existing scalar at "${path.slice(0, i + 1).join('.')}". Skipped. Rename one of the conflicting variables.`);
            return;
        }
        if (existing === undefined) {
            current[segment] = {};
        }
        current = current[segment];
    }
    const leaf = path[path.length - 1];
    const existingLeaf = current[leaf];
    if (existingLeaf !== undefined && typeof existingLeaf === 'object' && existingLeaf !== null) {
        // Collision: we're about to assign a scalar over an existing object
        // (e.g. APP=myapp after APP_NAME=... already built config.app = {...}).
        console.warn(`[@bloomneo/appkit/config] Env var "${sourceKey}" would overwrite existing nested config at "${path.join('.')}". Skipped. Rename one of the conflicting variables.`);
        return;
    }
    current[leaf] = value;
}
/**
 * Validates the NODE_ENV for common conventions
 * @llm-rule WHEN: App startup to ensure proper environment configuration
 * @llm-rule AVOID: Skipping validation - improper NODE_ENV causes subtle bugs
 */
function validateEnvironment() {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv && !['development', 'production', 'test', 'staging'].includes(nodeEnv)) {
        console.warn(`[@bloomneo/appkit/config] Unusual NODE_ENV: "${nodeEnv}". Expected: development, production, test, or staging.`);
    }
    // Validate common required variables in production
    if (nodeEnv === 'production') {
        const requiredProdVars = ['BLOOM_SERVICE_NAME'];
        const missing = requiredProdVars.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            console.warn(`[@bloomneo/appkit/config] Missing recommended production environment variables: ${missing.join(', ')}. See: ${DOCS_URL}#environment-variables`);
        }
    }
}
/**
 * Check if environment variable is a framework variable that should be ignored
 * @llm-rule WHEN: Filtering out framework variables from app config parsing
 * @llm-rule AVOID: Parsing framework variables as app config - they serve different purposes
 * @llm-rule NOTE: Bloomneo AppKit uses BLOOM_* and FLUX_* for internal configuration
 */
export function isFrameworkVariable(envKey) {
    const frameworkPrefixes = [
        'BLOOM_', // Bloomneo AppKit framework configuration
        'FLUX_', // Flux Framework internal variables
        'NODE_', // Node.js environment variables
        'npm_', // npm variables
    ];
    return frameworkPrefixes.some(prefix => envKey.startsWith(prefix));
}
/**
 * Check if environment variable is a system variable that should be ignored
 * @llm-rule WHEN: Filtering out system variables from app config validation
 * @llm-rule AVOID: Validating system variables - they don't follow our conventions
 */
export function isSystemVariable(envKey) {
    const systemVarPrefixes = [
        '__CF', // macOS Core Foundation variables
        '__VERCEL_', // Vercel deployment variables
        '__NEXT_', // Next.js internal variables
        '_', // Shell variables starting with underscore
        'TERM', // Terminal variables
        'SHELL', // Shell variables
        'PATH', // System PATH
        'HOME', // User home directory
        'USER', // Current user
        'PWD', // Present working directory
        'OLDPWD', // Previous working directory
        'SHLVL', // Shell level
        'PS1', // Primary prompt string
        'LANG', // Language settings
        'LC_', // Locale settings
        'XDG_', // XDG Base Directory variables
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
 * Warns on non-UPPER_SNAKE_CASE app env var names. Does not block processing.
 * @llm-rule WHEN: Processing custom environment variables for format validation
 * @llm-rule AVOID: Silent format errors - validates UPPER_SNAKE_CASE convention
 */
function warnIfBadEnvVarFormat(envKey) {
    if (isFrameworkVariable(envKey) || isSystemVariable(envKey)) {
        return;
    }
    if (envKey !== envKey.toUpperCase()) {
        console.warn(`[@bloomneo/appkit/config] Environment variable "${envKey}" should be uppercase for consistency`);
    }
}
/**
 * Builds the entire configuration object from process.env
 * @llm-rule WHEN: App startup to get production-ready configuration from environment
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule CONVENTION: Only processes non-framework variables for user config
 * @llm-rule CONVENTION: Variables with BLOOM_* and FLUX_* are AppKit internal
 */
export function buildConfigFromEnv() {
    validateEnvironment();
    const config = {
        app: {
            name: process.env.BLOOM_SERVICE_NAME || process.env.npm_package_name || 'voila-app',
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
            host: process.env.HOST || undefined,
        },
    };
    // Process ONLY user configuration variables using UPPER_SNAKE_CASE convention.
    // Framework variables (BLOOM_*, FLUX_*) and system vars are NOT processed as user config.
    for (const envKey in process.env) {
        if (isFrameworkVariable(envKey) || isSystemVariable(envKey)) {
            continue;
        }
        warnIfBadEnvVarFormat(envKey);
        const path = envKey.toLowerCase().split('_');
        const value = parseValue(process.env[envKey] || '');
        setNestedValue(config, path, value, envKey);
    }
    return config;
}
/**
 * Validates critical configuration at startup
 * @llm-rule WHEN: App startup to ensure required config is present
 * @llm-rule AVOID: Skipping validation - missing config causes runtime errors
 * @llm-rule NOTE: Add your app-specific required config here
 */
export function validateConfig(config) {
    const environment = config.app.environment;
    // Production-specific validations
    if (environment === 'production') {
        if (!config.app.name || config.app.name === 'voila-app') {
            throw new Error(`[@bloomneo/appkit/config] BLOOM_SERVICE_NAME is required in production. Set environment variable: BLOOM_SERVICE_NAME=your-app-name. See: ${DOCS_URL}#environment-variables`);
        }
    }
    // Port validation
    if (config.app.port && (config.app.port < 1 || config.app.port > 65535)) {
        throw new Error(`[@bloomneo/appkit/config] Invalid PORT: ${config.app.port}. Must be between 1 and 65535. See: ${DOCS_URL}#environment-variables`);
    }
}
/**
 * Gets smart defaults with validation
 * @llm-rule WHEN: App startup to get production-ready configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 */
export function getSmartDefaults() {
    const config = buildConfigFromEnv();
    validateConfig(config);
    return config;
}
//# sourceMappingURL=defaults.js.map