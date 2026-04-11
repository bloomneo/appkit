/**
 * Local filesystem storage strategy with automatic directory management
 * @module @bloomneo/appkit/storage
 * @file src/storage/strategies/local.ts
 *
 * @llm-rule WHEN: No cloud storage env vars - perfect for development and single-server apps
 * @llm-rule AVOID: Production use across multiple servers - files don't sync across instances
 * @llm-rule NOTE: Fast local storage, automatic directory creation, file serving support
 */
import type { StorageStrategy, StorageFile, PutOptions } from '../storage.js';
import type { StorageConfig } from '../defaults.js';
/**
 * Local filesystem storage strategy with intelligent file management
 */
export declare class LocalStrategy implements StorageStrategy {
    private config;
    private baseDir;
    private baseUrl;
    private maxFileSize;
    private allowedTypes;
    /**
     * Creates local strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Storage initialization without cloud env vars - automatic fallback
     * @llm-rule AVOID: Manual local configuration - environment detection handles this
     */
    constructor(config: StorageConfig);
    /**
     * Stores file to local filesystem with automatic directory creation
     * @llm-rule WHEN: Saving files to local storage for development or single-server apps
     * @llm-rule AVOID: Manual directory management - this handles nested paths automatically
     */
    put(key: string, data: Buffer, options?: PutOptions): Promise<string>;
    /**
     * Retrieves file from local filesystem with error handling
     * @llm-rule WHEN: Loading files from local storage
     * @llm-rule AVOID: Direct fs operations - this handles errors and validation
     */
    get(key: string): Promise<Buffer>;
    /**
     * Deletes file from local filesystem with confirmation
     * @llm-rule WHEN: Removing files from local storage
     * @llm-rule AVOID: Silent failures - this confirms deletion or reports issues
     */
    delete(key: string): Promise<boolean>;
    /**
     * Lists files with prefix filtering and metadata
     * @llm-rule WHEN: Browsing local files or implementing file managers
     * @llm-rule AVOID: Loading all files - this efficiently scans directories
     */
    list(prefix?: string): Promise<StorageFile[]>;
    /**
     * Gets public URL for local file access
     * @llm-rule WHEN: Generating URLs for local file serving
     * @llm-rule AVOID: Hardcoded paths - this handles base URL configuration
     */
    url(key: string): string;
    /**
     * Checks if file exists without reading content
     * @llm-rule WHEN: Validating file existence efficiently
     * @llm-rule AVOID: Reading entire file just to check existence
     */
    exists(key: string): Promise<boolean>;
    /**
     * Generates signed URL for temporary local file access (not applicable for local storage)
     * @llm-rule WHEN: API compatibility - local storage doesn't support signed URLs
     * @llm-rule AVOID: Using signed URLs with local storage - use regular URLs instead
     */
    signedUrl(key: string, expiresIn?: number): Promise<string>;
    /**
     * Copies file within local filesystem efficiently
     * @llm-rule WHEN: Duplicating files within local storage
     * @llm-rule AVOID: Read/write operations - this uses efficient copy operations
     */
    copy(sourceKey: string, destKey: string): Promise<string>;
    /**
     * Disconnects local strategy gracefully
     * @llm-rule WHEN: App shutdown or storage cleanup
     * @llm-rule AVOID: Leaving temp files - this cleans up if configured
     */
    disconnect(): Promise<void>;
    /**
     * Gets absolute file path from storage key
     */
    private getFilePath;
    /**
     * Ensures directory exists, creating it if necessary
     */
    private ensureDirectoryExists;
    /**
     * Recursively scans directory for files matching pattern
     */
    private scanDirectory;
    /**
     * Cleans up empty directories after file deletion
     */
    private cleanupEmptyDirectories;
    /**
     * Sets file metadata using extended attributes (where supported)
     */
    private setFileMetadata;
    /**
     * Gets content type from file extension
     */
    private getContentTypeFromExtension;
    /**
     * Gets detailed local storage statistics
     */
    getDetailedStats(): {
        strategy: string;
        baseDir: string;
        totalFiles: number;
        totalSize: number;
        maxFileSize: number;
        allowedTypes: string[];
    };
}
//# sourceMappingURL=local.d.ts.map