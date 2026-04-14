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
import { StorageClass } from './storage.js';
import { getSmartDefaults } from './defaults.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/storage/README.md';
// Global storage instance for performance (like auth module)
let globalStorage = null;
/**
 * Get storage instance - the only function you need to learn
 * Strategy auto-detected from environment (S3/R2 env vars → Cloud, nothing → Local)
 * @llm-rule WHEN: Need file storage in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating StorageClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → storage.put() → storage.url() → file served
 */
function get(overrides = {}) {
    // Lazy initialization - parse environment once (like auth)
    if (!globalStorage) {
        const defaults = getSmartDefaults();
        const config = { ...defaults, ...overrides };
        globalStorage = new StorageClass(config);
    }
    return globalStorage;
}
/**
 * Clear storage instance and disconnect - essential for testing
 * @llm-rule WHEN: Testing storage logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
async function clear() {
    if (globalStorage) {
        await globalStorage.disconnect();
        globalStorage = null;
    }
}
/**
 * Reset storage configuration (useful for testing)
 * @llm-rule WHEN: Testing storage logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function reset(newConfig = {}) {
    // Clear existing instance
    if (globalStorage) {
        globalStorage.disconnect().catch(console.error);
        globalStorage = null;
    }
    // Create new instance with config
    const defaults = getSmartDefaults();
    const config = { ...defaults, ...newConfig };
    globalStorage = new StorageClass(config);
    return globalStorage;
}
/**
 * Get active storage strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Local vs S3 vs R2)
 * @llm-rule AVOID: Using for application logic - storage should be transparent
 */
function getStrategy() {
    const storage = get();
    return storage.getStrategy();
}
/**
 * Get storage configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging storage configuration
 * @llm-rule AVOID: Exposing sensitive connection details - this only shows safe info
 */
function getConfig() {
    const storage = get();
    return storage.getConfig();
}
/**
 * Check if cloud storage is available and configured
 * @llm-rule WHEN: Conditional logic based on storage capabilities
 * @llm-rule AVOID: Complex storage detection - just use storage normally, strategy handles it
 */
function hasCloudStorage() {
    const strategy = getStrategy();
    return strategy === 's3' || strategy === 'r2';
}
/**
 * Check if local storage is being used
 * @llm-rule WHEN: Development vs production feature detection
 * @llm-rule AVOID: Using for business logic - storage should be transparent
 */
function isLocal() {
    return getStrategy() === 'local';
}
/**
 * Validate storage configuration at startup
 * @llm-rule WHEN: App startup to ensure storage is properly configured
 * @llm-rule AVOID: Skipping validation - missing storage config causes runtime failures
 */
function validateConfig() {
    try {
        const strategy = getStrategy();
        if (strategy === 'local' && process.env.NODE_ENV === 'production') {
            console.warn('[Bloomneo AppKit] Using local storage in production. ' +
                'Files will only exist on single server instance. ' +
                'Set AWS_S3_BUCKET or CLOUDFLARE_R2_BUCKET for distributed storage.');
        }
        if (process.env.NODE_ENV === 'production' && !hasCloudStorage()) {
            console.warn('[Bloomneo AppKit] No cloud storage configured in production. ' +
                'Set AWS_S3_BUCKET or CLOUDFLARE_R2_BUCKET for scalable file storage.');
        }
    }
    catch (error) {
        console.error('[Bloomneo AppKit] Storage configuration validation failed:', error.message);
    }
}
/**
 * Get storage statistics for monitoring
 * @llm-rule WHEN: Monitoring storage system health and usage
 * @llm-rule AVOID: Using for business logic - this is for monitoring only
 */
function getStats() {
    const config = getConfig();
    return {
        strategy: config.strategy,
        connected: config.connected,
        maxFileSize: `${Math.round(config.maxFileSize / 1048576)}MB`,
        environment: process.env.NODE_ENV || 'development',
    };
}
/**
 * Graceful shutdown for storage system
 * @llm-rule WHEN: App shutdown or process termination
 * @llm-rule AVOID: Abrupt process exit - graceful shutdown prevents data corruption
 */
async function shutdown() {
    console.log('🔄 [@bloomneo/appkit/storage] Storage graceful shutdown...');
    try {
        await clear();
        console.log('✅ [@bloomneo/appkit/storage] Storage shutdown complete');
    }
    catch (error) {
        console.error('❌ [@bloomneo/appkit/storage] Storage shutdown error:', error.message);
    }
}
/**
 * Upload helper with common patterns
 * @llm-rule WHEN: Quick file uploads with automatic naming and validation
 * @llm-rule AVOID: Manual key generation - this handles common upload patterns
 */
async function upload(file, options) {
    const storage = get();
    // Generate key with folder structure
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const folder = options?.folder ? `${options.folder}/` : '';
    const filename = options?.filename || `file-${timestamp}-${random}`;
    const key = `${folder}${filename}`;
    // Upload file
    const resultKey = await storage.put(key, file, {
        contentType: options?.contentType,
    });
    // Get public URL
    const url = storage.url(resultKey);
    return { key: resultKey, url };
}
/**
 * Download helper with error handling
 * @llm-rule WHEN: Quick file downloads with automatic error handling
 * @llm-rule AVOID: Manual error handling - this provides consistent download experience
 */
async function download(key) {
    const storage = get();
    try {
        const data = await storage.get(key);
        // Try to determine content type from extension
        const ext = key.split('.').pop()?.toLowerCase();
        const contentTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'json': 'application/json',
        };
        return {
            data,
            contentType: ext ? contentTypes[ext] : undefined,
        };
    }
    catch (error) {
        throw new Error(`[@bloomneo/appkit/storage] Failed to download file: ${key}. See: ${DOCS_URL}#common-issues`);
    }
}
/**
 * Single storage export with minimal API (like auth module)
 */
export const storageClass = {
    // Core method (like auth.get())
    get,
    // Utility methods
    clear,
    reset,
    getStrategy,
    getConfig,
    hasCloudStorage,
    isLocal,
    getStats,
    validateConfig,
    shutdown,
    // Helper methods
    upload,
    download,
};
export { StorageClass } from './storage.js';
// Default export
export default StorageClass;
// Auto-setup graceful shutdown handlers
if (typeof process !== 'undefined') {
    // Handle graceful shutdown
    const shutdownHandler = () => {
        shutdown().finally(() => {
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('[@bloomneo/appkit/storage] Uncaught exception during storage operation:', error);
        shutdown().finally(() => {
            process.exit(1);
        });
    });
    process.on('unhandledRejection', (reason) => {
        console.error('[@bloomneo/appkit/storage] Unhandled rejection during storage operation:', reason);
        shutdown().finally(() => {
            process.exit(1);
        });
    });
}
//# sourceMappingURL=index.js.map