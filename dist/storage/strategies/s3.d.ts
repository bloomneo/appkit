/**
 * S3-compatible storage strategy with automatic connection management and multi-provider support
 * @module @bloomneo/appkit/storage
 * @file src/storage/strategies/s3.ts
 *
 * @llm-rule WHEN: App has AWS_S3_BUCKET or S3_ENDPOINT env vars for distributed cloud storage
 * @llm-rule AVOID: Manual S3 setup - this handles AWS, Wasabi, MinIO, DigitalOcean Spaces automatically
 * @llm-rule NOTE: Production-ready with retry logic, signed URLs, CDN support, automatic MIME detection
 */
import type { StorageStrategy, StorageFile, PutOptions } from '../storage.js';
import type { StorageConfig } from '../defaults.js';
/**
 * S3-compatible storage strategy with multi-provider support and reliability features
 */
export declare class S3Strategy implements StorageStrategy {
    private config;
    private s3Client;
    private connected;
    private bucket;
    private region;
    private endpoint?;
    private cdnUrl?;
    /**
     * Creates S3 strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Storage initialization with S3-compatible environment variables detected
     * @llm-rule AVOID: Manual S3 configuration - environment detection handles AWS/Wasabi/MinIO
     */
    constructor(config: StorageConfig);
    /**
     * Connects to S3-compatible service with automatic retry and provider detection
     * @llm-rule WHEN: Storage initialization or reconnection after failure
     * @llm-rule AVOID: Manual S3 client setup - this handles all provider configurations
     */
    connect(): Promise<void>;
    /**
     * Tests S3 connection by checking bucket access
     */
    private testConnection;
    /**
     * Detects S3 provider from configuration
     */
    private detectProvider;
    /**
     * Stores file to S3 with automatic content type detection and metadata
     * @llm-rule WHEN: Uploading files to S3-compatible cloud storage
     * @llm-rule AVOID: Manual S3 operations - this handles multipart uploads and metadata
     */
    put(key: string, data: Buffer, options?: PutOptions): Promise<string>;
    /**
     * Retrieves file from S3 with streaming support
     * @llm-rule WHEN: Downloading files from S3-compatible storage
     * @llm-rule AVOID: Manual S3 operations - this handles streaming and errors
     */
    get(key: string): Promise<Buffer>;
    /**
     * Deletes file from S3 with confirmation
     * @llm-rule WHEN: Removing files from S3-compatible storage
     * @llm-rule AVOID: Silent failures - this confirms deletion success
     */
    delete(key: string): Promise<boolean>;
    /**
     * Lists files with prefix filtering and pagination
     * @llm-rule WHEN: Browsing S3 files or implementing file managers
     * @llm-rule AVOID: Loading all objects - use prefix filtering and pagination
     */
    list(prefix?: string): Promise<StorageFile[]>;
    /**
     * Gets public or CDN URL for S3 object
     * @llm-rule WHEN: Generating URLs for S3 file access with CDN support
     * @llm-rule AVOID: Hardcoded URLs - this handles CDN and region-specific URLs
     */
    url(key: string): string;
    /**
     * Generates signed URL for temporary S3 object access
     * @llm-rule WHEN: Creating temporary download/upload links for S3 objects
     * @llm-rule AVOID: Permanent URLs for private files - use signed URLs with expiration
     */
    signedUrl(key: string, expiresIn?: number): Promise<string>;
    /**
     * Checks if S3 object exists without downloading
     * @llm-rule WHEN: Validating S3 object existence efficiently
     * @llm-rule AVOID: Downloading objects just to check existence
     */
    exists(key: string): Promise<boolean>;
    /**
     * Copies S3 object efficiently using server-side copy
     * @llm-rule WHEN: Duplicating S3 objects without downloading/uploading
     * @llm-rule AVOID: Download and upload - S3 server-side copy is much faster
     */
    copy(sourceKey: string, destKey: string): Promise<string>;
    /**
     * Disconnects S3 strategy gracefully
     * @llm-rule WHEN: App shutdown or storage cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    disconnect(): Promise<void>;
    /**
     * Converts readable stream to buffer
     */
    private streamToBuffer;
    /**
     * Detects content type from file extension and buffer
     */
    private detectContentType;
    /**
     * Gets content type for existing S3 object
     */
    private getObjectContentType;
    /**
     * Gets S3 connection info for debugging
     */
    getConnectionInfo(): {
        connected: boolean;
        bucket: string;
        region: string;
        endpoint?: string;
        provider: string;
        cdnEnabled: boolean;
    };
}
//# sourceMappingURL=s3.d.ts.map