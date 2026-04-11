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
export const NAME = '@bloomneo/appkit';
/**
 * Supported Node.js version
 * @type {string}
 */
export const NODE_VERSION = '>=18.0.0';
/**
 * Re-export main entry functions for convenience (tree-shakable)
 * Each import only loads the specific module needed
 *
 * Pattern: {folderName}Class.get() → creates {folderName} instance
 */
// Authentication
export { authClass } from './auth/index.js';
// Configuration
export { configClass } from './config/index.js';
// Security
export { securityClass } from './security/index.js';
// Database
export { databaseClass } from './database/index.js';
// Caching
export { cacheClass } from './cache/index.js';
// Email
export { emailClass } from './email/index.js';
// Events
export { eventClass } from './event/index.js';
// Error handling
export { errorClass } from './error/index.js';
// Logging
export { loggerClass } from './logger/index.js';
// Queuing
export { queueClass } from './queue/index.js';
// Storage
export { storageClass } from './storage/index.js';
// Utilities
export { utilClass } from './util/index.js';
/**
 * Quick health check for the library
 * @returns {Object} Basic library information
 */
export function getLibraryInfo() {
    return {
        name: NAME,
        nodeVersion: NODE_VERSION,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=index.js.map