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
 * @file src/database/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to validate database environment configuration
 * @llm-rule AVOID: Calling multiple times - expensive validation, use once at startup
 * @llm-rule NOTE: All tenant tables MUST have tenant_id text field (nullable)
 */
declare class DatabaseError extends Error {
    statusCode: number;
    details: any;
    constructor(message: string, statusCode?: number, details?: any);
}
export declare function createDatabaseError(message: string, statusCode?: number, details?: any, anchor?: string): DatabaseError;
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
export {};
//# sourceMappingURL=defaults.d.ts.map