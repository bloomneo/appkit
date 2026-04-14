/**
 * Smart configuration management with automatic environment variable parsing
 * @module @bloomneo/appkit/config
 * @file src/config/config.ts
 *
 * @llm-rule WHEN: Building apps that need configuration from environment variables
 * @llm-rule AVOID: Manual env parsing or complex config files - this handles it automatically
 * @llm-rule NOTE: Uses UPPER_SNAKE_CASE convention (DATABASE_HOST → config.get('database.host'))
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/config/README.md';
export class ConfigClass {
    _config;
    /**
     * Creates a new, immutable Config instance
     * @llm-rule WHEN: App startup - need to parse environment variables into structured config
     * @llm-rule AVOID: Calling directly - always use configClass.get() instead
     * @llm-rule NOTE: Config is immutable and deeply frozen for safety
     */
    constructor(initialConfig = {}) {
        // Make the config object deeply immutable for safety
        this._config = Object.freeze(this.deepFreeze(structuredClone(initialConfig)));
    }
    get(path, defaultValue) {
        if (typeof path !== 'string' || !path) {
            return defaultValue;
        }
        const segments = path.split('.');
        let current = this._config;
        for (const segment of segments) {
            if (current && typeof current === 'object' && segment in current) {
                current = current[segment];
            }
            else {
                return defaultValue;
            }
        }
        return current;
    }
    /**
     * Checks if a configuration path exists
     * @llm-rule WHEN: Need to conditionally enable features based on config presence
     */
    has(path) {
        return this.get(path) !== undefined;
    }
    /**
     * Returns the entire, immutable configuration object
     * @llm-rule WHEN: Debugging config or passing entire config to other modules
     * @llm-rule AVOID: Using in production loops - expensive operation, cache the result
     */
    getAll() {
        return this._config;
    }
    /**
     * Gets a required configuration value (throws if missing)
     * @llm-rule WHEN: App startup validation for critical config values
     * @llm-rule AVOID: Using in request handlers - expensive error creation
     * @llm-rule NOTE: Use this for database URLs, API keys, and other critical settings
     */
    getRequired(path) {
        const value = this.get(path);
        if (value === undefined) {
            throw new Error(`[@bloomneo/appkit/config] Missing required configuration: "${path}". Set environment variable: ${this.pathToEnvVar(path)}. See: ${DOCS_URL}#startup-validation`);
        }
        return value;
    }
    /**
     * Gets multiple configuration values at once
     * @llm-rule WHEN: Need several related config values for a module
     * @llm-rule AVOID: Multiple get() calls when you need many values - use this for performance
     */
    getMany(paths) {
        const result = {};
        for (const [key, path] of Object.entries(paths)) {
            const value = this.get(path);
            if (value !== undefined) {
                result[key] = value;
            }
        }
        return result;
    }
    /**
     * Deep freeze helper for immutability
     */
    deepFreeze(obj) {
        Object.getOwnPropertyNames(obj).forEach((prop) => {
            if (obj[prop] !== null && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')) {
                this.deepFreeze(obj[prop]);
            }
        });
        return Object.freeze(obj);
    }
    /**
     * Converts dot notation path to environment variable name
     */
    pathToEnvVar(path) {
        return path.split('.').join('_').toUpperCase();
    }
}
//# sourceMappingURL=config.js.map