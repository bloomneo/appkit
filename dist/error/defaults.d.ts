/**
 * Smart defaults and environment validation for error handling
 * @module @bloomneo/appkit/error
 * @file src/error/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure error handling behavior and messages
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
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
 * Gets smart defaults using VOILA_ERROR_* environment variables
 * @llm-rule WHEN: App startup to get production-ready error configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Automatically configures dev vs production error behavior
 */
export declare function getSmartDefaults(): ErrorConfig;
//# sourceMappingURL=defaults.d.ts.map