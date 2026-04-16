/**
 * Ultra-simple file storage that just works with automatic Local/S3/R2 strategy
 * @module @bloomneo/appkit/storage
 * @file src/storage/index.ts
 *
 * @llm-rule WHEN: Building apps that need file storage with zero configuration
 * @llm-rule AVOID: Complex storage setups - this auto-detects Local/S3/R2 from environment
 * @llm-rule NOTE: Uses storageClass.get() pattern like auth - get() → storage.put() → distributed
 * @llm-rule NOTE: Common pattern - storageClass.get() → storage.put() → storage.url() → served
 */
import { type StorageConfig } from './defaults.js';
export interface Storage {
    put(key: string, data: Buffer | Uint8Array | string, options?: PutOptions): Promise<string>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<boolean>;
    list(prefix?: string, limit?: number): Promise<StorageFile[]>;
    url(key: string): string;
    signedUrl(key: string, expiresIn?: number): Promise<string>;
    exists(key: string): Promise<boolean>;
    copy(sourceKey: string, destKey: string): Promise<string>;
    disconnect(): Promise<void>;
    getStrategy(): string;
    getConfig(): any;
}
export interface StorageFile {
    key: string;
    size: number;
    lastModified: Date;
    etag?: string;
    contentType?: string;
}
export interface PutOptions {
    contentType?: string;
    metadata?: Record<string, string>;
    cacheControl?: string;
    expires?: Date;
}
/**
 * Get storage instance - the only function you need to learn
 * Strategy auto-detected from environment (S3/R2 env vars → Cloud, nothing → Local)
 * @llm-rule WHEN: Need file storage in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating StorageClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → storage.put() → storage.url() → file served
 */
declare function get(overrides?: Partial<StorageConfig>): Storage;
/**
 * Clear storage instance and disconnect - essential for testing
 * @llm-rule WHEN: Testing storage logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
declare function clear(): Promise<void>;
/**
 * Reset storage configuration (useful for testing)
 * @llm-rule WHEN: Testing storage logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<StorageConfig>): Storage;
/**
 * Get active storage strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Local vs S3 vs R2)
 * @llm-rule AVOID: Using for application logic - storage should be transparent
 */
declare function getStrategy(): string;
/**
 * Get storage configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging storage configuration
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
declare function getConfig(): {
    strategy: string;
    connected: boolean;
    maxFileSize: number;
    allowedTypes: string[];
};
/**
 * Check if cloud storage is available and configured
 * @llm-rule WHEN: Conditional logic based on storage capabilities
 * @llm-rule AVOID: Complex storage detection - just use storage normally, strategy handles it
 */
declare function hasCloudStorage(): boolean;
/**
 * Check if local storage is being used
 * @llm-rule WHEN: Development vs production feature detection
 * @llm-rule AVOID: Using for business logic - storage should be transparent
 */
declare function isLocal(): boolean;
/**
 * Validate storage configuration at startup
 * @llm-rule WHEN: App startup to ensure storage is properly configured
 * @llm-rule AVOID: Skipping validation - missing storage config causes runtime failures
 */
declare function validateConfig(): void;
/**
 * Get storage statistics for monitoring
 * @llm-rule WHEN: Monitoring storage system health and usage
 * @llm-rule AVOID: Using for business logic - this is for monitoring only
 */
declare function getStats(): {
    strategy: string;
    connected: boolean;
    maxFileSize: string;
    environment: string;
};
/**
 * Graceful shutdown for storage system
 * @llm-rule WHEN: App shutdown or process termination
 * @llm-rule AVOID: Abrupt process exit - graceful shutdown prevents data corruption
 */
declare function shutdown(): Promise<void>;
/**
 * Upload helper with common patterns
 * @llm-rule WHEN: Quick file uploads with automatic naming and validation
 * @llm-rule AVOID: Manual key generation - this handles common upload patterns
 */
declare function upload(file: Buffer | Uint8Array | string, options?: {
    folder?: string;
    filename?: string;
    contentType?: string;
}): Promise<{
    key: string;
    url: string;
}>;
/**
 * Download helper with error handling
 * @llm-rule WHEN: Quick file downloads with automatic error handling
 * @llm-rule AVOID: Manual error handling - this provides consistent download experience
 */
declare function download(key: string): Promise<{
    data: Buffer;
    contentType?: string;
}>;
/**
 * Single storage export with minimal API (like auth module)
 */
export declare const storageClass: {
    readonly get: typeof get;
    readonly clear: typeof clear;
    readonly reset: typeof reset;
    readonly getStrategy: typeof getStrategy;
    readonly getConfig: typeof getConfig;
    readonly hasCloudStorage: typeof hasCloudStorage;
    readonly isLocal: typeof isLocal;
    readonly getStats: typeof getStats;
    readonly validateConfig: typeof validateConfig;
    readonly shutdown: typeof shutdown;
    readonly upload: typeof upload;
    readonly download: typeof download;
};
export type { StorageConfig } from './defaults.js';
export { StorageClass } from './storage.js';
export default storageClass;
//# sourceMappingURL=index.d.ts.map