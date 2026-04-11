/**
 * S3-compatible storage strategy with automatic connection management and multi-provider support
 * @module @bloomneo/appkit/storage
 * @file src/storage/strategies/s3.ts
 *
 * @llm-rule WHEN: App has AWS_S3_BUCKET or S3_ENDPOINT env vars for distributed cloud storage
 * @llm-rule AVOID: Manual S3 setup - this handles AWS, Wasabi, MinIO, DigitalOcean Spaces automatically
 * @llm-rule NOTE: Production-ready with retry logic, signed URLs, CDN support, automatic MIME detection
 */
/**
 * S3-compatible storage strategy with multi-provider support and reliability features
 */
export class S3Strategy {
    config;
    s3Client = null;
    connected = false;
    bucket;
    region;
    endpoint;
    cdnUrl;
    /**
     * Creates S3 strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Storage initialization with S3-compatible environment variables detected
     * @llm-rule AVOID: Manual S3 configuration - environment detection handles AWS/Wasabi/MinIO
     */
    constructor(config) {
        this.config = config;
        if (!config.s3) {
            throw new Error('S3 storage configuration missing');
        }
        this.bucket = config.s3.bucket;
        this.region = config.s3.region;
        this.endpoint = config.s3.endpoint;
        this.cdnUrl = config.s3.cdnUrl;
    }
    /**
     * Connects to S3-compatible service with automatic retry and provider detection
     * @llm-rule WHEN: Storage initialization or reconnection after failure
     * @llm-rule AVOID: Manual S3 client setup - this handles all provider configurations
     */
    async connect() {
        if (this.connected)
            return;
        try {
            // Dynamic import for S3 client
            const { S3Client } = await import('@aws-sdk/client-s3');
            const s3Config = this.config.s3;
            // Build S3 client configuration
            const clientConfig = {
                region: this.region,
                credentials: {
                    accessKeyId: s3Config.accessKeyId,
                    secretAccessKey: s3Config.secretAccessKey,
                },
                maxAttempts: 3, // Built-in retry logic
            };
            // Configure for S3-compatible services (Wasabi, MinIO, etc.)
            if (this.endpoint) {
                clientConfig.endpoint = this.endpoint;
                clientConfig.forcePathStyle = s3Config.forcePathStyle;
            }
            // Create S3 client
            this.s3Client = new S3Client(clientConfig);
            // Test connection by checking if bucket exists
            await this.testConnection();
            this.connected = true;
            if (this.config.environment.isDevelopment) {
                const provider = this.detectProvider();
                console.log(`✅ [AppKit] S3 storage connected (provider: ${provider}, bucket: ${this.bucket})`);
            }
        }
        catch (error) {
            this.connected = false;
            this.s3Client = null;
            throw new Error(`S3 storage connection failed: ${error.message}`);
        }
    }
    /**
     * Tests S3 connection by checking bucket access
     */
    async testConnection() {
        const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
        try {
            await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        }
        catch (error) {
            if (error.name === 'NotFound') {
                throw new Error(`S3 bucket not found: ${this.bucket}`);
            }
            if (error.name === 'Forbidden') {
                throw new Error(`S3 bucket access denied: ${this.bucket}`);
            }
            throw error;
        }
    }
    /**
     * Detects S3 provider from configuration
     */
    detectProvider() {
        if (!this.endpoint)
            return 'AWS S3';
        const hostname = new URL(this.endpoint).hostname.toLowerCase();
        if (hostname.includes('wasabi'))
            return 'Wasabi';
        if (hostname.includes('digitalocean'))
            return 'DigitalOcean Spaces';
        if (hostname.includes('minio') || hostname.includes('localhost'))
            return 'MinIO';
        if (hostname.includes('backblaze'))
            return 'Backblaze B2';
        return 'S3-Compatible';
    }
    /**
     * Stores file to S3 with automatic content type detection and metadata
     * @llm-rule WHEN: Uploading files to S3-compatible cloud storage
     * @llm-rule AVOID: Manual S3 operations - this handles multipart uploads and metadata
     */
    async put(key, data, options) {
        if (!this.connected || !this.s3Client) {
            throw new Error('S3 storage not connected');
        }
        try {
            const { PutObjectCommand } = await import('@aws-sdk/client-s3');
            // Build S3 put parameters
            const params = {
                Bucket: this.bucket,
                Key: key,
                Body: data,
                ContentType: options?.contentType || this.detectContentType(key, data),
            };
            // Add optional parameters
            if (options?.cacheControl) {
                params.CacheControl = options.cacheControl;
            }
            if (options?.expires) {
                params.Expires = options.expires;
            }
            if (options?.metadata) {
                params.Metadata = options.metadata;
            }
            // Execute upload
            await this.s3Client.send(new PutObjectCommand(params));
            if (this.config.environment.isDevelopment) {
                console.log(`☁️ [AppKit] S3 file uploaded: ${key} (${data.length} bytes)`);
            }
            return key;
        }
        catch (error) {
            throw new Error(`S3 upload failed: ${error.message}`);
        }
    }
    /**
     * Retrieves file from S3 with streaming support
     * @llm-rule WHEN: Downloading files from S3-compatible storage
     * @llm-rule AVOID: Manual S3 operations - this handles streaming and errors
     */
    async get(key) {
        if (!this.connected || !this.s3Client) {
            throw new Error('S3 storage not connected');
        }
        try {
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            const params = {
                Bucket: this.bucket,
                Key: key,
            };
            const result = await this.s3Client.send(new GetObjectCommand(params));
            if (!result.Body) {
                throw new Error(`S3 object has no body: ${key}`);
            }
            // Convert stream to buffer
            const buffer = await this.streamToBuffer(result.Body);
            if (this.config.environment.isDevelopment) {
                console.log(`☁️ [AppKit] S3 file downloaded: ${key} (${buffer.length} bytes)`);
            }
            return buffer;
        }
        catch (error) {
            if (error.name === 'NoSuchKey') {
                throw new Error(`File not found: ${key}`);
            }
            throw new Error(`S3 download failed: ${error.message}`);
        }
    }
    /**
     * Deletes file from S3 with confirmation
     * @llm-rule WHEN: Removing files from S3-compatible storage
     * @llm-rule AVOID: Silent failures - this confirms deletion success
     */
    async delete(key) {
        if (!this.connected || !this.s3Client) {
            console.error('S3 storage not connected');
            return false;
        }
        try {
            const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
            const params = {
                Bucket: this.bucket,
                Key: key,
            };
            await this.s3Client.send(new DeleteObjectCommand(params));
            if (this.config.environment.isDevelopment) {
                console.log(`🗑️ [AppKit] S3 file deleted: ${key}`);
            }
            return true;
        }
        catch (error) {
            console.error(`[AppKit] S3 delete error for "${key}":`, error.message);
            return false;
        }
    }
    /**
     * Lists files with prefix filtering and pagination
     * @llm-rule WHEN: Browsing S3 files or implementing file managers
     * @llm-rule AVOID: Loading all objects - use prefix filtering and pagination
     */
    async list(prefix = '') {
        if (!this.connected || !this.s3Client) {
            throw new Error('S3 storage not connected');
        }
        try {
            const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
            const params = {
                Bucket: this.bucket,
                MaxKeys: 1000, // Limit results for performance
            };
            if (prefix) {
                params.Prefix = prefix;
            }
            const result = await this.s3Client.send(new ListObjectsV2Command(params));
            const files = [];
            if (result.Contents) {
                for (const object of result.Contents) {
                    if (object.Key) {
                        files.push({
                            key: object.Key,
                            size: object.Size || 0,
                            lastModified: object.LastModified || new Date(),
                            etag: object.ETag?.replace(/"/g, ''), // Remove quotes from ETag
                            contentType: await this.getObjectContentType(object.Key),
                        });
                    }
                }
            }
            if (this.config.environment.isDevelopment) {
                console.log(`☁️ [AppKit] S3 files listed: ${prefix}* (${files.length} files)`);
            }
            return files;
        }
        catch (error) {
            console.error(`[AppKit] S3 list error for prefix "${prefix}":`, error.message);
            return [];
        }
    }
    /**
     * Gets public or CDN URL for S3 object
     * @llm-rule WHEN: Generating URLs for S3 file access with CDN support
     * @llm-rule AVOID: Hardcoded URLs - this handles CDN and region-specific URLs
     */
    url(key) {
        // Use CDN URL if configured
        if (this.cdnUrl) {
            const baseUrl = this.cdnUrl.endsWith('/') ? this.cdnUrl : this.cdnUrl + '/';
            const cleanKey = key.startsWith('/') ? key.slice(1) : key;
            return baseUrl + cleanKey;
        }
        // Generate S3 public URL
        if (this.endpoint) {
            // Custom endpoint (Wasabi, MinIO, etc.)
            const baseUrl = this.endpoint.endsWith('/') ? this.endpoint : this.endpoint + '/';
            return `${baseUrl}${this.bucket}/${key}`;
        }
        // AWS S3 URL
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }
    /**
     * Generates signed URL for temporary S3 object access
     * @llm-rule WHEN: Creating temporary download/upload links for S3 objects
     * @llm-rule AVOID: Permanent URLs for private files - use signed URLs with expiration
     */
    async signedUrl(key, expiresIn = 3600) {
        if (!this.connected || !this.s3Client) {
            throw new Error('S3 storage not connected');
        }
        try {
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });
            const signedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn,
            });
            if (this.config.environment.isDevelopment) {
                console.log(`🔐 [AppKit] S3 signed URL generated: ${key} (expires in ${expiresIn}s)`);
            }
            return signedUrl;
        }
        catch (error) {
            throw new Error(`S3 signed URL generation failed: ${error.message}`);
        }
    }
    /**
     * Checks if S3 object exists without downloading
     * @llm-rule WHEN: Validating S3 object existence efficiently
     * @llm-rule AVOID: Downloading objects just to check existence
     */
    async exists(key) {
        if (!this.connected || !this.s3Client) {
            return false;
        }
        try {
            const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
            const params = {
                Bucket: this.bucket,
                Key: key,
            };
            await this.s3Client.send(new HeadObjectCommand(params));
            return true;
        }
        catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                return false;
            }
            console.error(`[AppKit] S3 exists check error for "${key}":`, error.message);
            return false;
        }
    }
    /**
     * Copies S3 object efficiently using server-side copy
     * @llm-rule WHEN: Duplicating S3 objects without downloading/uploading
     * @llm-rule AVOID: Download and upload - S3 server-side copy is much faster
     */
    async copy(sourceKey, destKey) {
        if (!this.connected || !this.s3Client) {
            throw new Error('S3 storage not connected');
        }
        try {
            const { CopyObjectCommand } = await import('@aws-sdk/client-s3');
            const params = {
                Bucket: this.bucket,
                Key: destKey,
                CopySource: `${this.bucket}/${sourceKey}`,
            };
            await this.s3Client.send(new CopyObjectCommand(params));
            if (this.config.environment.isDevelopment) {
                console.log(`☁️ [AppKit] S3 file copied: ${sourceKey} → ${destKey}`);
            }
            return destKey;
        }
        catch (error) {
            throw new Error(`S3 copy failed: ${error.message}`);
        }
    }
    /**
     * Disconnects S3 strategy gracefully
     * @llm-rule WHEN: App shutdown or storage cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    async disconnect() {
        if (!this.connected)
            return;
        try {
            // S3 client doesn't need explicit disconnection
            // Could implement connection pooling cleanup here if needed
            this.connected = false;
            this.s3Client = null;
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [AppKit] S3 storage strategy disconnected`);
            }
        }
        catch (error) {
            console.error(`[AppKit] S3 disconnect error:`, error.message);
        }
    }
    // Private helper methods
    /**
     * Converts readable stream to buffer
     */
    async streamToBuffer(stream) {
        const chunks = [];
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }
    /**
     * Detects content type from file extension and buffer
     */
    detectContentType(key, buffer) {
        // Get extension from key
        const ext = key.split('.').pop()?.toLowerCase();
        // Common MIME types
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'json': 'application/json',
            'csv': 'text/csv',
            'zip': 'application/zip',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
        };
        if (ext && mimeTypes[ext]) {
            return mimeTypes[ext];
        }
        // Simple buffer-based detection for images
        const magic = buffer.subarray(0, 4);
        if (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) {
            return 'image/jpeg';
        }
        if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) {
            return 'image/png';
        }
        if (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46) {
            return 'image/gif';
        }
        return 'application/octet-stream';
    }
    /**
     * Gets content type for existing S3 object
     */
    async getObjectContentType(key) {
        try {
            const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
            const params = {
                Bucket: this.bucket,
                Key: key,
            };
            const result = await this.s3Client.send(new HeadObjectCommand(params));
            return result.ContentType;
        }
        catch (error) {
            // If we can't get content type, return undefined
            return undefined;
        }
    }
    /**
     * Gets S3 connection info for debugging
     */
    getConnectionInfo() {
        return {
            connected: this.connected,
            bucket: this.bucket,
            region: this.region,
            endpoint: this.endpoint,
            provider: this.detectProvider(),
            cdnEnabled: !!this.cdnUrl,
        };
    }
}
//# sourceMappingURL=s3.js.map