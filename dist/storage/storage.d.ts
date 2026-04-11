/**
 * Core storage class with automatic strategy selection and ultra-simple API
 * @module @bloomneo/appkit/storage
 * @file src/storage/storage.ts
 *
 * @llm-rule WHEN: Building apps that need file storage with automatic Local/S3/R2 selection
 * @llm-rule AVOID: Using directly - always get instance via storageClass.get()
 * @llm-rule NOTE: Auto-detects Local vs S3 vs R2 based on environment variables
 */
import type { StorageConfig } from './defaults.js';
export interface StorageStrategy {
    put(key: string, data: Buffer | Uint8Array | string): Promise<string>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<boolean>;
    list(prefix: string): Promise<StorageFile[]>;
    url(key: string): string;
    signedUrl?(key: string, expiresIn?: number): Promise<string>;
    exists(key: string): Promise<boolean>;
    disconnect(): Promise<void>;
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
 * Storage class with automatic strategy selection and ultra-simple API
 */
export declare class StorageClass {
    config: StorageConfig;
    private strategy;
    private connected;
    constructor(config: StorageConfig);
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Storage initialization - selects Local, S3, or R2 based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    private createStrategy;
    /**
     * Connects to storage backend with automatic setup
     * @llm-rule WHEN: Storage initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles connection state
     */
    connect(): Promise<void>;
    /**
     * Disconnects from storage backend gracefully
     * @llm-rule WHEN: App shutdown or storage cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    disconnect(): Promise<void>;
    /**
     * Stores file with automatic validation and type detection
     * @llm-rule WHEN: Uploading files to storage backend
     * @llm-rule AVOID: Manual file validation - this handles size, type, and path validation
     * @llm-rule NOTE: Returns the key/path where file was stored
     */
    put(key: string, data: Buffer | Uint8Array | string, options?: PutOptions): Promise<string>;
    /**
     * Retrieves file with automatic error handling
     * @llm-rule WHEN: Downloading files from storage backend
     * @llm-rule AVOID: Manual error handling - this provides consistent error messages
     */
    get(key: string): Promise<Buffer>;
    /**
     * Deletes file with confirmation
     * @llm-rule WHEN: Removing files from storage backend
     * @llm-rule AVOID: Silent failures - this confirms deletion success
     */
    delete(key: string): Promise<boolean>;
    /**
     * Lists files with prefix filtering and metadata
     * @llm-rule WHEN: Browsing files or implementing file managers
     * @llm-rule AVOID: Loading all files - use prefix filtering for performance
     */
    list(prefix?: string, limit?: number): Promise<StorageFile[]>;
    /**
     * Gets public URL for file access
     * @llm-rule WHEN: Generating URLs for file access in web applications
     * @llm-rule AVOID: Hardcoding URLs - this handles CDN and strategy-specific URLs
     */
    url(key: string): string;
    /**
     * Generates signed URL for temporary access
     * @llm-rule WHEN: Creating temporary download links or private file access
     * @llm-rule AVOID: Permanent URLs for private files - use signed URLs with expiration
     */
    signedUrl(key: string, expiresIn?: number): Promise<string>;
    /**
     * Checks if file exists without downloading
     * @llm-rule WHEN: Validating file existence before operations
     * @llm-rule AVOID: Downloading files just to check existence - this is more efficient
     */
    exists(key: string): Promise<boolean>;
    /**
     * Copies file from one location to another
     * @llm-rule WHEN: Duplicating files or moving between folders
     * @llm-rule AVOID: Download and upload - this uses efficient copy operations when possible
     */
    copy(sourceKey: string, destKey: string): Promise<string>;
    /**
     * Gets current storage strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - storage should be transparent
     */
    getStrategy(): string;
    /**
     * Gets storage configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging storage configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig(): {
        strategy: string;
        connected: boolean;
        maxFileSize: number;
        allowedTypes: string[];
    };
    /**
     * Ensures storage system is connected before operations
     */
    private ensureConnected;
    /**
     * Validates storage key format and security
     */
    private validateKey;
    /**
     * Normalizes input data to Buffer
     */
    private normalizeData;
    /**
     * Validates file size against configured limits
     */
    private validateFileSize;
    /**
     * Detects content type from file extension and buffer
     */
    private detectContentType;
    /**
     * Validates file type against allowed types
     */
    private validateFileType;
}
//# sourceMappingURL=storage.d.ts.map