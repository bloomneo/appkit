/**
 * Smart configuration management with automatic environment variable parsing
 * @module @bloomneo/appkit/config
 * @file src/config/config.ts
 *
 * @llm-rule WHEN: Building apps that need configuration from environment variables
 * @llm-rule AVOID: Manual env parsing or complex config files - this handles it automatically
 * @llm-rule NOTE: Uses UPPER_SNAKE_CASE convention (DATABASE_HOST → config.get('database.host'))
 */
export declare class ConfigClass {
    private readonly _config;
    /**
     * Creates a new, immutable Config instance
     * @llm-rule WHEN: App startup - need to parse environment variables into structured config
     * @llm-rule AVOID: Calling directly - always use configClass.get() instead
     * @llm-rule NOTE: Config is immutable and deeply frozen for safety
     */
    constructor(initialConfig?: Record<string, any>);
    /**
     * Gets a specific configuration value using dot notation
     * @llm-rule WHEN: Accessing any config value from environment variables
     * @llm-rule AVOID: Accessing process.env directly - use this for type safety and defaults
     * @llm-rule NOTE: parseValue() coerces env strings — "true"/"false" → boolean, numeric strings → number
     */
    get<T>(path: string, defaultValue: T): T;
    get<T = any>(path: string): T | undefined;
    /**
     * Checks if a configuration path exists
     * @llm-rule WHEN: Need to conditionally enable features based on config presence
     */
    has(path: string): boolean;
    /**
     * Returns the entire, immutable configuration object
     * @llm-rule WHEN: Debugging config or passing entire config to other modules
     * @llm-rule AVOID: Using in production loops - expensive operation, cache the result
     */
    getAll(): Record<string, any>;
    /**
     * Gets a required configuration value (throws if missing)
     * @llm-rule WHEN: App startup validation for critical config values
     * @llm-rule AVOID: Using in request handlers - expensive error creation
     * @llm-rule NOTE: Use this for database URLs, API keys, and other critical settings
     */
    getRequired<T = any>(path: string): T;
    /**
     * Gets multiple configuration values at once
     * @llm-rule WHEN: Need several related config values for a module
     * @llm-rule AVOID: Multiple get() calls when you need many values - use this for performance
     */
    getMany<T extends Record<string, any>>(paths: {
        [K in keyof T]: string;
    }): T;
    /**
     * Deep freeze helper for immutability
     */
    private deepFreeze;
    /**
     * Converts dot notation path to environment variable name
     */
    private pathToEnvVar;
}
//# sourceMappingURL=config.d.ts.map