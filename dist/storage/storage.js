/**
 * Core storage class with automatic strategy selection and ultra-simple API
 * @module @bloomneo/appkit/storage
 * @file src/storage/storage.ts
 *
 * @llm-rule WHEN: Building apps that need file storage with automatic Local/S3/R2 selection
 * @llm-rule AVOID: Using directly - always get instance via storageClass.get()
 * @llm-rule NOTE: Auto-detects Local vs S3 vs R2 based on environment variables
 */
import { LocalStrategy } from './strategies/local.js';
import { S3Strategy } from './strategies/s3.js';
import { R2Strategy } from './strategies/r2.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/storage/README.md';
/**
 * Storage class with automatic strategy selection and ultra-simple API
 */
export class StorageClass {
    config;
    strategy;
    connected = false;
    constructor(config) {
        this.config = config;
        this.strategy = this.createStrategy();
    }
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Storage initialization - selects Local, S3, or R2 based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    createStrategy() {
        switch (this.config.strategy) {
            case 'local':
                return new LocalStrategy(this.config);
            case 's3':
                return new S3Strategy(this.config);
            case 'r2':
                return new R2Strategy(this.config);
            default:
                throw new Error(`[@bloomneo/appkit/storage] Unknown storage strategy: ${this.config.strategy}. See: ${DOCS_URL}#environment-variables`);
        }
    }
    /**
     * Connects to storage backend with automatic setup
     * @llm-rule WHEN: Storage initialization or reconnection after failure
     * @llm-rule AVOID: Manual connection management - this handles connection state
     */
    async connect() {
        if (this.connected)
            return;
        try {
            // Strategy-specific connection (S3/R2 connect, Local creates dirs)
            if ('connect' in this.strategy) {
                await this.strategy.connect();
            }
            this.connected = true;
            if (this.config.environment.isDevelopment) {
                console.log(`✅ [@bloomneo/appkit/storage] Storage system connected using ${this.config.strategy} strategy`);
            }
        }
        catch (error) {
            console.error(`❌ [@bloomneo/appkit/storage] Storage connection failed:`, error.message);
            throw error;
        }
    }
    /**
     * Disconnects from storage backend gracefully
     * @llm-rule WHEN: App shutdown or storage cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents data loss
     */
    async disconnect() {
        if (!this.connected)
            return;
        try {
            await this.strategy.disconnect();
            this.connected = false;
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [@bloomneo/appkit/storage] Storage system disconnected`);
            }
        }
        catch (error) {
            console.error(`⚠️ [@bloomneo/appkit/storage] Storage disconnect error:`, error.message);
        }
    }
    /**
     * Stores file with automatic validation and type detection
     * @llm-rule WHEN: Uploading files to storage backend
     * @llm-rule AVOID: Manual file validation - this handles size, type, and path validation
     * @llm-rule NOTE: Returns the key/path where file was stored
     */
    async put(key, data, options) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            // Convert data to Buffer for consistency
            const buffer = this.normalizeData(data);
            // Validate file size
            this.validateFileSize(buffer);
            // Auto-detect content type if not provided
            const contentType = options?.contentType || this.detectContentType(key, buffer);
            // Validate file type
            this.validateFileType(contentType);
            // Store via strategy with enhanced options
            const enhancedOptions = {
                ...options,
                contentType,
            };
            const result = await this.strategy.put(key, buffer, enhancedOptions);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`📤 [@bloomneo/appkit/storage] File stored: ${key} (${buffer.length} bytes, ${contentType})`);
            }
            return result;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Storage put error for "${key}":`, error.message);
            throw error;
        }
    }
    /**
     * Retrieves file with automatic error handling
     * @llm-rule WHEN: Downloading files from storage backend
     * @llm-rule AVOID: Manual error handling - this provides consistent error messages
     */
    async get(key) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            const result = await this.strategy.get(key);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`📥 [@bloomneo/appkit/storage] File retrieved: ${key} (${result.length} bytes)`);
            }
            return result;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Storage get error for "${key}":`, error.message);
            throw new Error(`[@bloomneo/appkit/storage] File not found: ${key}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Deletes file with confirmation
     * @llm-rule WHEN: Removing files from storage backend
     * @llm-rule AVOID: Silent failures - this confirms deletion success
     */
    async delete(key) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            const result = await this.strategy.delete(key);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`🗑️ [@bloomneo/appkit/storage] File deleted: ${key} (success: ${result})`);
            }
            return result;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Storage delete error for "${key}":`, error.message);
            return false;
        }
    }
    /**
     * Lists files with prefix filtering and metadata
     * @llm-rule WHEN: Browsing files or implementing file managers
     * @llm-rule AVOID: Loading all files - use prefix filtering for performance
     */
    async list(prefix = '', limit) {
        await this.ensureConnected();
        try {
            const files = await this.strategy.list(prefix);
            // Apply limit if specified
            const result = limit ? files.slice(0, limit) : files;
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`📋 [@bloomneo/appkit/storage] Files listed: ${prefix}* (${result.length} files)`);
            }
            return result;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Storage list error for prefix "${prefix}":`, error.message);
            return [];
        }
    }
    /**
     * Gets public URL for file access
     * @llm-rule WHEN: Generating URLs for file access in web applications
     * @llm-rule AVOID: Hardcoding URLs - this handles CDN and strategy-specific URLs
     */
    url(key) {
        this.validateKey(key);
        try {
            const url = this.strategy.url(key);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`🔗 [@bloomneo/appkit/storage] URL generated: ${key} → ${url}`);
            }
            return url;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] URL generation error for "${key}":`, error.message);
            throw error;
        }
    }
    /**
     * Generates signed URL for temporary access
     * @llm-rule WHEN: Creating temporary download links or private file access
     * @llm-rule AVOID: Permanent URLs for private files - use signed URLs with expiration
     */
    async signedUrl(key, expiresIn = 3600) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            if (!this.strategy.signedUrl) {
                throw new Error(`[@bloomneo/appkit/storage] Signed URLs not supported with ${this.config.strategy} strategy. See: ${DOCS_URL}#common-issues`);
            }
            const url = await this.strategy.signedUrl(key, expiresIn);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`🔐 [@bloomneo/appkit/storage] Signed URL generated: ${key} (expires in ${expiresIn}s)`);
            }
            return url;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Signed URL error for "${key}":`, error.message);
            throw error;
        }
    }
    /**
     * Checks if file exists without downloading
     * @llm-rule WHEN: Validating file existence before operations
     * @llm-rule AVOID: Downloading files just to check existence - this is more efficient
     */
    async exists(key) {
        this.validateKey(key);
        await this.ensureConnected();
        try {
            const result = await this.strategy.exists(key);
            // Log in development
            if (this.config.environment.isDevelopment) {
                console.log(`🔍 [@bloomneo/appkit/storage] File exists check: ${key} → ${result}`);
            }
            return result;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Exists check error for "${key}":`, error.message);
            return false;
        }
    }
    /**
     * Copies file from one location to another
     * @llm-rule WHEN: Duplicating files or moving between folders
     * @llm-rule AVOID: Download and upload - this uses efficient copy operations when possible
     */
    async copy(sourceKey, destKey) {
        this.validateKey(sourceKey);
        this.validateKey(destKey);
        await this.ensureConnected();
        try {
            // Strategy-specific copy if available, otherwise download/upload
            if ('copy' in this.strategy) {
                return await this.strategy.copy(sourceKey, destKey);
            }
            // Fallback: download and upload
            const data = await this.get(sourceKey);
            return await this.put(destKey, data);
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Copy error "${sourceKey}" → "${destKey}":`, error.message);
            throw error;
        }
    }
    /**
     * Gets current storage strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - storage should be transparent
     */
    getStrategy() {
        return this.config.strategy;
    }
    /**
     * Gets storage configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging storage configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig() {
        // Get config values based on strategy
        let maxFileSize = 52428800; // 50MB default
        let allowedTypes = [];
        if (this.config.strategy === 'local' && this.config.local) {
            maxFileSize = this.config.local.maxFileSize;
            allowedTypes = this.config.local.allowedTypes;
        }
        else {
            // S3 and R2 use global config or defaults
            maxFileSize = 52428800; // 50MB default for cloud
            allowedTypes = ['*']; // Allow all for cloud storage
        }
        return {
            strategy: this.config.strategy,
            connected: this.connected,
            maxFileSize,
            allowedTypes,
        };
    }
    // Private helper methods
    /**
     * Ensures storage system is connected before operations
     */
    async ensureConnected() {
        if (!this.connected) {
            await this.connect();
        }
    }
    /**
     * Validates storage key format and security
     */
    validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error(`[@bloomneo/appkit/storage] Storage key must be a non-empty string. See: ${DOCS_URL}#common-issues`);
        }
        if (key.length > 1024) {
            throw new Error(`[@bloomneo/appkit/storage] Storage key too long (max 1024 characters). See: ${DOCS_URL}#common-issues`);
        }
        // Security: prevent path traversal
        if (key.includes('..') || key.includes('//')) {
            throw new Error(`[@bloomneo/appkit/storage] Storage key contains invalid path components. See: ${DOCS_URL}#common-issues`);
        }
        // Normalize separators
        if (key.includes('\\')) {
            throw new Error(`[@bloomneo/appkit/storage] Storage key must use forward slashes (/) as separators. See: ${DOCS_URL}#common-issues`);
        }
        // Remove leading slash for consistency
        if (key.startsWith('/')) {
            throw new Error(`[@bloomneo/appkit/storage] Storage key should not start with forward slash. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Normalizes input data to Buffer
     */
    normalizeData(data) {
        if (Buffer.isBuffer(data)) {
            return data;
        }
        if (data instanceof Uint8Array) {
            return Buffer.from(data);
        }
        if (typeof data === 'string') {
            return Buffer.from(data, 'utf8');
        }
        throw new Error(`[@bloomneo/appkit/storage] Data must be Buffer, Uint8Array, or string. See: ${DOCS_URL}#common-issues`);
    }
    /**
     * Validates file size against configured limits
     */
    validateFileSize(buffer) {
        let maxSize = 52428800; // 50MB default
        if (this.config.strategy === 'local' && this.config.local) {
            maxSize = this.config.local.maxFileSize;
        }
        // S3 and R2 use default limit for now
        if (buffer.length > maxSize) {
            const maxMB = Math.round(maxSize / 1048576);
            const fileMB = Math.round(buffer.length / 1048576);
            throw new Error(`[@bloomneo/appkit/storage] File too large: ${fileMB}MB (max: ${maxMB}MB). See: ${DOCS_URL}#common-issues`);
        }
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
        // Simple buffer-based detection
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
        return 'application/octet-stream'; // Default binary
    }
    /**
     * Validates file type against allowed types
     */
    validateFileType(contentType) {
        let allowedTypes = [];
        if (this.config.strategy === 'local' && this.config.local) {
            allowedTypes = this.config.local.allowedTypes;
        }
        else {
            // S3 and R2 allow all types by default (filtering done at app level)
            allowedTypes = ['*'];
        }
        // Allow all types if wildcard is present
        if (allowedTypes.includes('*')) {
            return;
        }
        // Check exact match or wildcard patterns
        const isAllowed = allowedTypes.some(allowedType => {
            if (allowedType === contentType) {
                return true;
            }
            // Support wildcard patterns like "image/*"
            if (allowedType.endsWith('/*')) {
                const prefix = allowedType.slice(0, -2);
                return contentType.startsWith(prefix + '/');
            }
            return false;
        });
        if (!isAllowed) {
            throw new Error(`[@bloomneo/appkit/storage] File type not allowed: ${contentType}. ` +
                `Allowed types: ${allowedTypes.join(', ')}. See: ${DOCS_URL}#common-issues`);
        }
    }
}
//# sourceMappingURL=storage.js.map