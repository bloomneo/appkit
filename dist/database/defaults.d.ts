/**
 * Simplified defaults and validation for AppKit Database
 * Environment-driven configuration with smart detection
 *
 * Required Environment Variables:
 * - DATABASE_URL: Database connection string
 *
 * Optional Environment Variables:
 * - BLOOM_DB_TENANT: Enable tenant mode (auto/true/false)
 * - ORG_{NAME}: Organization-specific database URLs
 *
 * @module @bloomneo/appkit/database
 * @file src/database/defaults.js
 *
 * @llm-rule WHEN: App startup - need to validate database environment configuration
 * @llm-rule AVOID: Calling multiple times - expensive validation, use once at startup
 * @llm-rule NOTE: All tenant tables MUST have tenant_id text field (nullable)
 */
export declare function validateTenantId(tenantId: string): boolean;
export declare function validateOrgId(orgId: string): boolean;
export declare function validateDatabaseUrl(url: string): boolean;
declare class DatabaseError extends Error {
    statusCode: number;
    details: any;
    constructor(message: string, statusCode?: number, details?: any);
}
export declare function createDatabaseError(message: string, statusCode?: number, details?: any): DatabaseError;
export declare function detectProvider(url: string): string;
export declare function detectAdapter(url: string): string;
export declare function sanitizeDatabaseName(name: string): string;
export declare function getOrgEnvironmentVars(): Record<string, string>;
export declare function validateEnvironment(): any;
export declare function getSmartDefaults(): {
    database: {
        url: string;
        provider: string;
        adapter: string;
    };
    tenant: {
        enabled: any;
        mode: string;
        fieldName: string;
    };
    org: {
        enabled: any;
        count: any;
        urls: Record<string, string>;
    };
    environment: {
        isDevelopment: boolean;
        isProduction: boolean;
        nodeEnv: string;
    };
    validation: any;
};
export declare function validateSchema(client: any, requiredField?: string): Promise<{
    valid: boolean;
    warnings: string[];
}>;
export declare function formatBytes(bytes: number): string;
export declare function maskUrl(url: string): string;
export declare function getConfigSummary(): {
    database: {
        provider: string;
        adapter: string;
        url: string;
    };
    tenant: {
        enabled: any;
        mode: string;
    };
    org: {
        enabled: any;
        count: any;
        organizations: string[];
    };
    environment: string;
    validation: {
        valid: any;
        warningCount: any;
        errorCount: any;
    };
};
export declare function getCachedValidation(): any;
export declare function clearValidationCache(): void;
export {};
//# sourceMappingURL=defaults.d.ts.map