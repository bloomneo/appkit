/**
 * Cloudflare R2 storage strategy with zero egress fees and automatic CDN integration
 * @module @bloomneo/appkit/storage
 * @file src/storage/strategies/r2.ts
 *
 * @llm-rule WHEN: App has CLOUDFLARE_R2_BUCKET env var for cost-effective distributed storage
 * @llm-rule AVOID: Manual R2 setup - this handles connection, CDN integration, and S3-compatible API
 * @llm-rule NOTE: Production-ready with zero egress fees, automatic CDN, S3-compatible operations
 */
import type { StorageStrategy, StorageFile, PutOptions } from '../storage.js';
import type { StorageConfig } from '../defaults.js';
/**
 * Cloudflare R2 storage strategy with cost optimization and CDN integration
 */
export declare class R2Strategy implements StorageStrategy {
    private config;
    private r2Client;
    private connected;
    private bucket;
    private accountId;
    private cdnUrl?;
    private endpoint;
    /**
     * Creates R2 strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Storage initialization with Cloudflare R2 environment variables detected
     * @llm-rule AVOID: Manual R2 configuration - environment detection handles Cloudflare specifics
     */
    constructor(config: StorageConfig);
    /**
     * Connects to Cloudflare R2 with automatic account validation
     * @llm-rule WHEN: Storage initialization or reconnection after failure
     * @llm-rule AVOID: Manual R2 client setup - this handles Cloudflare-specific configuration
     */
    connect(): Promise<void>;
    /**
     * Tests R2 connection by checking bucket access
     */
    private testConnection;
    /**
     * Stores file to R2 with automatic content type detection and zero egress cost
     * @llm-rule WHEN: Uploading files to Cloudflare R2 for cost-effective storage
     * @llm-rule AVOID: Manual R2 operations - this handles R2-specific optimizations
     */
    put(key: string, data: Buffer, options?: PutOptions): Promise<string>;
    /**
     * Retrieves file from R2 with streaming support and zero egress cost
     * @llm-rule WHEN: Downloading files from Cloudflare R2
     * @llm-rule AVOID: Manual R2 operations - this handles streaming and cost optimization
     */
    get(key: string): Promise<Buffer>;
    /**
     * Deletes file from R2 with confirmation
     * @llm-rule WHEN: Removing files from Cloudflare R2 storage
     * @llm-rule AVOID: Silent failures - this confirms deletion success
     */
    delete(key: string): Promise<boolean>;
    /**
     * Lists files with prefix filtering and R2-optimized pagination
     * @llm-rule WHEN: Browsing R2 files or implementing file managers
     * @llm-rule AVOID: Loading all objects - R2 has same limits as S3
     */
    list(prefix?: string): Promise<StorageFile[]>;
    /**
     * Gets CDN or public URL for R2 object with automatic CDN detection
     * @llm-rule WHEN: Generating URLs for R2 file access with CDN optimization
     * @llm-rule AVOID: Hardcoded URLs - this handles CDN and R2-specific URLs
     */
    url(key: string): string;
    /**
     * Generates R2 public URL hash (simplified for demo)
     */
    private generatePublicHash;
    /**
     * Generates signed URL for temporary R2 object access
     * @llm-rule WHEN: Creating temporary download/upload links for R2 objects
     * @llm-rule AVOID: Public URLs for private files - use signed URLs with expiration
     */
    signedUrl(key: string, expiresIn?: number): Promise<string>;
    /**
     * Checks if R2 object exists without downloading
     * @llm-rule WHEN: Validating R2 object existence efficiently
     * @llm-rule AVOID: Downloading objects just to check existence
     */
    exists(key: string): Promise<boolean>;
    /**
     * Copies R2 object efficiently using server-side copy (zero egress cost)
     * @llm-rule WHEN: Duplicating R2 objects without bandwidth costs
     * @llm-rule AVOID: Download and upload - R2 server-side copy has zero egress fees
     */
    copy(sourceKey: string, destKey: string): Promise<string>;
    /**
     * Disconnects R2 strategy gracefully
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
     * Gets content type for existing R2 object
     */
    private getObjectContentType;
    /**
     * Gets R2 connection info for debugging
     */
    getConnectionInfo(): {
        connected: boolean;
        bucket: string;
        accountId: string;
        endpoint: string;
        cdnEnabled: boolean;
        zeroEgressFees: boolean;
    };
    /**
     * Gets R2-specific cost optimization info
     */
    getCostInfo(): {
        egressFees: string;
        storageClass: string;
        cdnIntegration: boolean;
        recommendedFor: string[];
    };
}
//# sourceMappingURL=r2.d.ts.map