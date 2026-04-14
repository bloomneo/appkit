/**
 * Smart defaults and environment validation for file storage with auto-strategy detection
 * @module @bloomneo/appkit/storage
 * @file src/storage/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to configure storage system and connection strategy
 * @llm-rule AVOID: Calling multiple times - expensive environment parsing, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 * @llm-rule NOTE: Auto-detects Local vs S3 vs R2 based on environment variables
 */
export interface LocalConfig {
    dir: string;
    baseUrl: string;
    maxFileSize: number;
    allowedTypes: string[];
    createDirs: boolean;
}
export interface S3Config {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    signedUrlExpiry: number;
    cdnUrl?: string;
}
export interface R2Config {
    bucket: string;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    cdnUrl?: string;
    signedUrlExpiry: number;
}
export interface StorageConfig {
    strategy: 'local' | 's3' | 'r2';
    local?: LocalConfig;
    s3?: S3Config;
    r2?: R2Config;
    environment: {
        isDevelopment: boolean;
        isProduction: boolean;
        isTest: boolean;
        nodeEnv: string;
    };
}
/**
 * Gets smart defaults using environment variables with auto-strategy detection
 * @llm-rule WHEN: App startup to get production-ready storage configuration
 * @llm-rule AVOID: Calling repeatedly - expensive validation, cache the result
 * @llm-rule NOTE: Auto-detects strategy: S3/R2 env vars → Cloud, nothing → Local
 */
export declare function getSmartDefaults(): StorageConfig;
/**
 * Checks if cloud storage is available and properly configured
 * @llm-rule WHEN: Conditional logic based on storage capabilities
 * @llm-rule AVOID: Complex storage detection - just use storage normally, strategy handles it
 */
export declare function hasCloudStorage(): boolean;
//# sourceMappingURL=defaults.d.ts.map