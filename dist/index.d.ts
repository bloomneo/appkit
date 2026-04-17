/**
 * @bloomneo/appkit - Ultra-minimal, tree-shakable Node.js application toolkit
 *
 * This file provides direct access to individual module entry points for optimal tree-shaking.
 * Import only what you need - unused code will be automatically eliminated by modern bundlers.
 *
 * @module @bloomneo/appkit
 * @file src/index.ts
 *
 * @example
 * // ✅ Perfect tree-shaking - only specific modules bundled
 * import { authClass } from '@bloomneo/appkit/auth';
 * import { databaseClass } from '@bloomneo/appkit/database';
 *
 * // ✅ Also tree-shakable - but imports main index
 * import { authClass, databaseClass } from '@bloomneo/appkit';
 *
 * // ❌ Avoid - imports everything
 * import * as appkit from '@bloomneo/appkit';
 */
/**
 * Library name
 * @type {string}
 */
export declare const NAME = "@bloomneo/appkit";
/**
 * Supported Node.js version
 * @type {string}
 */
export declare const NODE_VERSION = ">=18.0.0";
/**
 * Re-export main entry functions for convenience (tree-shakable)
 * Each import only loads the specific module needed
 *
 * Pattern: {folderName}Class.get() → creates {folderName} instance
 */
export { authClass } from './auth/index.js';
export { configClass } from './config/index.js';
export { securityClass } from './security/index.js';
export { databaseClass } from './database/index.js';
export { cacheClass } from './cache/index.js';
export { emailClass } from './email/index.js';
export { eventClass } from './event/index.js';
export { errorClass } from './error/index.js';
export { loggerClass } from './logger/index.js';
export { queueClass } from './queue/index.js';
export { storageClass } from './storage/index.js';
export { utilClass } from './util/index.js';
export { AppKitError } from './util/errors.js';
export { TokenError } from './auth/auth.js';
export { CacheError } from './cache/cache.js';
export { AppError } from './error/error.js';
export { SecurityError } from './security/defaults.js';
export { DatabaseError } from './database/index.js';
export { EmailError } from './email/index.js';
export { EventError } from './event/index.js';
export { QueueError } from './queue/index.js';
export { LoggerError } from './logger/index.js';
export { StorageError } from './storage/index.js';
/**
 * Quick health check for the library
 * @returns {Object} Basic library information
 */
export declare function getLibraryInfo(): {
    name: string;
    nodeVersion: string;
    timestamp: string;
};
//# sourceMappingURL=index.d.ts.map