/**
 * Local filesystem storage strategy with automatic directory management
 * @module @bloomneo/appkit/storage
 * @file src/storage/strategies/local.ts
 *
 * @llm-rule WHEN: No cloud storage env vars - perfect for development and single-server apps
 * @llm-rule AVOID: Production use across multiple servers - files don't sync across instances
 * @llm-rule NOTE: Fast local storage, automatic directory creation, file serving support
 */
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/storage/README.md';
/**
 * Local filesystem storage strategy with intelligent file management
 */
export class LocalStrategy {
    config;
    baseDir;
    baseUrl;
    maxFileSize;
    allowedTypes;
    /**
     * Creates local strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Storage initialization without cloud env vars - automatic fallback
     * @llm-rule AVOID: Manual local configuration - environment detection handles this
     */
    constructor(config) {
        this.config = config;
        if (!config.local) {
            throw new Error(`[@bloomneo/appkit/storage] Local storage configuration missing. See: ${DOCS_URL}#environment-variables`);
        }
        this.baseDir = path.resolve(config.local.dir);
        this.baseUrl = config.local.baseUrl;
        this.maxFileSize = config.local.maxFileSize;
        this.allowedTypes = config.local.allowedTypes;
        // Ensure base directory exists on initialization
        this.ensureDirectoryExists(this.baseDir);
        if (this.config.environment.isDevelopment) {
            console.log(`✅ [@bloomneo/appkit/storage] Local storage initialized (dir: ${this.baseDir}, maxSize: ${Math.round(this.maxFileSize / 1048576)}MB)`);
        }
    }
    /**
     * Stores file to local filesystem with automatic directory creation
     * @llm-rule WHEN: Saving files to local storage for development or single-server apps
     * @llm-rule AVOID: Manual directory management - this handles nested paths automatically
     */
    async put(key, data, options) {
        try {
            const filePath = this.getFilePath(key);
            // Ensure parent directory exists
            const parentDir = path.dirname(filePath);
            await this.ensureDirectoryExists(parentDir);
            // Write file to disk
            await fs.writeFile(filePath, data);
            // Set file metadata if supported (extended attributes not available on all systems)
            if (options?.metadata) {
                try {
                    await this.setFileMetadata(filePath, options.metadata);
                }
                catch (error) {
                    // Metadata setting is optional, don't fail the operation
                    if (this.config.environment.isDevelopment) {
                        console.warn(`[@bloomneo/appkit/storage] Could not set metadata for ${key}:`, error.message);
                    }
                }
            }
            if (this.config.environment.isDevelopment) {
                console.log(`📁 [@bloomneo/appkit/storage] Local file stored: ${key} (${data.length} bytes)`);
            }
            return key;
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/storage] Failed to store file locally: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Retrieves file from local filesystem with error handling
     * @llm-rule WHEN: Loading files from local storage
     * @llm-rule AVOID: Direct fs operations - this handles errors and validation
     */
    async get(key) {
        try {
            const filePath = this.getFilePath(key);
            // Check if file exists before reading
            if (!existsSync(filePath)) {
                throw new Error(`[@bloomneo/appkit/storage] File not found: ${key}. See: ${DOCS_URL}#common-issues`);
            }
            // Read file from disk
            const data = await fs.readFile(filePath);
            if (this.config.environment.isDevelopment) {
                console.log(`📁 [@bloomneo/appkit/storage] Local file retrieved: ${key} (${data.length} bytes)`);
            }
            return data;
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/storage] Failed to retrieve file locally: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Deletes file from local filesystem with confirmation
     * @llm-rule WHEN: Removing files from local storage
     * @llm-rule AVOID: Silent failures - this confirms deletion or reports issues
     */
    async delete(key) {
        try {
            const filePath = this.getFilePath(key);
            // Check if file exists
            if (!existsSync(filePath)) {
                return false; // File doesn't exist, consider it "deleted"
            }
            // Delete file
            await fs.unlink(filePath);
            // Clean up empty directories
            await this.cleanupEmptyDirectories(path.dirname(filePath));
            if (this.config.environment.isDevelopment) {
                console.log(`🗑️ [@bloomneo/appkit/storage] Local file deleted: ${key}`);
            }
            return true;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Local delete error for "${key}":`, error.message);
            return false;
        }
    }
    /**
     * Lists files with prefix filtering and metadata
     * @llm-rule WHEN: Browsing local files or implementing file managers
     * @llm-rule AVOID: Loading all files - this efficiently scans directories
     */
    async list(prefix = '') {
        try {
            const searchDir = prefix ? path.join(this.baseDir, path.dirname(prefix)) : this.baseDir;
            const searchPattern = prefix ? path.basename(prefix) : '';
            if (!existsSync(searchDir)) {
                return []; // Directory doesn't exist, return empty list
            }
            const files = [];
            await this.scanDirectory(searchDir, files, searchPattern, prefix);
            // Sort by key for consistent ordering
            files.sort((a, b) => a.key.localeCompare(b.key));
            if (this.config.environment.isDevelopment) {
                console.log(`📋 [@bloomneo/appkit/storage] Local files listed: ${prefix}* (${files.length} files)`);
            }
            return files;
        }
        catch (error) {
            console.error(`[@bloomneo/appkit/storage] Local list error for prefix "${prefix}":`, error.message);
            return [];
        }
    }
    /**
     * Gets public URL for local file access
     * @llm-rule WHEN: Generating URLs for local file serving
     * @llm-rule AVOID: Hardcoded paths - this handles base URL configuration
     */
    url(key) {
        // Normalize key to use forward slashes for URLs
        const normalizedKey = key.replace(/\\/g, '/');
        // Ensure base URL ends with / and key doesn't start with /
        const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/';
        const cleanKey = normalizedKey.startsWith('/') ? normalizedKey.slice(1) : normalizedKey;
        return baseUrl + cleanKey;
    }
    /**
     * Checks if file exists without reading content
     * @llm-rule WHEN: Validating file existence efficiently
     * @llm-rule AVOID: Reading entire file just to check existence
     */
    async exists(key) {
        try {
            const filePath = this.getFilePath(key);
            return existsSync(filePath);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Generates signed URL for temporary local file access (not applicable for local storage)
     * @llm-rule WHEN: API compatibility - local storage doesn't support signed URLs
     * @llm-rule AVOID: Using signed URLs with local storage - use regular URLs instead
     */
    async signedUrl(key, expiresIn = 3600) {
        // Local storage doesn't support signed URLs, return regular URL
        console.warn('[@bloomneo/appkit/storage] Signed URLs not supported with local storage, returning public URL');
        return this.url(key);
    }
    /**
     * Copies file within local filesystem efficiently
     * @llm-rule WHEN: Duplicating files within local storage
     * @llm-rule AVOID: Read/write operations - this uses efficient copy operations
     */
    async copy(sourceKey, destKey) {
        try {
            const sourcePath = this.getFilePath(sourceKey);
            const destPath = this.getFilePath(destKey);
            // Check source exists
            if (!existsSync(sourcePath)) {
                throw new Error(`[@bloomneo/appkit/storage] Source file not found: ${sourceKey}. See: ${DOCS_URL}#common-issues`);
            }
            // Ensure destination directory exists
            const destDir = path.dirname(destPath);
            await this.ensureDirectoryExists(destDir);
            // Copy file
            await fs.copyFile(sourcePath, destPath);
            if (this.config.environment.isDevelopment) {
                console.log(`📁 [@bloomneo/appkit/storage] Local file copied: ${sourceKey} → ${destKey}`);
            }
            return destKey;
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/storage] Failed to copy file locally: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Disconnects local strategy gracefully
     * @llm-rule WHEN: App shutdown or storage cleanup
     * @llm-rule AVOID: Leaving temp files - this cleans up if configured
     */
    async disconnect() {
        // Local storage doesn't need explicit disconnection
        // Could implement cleanup of temp files here if needed
        if (this.config.environment.isDevelopment) {
            console.log(`👋 [@bloomneo/appkit/storage] Local storage strategy disconnected`);
        }
    }
    // Private helper methods
    /**
     * Gets absolute file path from storage key
     */
    getFilePath(key) {
        // Normalize path separators and prevent directory traversal
        const normalizedKey = key.replace(/\\/g, '/').replace(/\.\.+/g, '');
        return path.join(this.baseDir, normalizedKey);
    }
    /**
     * Ensures directory exists, creating it if necessary
     */
    async ensureDirectoryExists(dirPath) {
        try {
            if (!existsSync(dirPath)) {
                await fs.mkdir(dirPath, { recursive: true });
            }
        }
        catch (error) {
            throw new Error(`[@bloomneo/appkit/storage] Failed to create directory: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Recursively scans directory for files matching pattern
     */
    async scanDirectory(dirPath, files, pattern = '', prefix = '') {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    await this.scanDirectory(fullPath, files, pattern, prefix);
                }
                else if (entry.isFile()) {
                    // Check if file matches pattern
                    if (!pattern || entry.name.startsWith(pattern)) {
                        const relativePath = path.relative(this.baseDir, fullPath);
                        const key = relativePath.replace(/\\/g, '/'); // Normalize to forward slashes
                        // Get file stats
                        const stats = await fs.stat(fullPath);
                        files.push({
                            key,
                            size: stats.size,
                            lastModified: stats.mtime,
                            contentType: this.getContentTypeFromExtension(key),
                        });
                    }
                }
            }
        }
        catch (error) {
            // Directory access error, skip silently
            if (this.config.environment.isDevelopment) {
                console.warn(`[@bloomneo/appkit/storage] Error scanning directory ${dirPath}:`, error.message);
            }
        }
    }
    /**
     * Cleans up empty directories after file deletion
     */
    async cleanupEmptyDirectories(dirPath) {
        try {
            // Don't clean up the base directory
            if (dirPath === this.baseDir) {
                return;
            }
            const entries = await fs.readdir(dirPath);
            // If directory is empty, remove it and check parent
            if (entries.length === 0) {
                await fs.rmdir(dirPath);
                // Recursively check parent directory
                const parentDir = path.dirname(dirPath);
                if (parentDir !== dirPath && parentDir !== this.baseDir) {
                    await this.cleanupEmptyDirectories(parentDir);
                }
            }
        }
        catch (error) {
            // Cleanup is optional, don't fail if it doesn't work
            if (this.config.environment.isDevelopment) {
                console.warn(`[@bloomneo/appkit/storage] Could not cleanup directory ${dirPath}:`, error.message);
            }
        }
    }
    /**
     * Sets file metadata using extended attributes (where supported)
     */
    async setFileMetadata(filePath, metadata) {
        // Extended attributes are not universally supported
        // This is a placeholder for future metadata support
        // Could implement using file naming conventions or sidecar files
        // For now, we'll store metadata in a separate .meta file
        const metaPath = filePath + '.meta';
        const metaContent = JSON.stringify(metadata, null, 2);
        try {
            await fs.writeFile(metaPath, metaContent);
        }
        catch (error) {
            // Metadata is optional
            throw new Error(`[@bloomneo/appkit/storage] Failed to write metadata: ${error.message}. See: ${DOCS_URL}#common-issues`);
        }
    }
    /**
     * Gets content type from file extension
     */
    getContentTypeFromExtension(key) {
        const ext = path.extname(key).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.zip': 'application/zip',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    /**
     * Gets detailed local storage statistics
     */
    getDetailedStats() {
        return {
            strategy: 'local',
            baseDir: this.baseDir,
            totalFiles: 0, // Would need to scan to get accurate count
            totalSize: 0, // Would need to scan to get accurate size
            maxFileSize: this.maxFileSize,
            allowedTypes: this.allowedTypes,
        };
    }
}
//# sourceMappingURL=local.js.map