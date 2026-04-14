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
  private readonly _config: Record<string, any>;

  /**
   * Creates a new, immutable Config instance
   * @llm-rule WHEN: App startup - need to parse environment variables into structured config
   * @llm-rule AVOID: Calling directly - always use configClass.get() instead
   * @llm-rule NOTE: Config is immutable and deeply frozen for safety
   */
  constructor(initialConfig: Record<string, any> = {}) {
    // Make the config object deeply immutable for safety
    this._config = Object.freeze(this.deepFreeze(structuredClone(initialConfig)));
  }

  /**
   * Gets a specific configuration value using dot notation
   * @llm-rule WHEN: Accessing any config value from environment variables
   * @llm-rule AVOID: Accessing process.env directly - use this for type safety and defaults
   * @llm-rule NOTE: parseValue() coerces env strings — "true"/"false" → boolean, numeric strings → number
   */
  get<T>(path: string, defaultValue: T): T;
  get<T = any>(path: string): T | undefined;
  get<T = any>(path: string, defaultValue?: T): T | undefined {
    if (typeof path !== 'string' || !path) {
      return defaultValue;
    }

    const segments = path.split('.');
    let current: any = this._config;

    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return defaultValue;
      }
    }

    return current as T;
  }

  /**
   * Checks if a configuration path exists
   * @llm-rule WHEN: Need to conditionally enable features based on config presence
   */
  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  /**
   * Returns the entire, immutable configuration object
   * @llm-rule WHEN: Debugging config or passing entire config to other modules
   * @llm-rule AVOID: Using in production loops - expensive operation, cache the result
   */
  getAll(): Record<string, any> {
    return this._config;
  }

  /**
   * Gets a required configuration value (throws if missing)
   * @llm-rule WHEN: App startup validation for critical config values
   * @llm-rule AVOID: Using in request handlers - expensive error creation
   * @llm-rule NOTE: Use this for database URLs, API keys, and other critical settings
   */
  getRequired<T = any>(path: string): T {
    const value = this.get<T>(path);
    if (value === undefined) {
      throw new Error(
        `[@bloomneo/appkit/config] Missing required configuration: "${path}". Set environment variable: ${this.pathToEnvVar(path)}. See: ${DOCS_URL}#startup-validation`
      );
    }
    return value;
  }

  /**
   * Gets multiple configuration values at once
   * @llm-rule WHEN: Need several related config values for a module
   * @llm-rule AVOID: Multiple get() calls when you need many values - use this for performance
   */
  getMany<T extends Record<string, any>>(paths: { [K in keyof T]: string }): T {
    const result = {} as T;
    for (const [key, path] of Object.entries(paths)) {
      const value = this.get(path);
      if (value !== undefined) {
        result[key as keyof T] = value;
      }
    }
    return result;
  }

  /**
   * Deep freeze helper for immutability
   */
  private deepFreeze(obj: any): any {
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
  private pathToEnvVar(path: string): string {
    return path.split('.').join('_').toUpperCase();
  }
}