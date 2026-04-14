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
export declare function getSmartDefaults(): EmailConfig;
/**
 * Validates that required email configuration is present for production
 * @llm-rule WHEN: App startup validation for production deployments
 * @llm-rule AVOID: Skipping validation - missing email config causes runtime issues
 */
export declare function validateProductionRequirements(): void;
/**
 * Validates startup configuration and throws detailed errors
 * @llm-rule WHEN: App startup to ensure email configuration is valid before starting
 * @llm-rule AVOID: Skipping validation - catches config issues early
 * @llm-rule NOTE: Comprehensive validation for production readiness
 */
export declare function validateStartupConfiguration(): {
    strategy: string;
    warnings: string[];
    errors: string[];
    ready: boolean;
};
/**
 * Performs comprehensive email system health check
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Running in critical path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed health status without exposing sensitive data
 */
export declare function performHealthCheck(): {
    status: 'healthy' | 'warning' | 'error';
    strategy: string;
    configured: boolean;
    issues: string[];
    ready: boolean;
    timestamp: string;
};
//# sourceMappingURL=defaults.d.ts.map