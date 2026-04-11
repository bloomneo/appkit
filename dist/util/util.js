/**
 * Core utility class with 12 essential JavaScript functions
 * @module @bloomneo/appkit/util
 * @file src/util/util.ts
 *
 * @llm-rule WHEN: Building apps that need common utility functions (get, chunk, slugify, debounce, etc.)
 * @llm-rule AVOID: Using directly - always get instance via utilClass.get()
 * @llm-rule NOTE: Provides 12 essential utilities: get, isEmpty, slugify, chunk, debounce, pick, unique, clamp, formatBytes, truncate, sleep, uuid
 */
import crypto from 'crypto';
import { createUtilityError as createError } from './defaults.js';
/**
 * Utility class with 12 essential JavaScript functions
 */
export class UtilClass {
    config;
    memoCache;
    debounceCache;
    constructor(config) {
        this.config = config;
        this.memoCache = new Map();
        this.debounceCache = new Map();
        // Setup cache cleanup if enabled
        if (config.cache.enabled) {
            this.setupCacheCleanup();
        }
    }
    /**
     * Safe property access with dot notation and array indexing
     * @llm-rule WHEN: Accessing nested object properties safely to prevent "Cannot read property of undefined" errors
     * @llm-rule AVOID: Direct property access on potentially undefined objects - always use this for nested access
     * @llm-rule NOTE: Supports array indexing, optional chaining syntax, and type-safe defaults
     */
    get(obj, path, defaultValue, options = {}) {
        if (!obj || typeof path !== 'string') {
            return defaultValue;
        }
        try {
            // Handle simple property access
            if (!path.includes('.') && !path.includes('[')) {
                const value = obj[path];
                return value !== undefined ? value : defaultValue;
            }
            // Parse complex path with dots and brackets
            const keys = this.parsePath(path);
            let current = obj;
            for (const key of keys) {
                if (current == null) {
                    if (options.throwOnMissing) {
                        throw createError(`Property '${path}' not found`, 'get', { obj, path });
                    }
                    return defaultValue;
                }
                current = current[key];
            }
            return current !== undefined ? current : defaultValue;
        }
        catch (error) {
            if (options.throwOnMissing) {
                throw error;
            }
            return defaultValue;
        }
    }
    /**
     * Universal empty check for all JavaScript values
     * @llm-rule WHEN: Validating if any value is truly empty (null, undefined, {}, [], "", whitespace-only strings)
     * @llm-rule AVOID: Manual empty checks like !value - this handles all edge cases properly
     * @llm-rule NOTE: Returns true for null, undefined, {}, [], "", "   ", false for 0 and false
     */
    isEmpty(value) {
        // null or undefined
        if (value == null)
            return true;
        // Empty string or whitespace-only string
        if (typeof value === 'string') {
            return value.trim().length === 0;
        }
        // Arrays and array-like objects
        if (Array.isArray(value) || typeof value.length === 'number') {
            return value.length === 0;
        }
        // Objects (including Date, RegExp, etc.)
        if (typeof value === 'object') {
            // Handle special objects
            if (value instanceof Date)
                return false;
            if (value instanceof RegExp)
                return false;
            if (value instanceof Set || value instanceof Map) {
                return value.size === 0;
            }
            // Plain objects
            return Object.keys(value).length === 0;
        }
        // Numbers, booleans, functions are not empty
        return false;
    }
    /**
     * Convert text to URL-safe slugs
     * @llm-rule WHEN: Creating URLs, filenames, or IDs from user text input
     * @llm-rule AVOID: Manual string replacement - this handles unicode, special characters, and edge cases
     * @llm-rule NOTE: Converts "Hello World! 123" to "hello-world-123", handles accents and special characters
     */
    slugify(text, options = {}) {
        if (typeof text !== 'string') {
            return '';
        }
        const opts = {
            replacement: options.replacement || this.config.slugify.replacement,
            lowercase: options.lowercase !== false,
            strict: options.strict || this.config.slugify.strict,
            locale: options.locale || this.config.slugify.locale,
        };
        let result = text.toString();
        // Convert to lowercase if requested
        if (opts.lowercase) {
            result = result.toLowerCase();
        }
        // Replace accented characters
        result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Replace special characters and spaces
        if (opts.strict) {
            result = result.replace(/[^a-zA-Z0-9]/g, opts.replacement);
        }
        else {
            result = result
                .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special chars but keep spaces, hyphens, underscores
                .replace(/\s+/g, opts.replacement); // Replace spaces with replacement
        }
        // Clean up multiple replacements and trim
        result = result
            .replace(new RegExp(`\\${opts.replacement}+`, 'g'), opts.replacement)
            .replace(new RegExp(`^\\${opts.replacement}+|\\${opts.replacement}+$`, 'g'), '');
        return result;
    }
    /**
     * Split array into smaller chunks of specified size
     * @llm-rule WHEN: Processing large arrays in batches, creating pagination, or organizing data into grids
     * @llm-rule AVOID: Manual array slicing - this handles edge cases and provides consistent behavior
     * @llm-rule NOTE: chunk([1,2,3,4,5], 2) returns [[1,2], [3,4], [5]], handles empty arrays safely
     */
    chunk(array, size, options = {}) {
        if (!Array.isArray(array)) {
            return [];
        }
        if (size <= 0) {
            throw createError('Chunk size must be positive', 'chunk', { array, size });
        }
        if (array.length === 0) {
            return [];
        }
        // Performance warning for large arrays
        if (this.config.performance.enabled && array.length > this.config.performance.chunkSizeLimit) {
            console.warn(`[Bloomneo Utils] Chunking large array (${array.length} items). Consider streaming or pagination.`);
        }
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            const chunk = array.slice(i, i + size);
            // Fill incomplete chunks if requested
            if (options.fillIncomplete && chunk.length < size && i + size >= array.length) {
                const fillValue = options.fillValue;
                while (chunk.length < size) {
                    chunk.push(fillValue);
                }
            }
            result.push(chunk);
        }
        return result;
    }
    /**
     * Debounce function calls to prevent excessive execution
     * @llm-rule WHEN: Handling user input events (search, resize, scroll) to optimize performance
     * @llm-rule AVOID: Manual setTimeout management - this handles cleanup and edge cases properly
     * @llm-rule NOTE: Delays function execution until after specified wait period, cancels previous calls
     */
    debounce(func, wait, options = {}) {
        if (typeof func !== 'function') {
            throw createError('Debounce target must be a function', 'debounce', func);
        }
        if (wait < 0) {
            throw createError('Debounce wait time must be non-negative', 'debounce', wait);
        }
        const cacheKey = func.toString() + wait + JSON.stringify(options);
        let timeoutId = null;
        let lastArgs = [];
        let lastThis;
        let result;
        const invokeFunc = () => {
            result = func.apply(lastThis, lastArgs);
            timeoutId = null;
            return result;
        };
        const leadingEdge = () => {
            if (options.leading) {
                result = invokeFunc();
            }
            timeoutId = setTimeout(trailingEdge, wait);
            return result;
        };
        const trailingEdge = () => {
            timeoutId = null;
            if (options.trailing !== false) {
                result = invokeFunc();
            }
            return result;
        };
        const debounced = function (...args) {
            lastArgs = args;
            lastThis = this;
            if (timeoutId === null) {
                return leadingEdge();
            }
            else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(trailingEdge, wait);
            }
            return result;
        };
        debounced.cancel = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        debounced.flush = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                return trailingEdge();
            }
            return result;
        };
        return debounced;
    }
    /**
     * Extract specific properties from an object
     * @llm-rule WHEN: Cleaning API responses, extracting specific data, or creating object subsets
     * @llm-rule AVOID: Manual property extraction - this handles nested keys and edge cases
     * @llm-rule NOTE: pick(user, ['id', 'name', 'email']) returns object with only specified properties
     */
    pick(obj, keys) {
        if (!obj || typeof obj !== 'object') {
            return {};
        }
        if (!Array.isArray(keys)) {
            throw createError('Keys must be an array', 'pick', { obj, keys });
        }
        const result = {};
        for (const key of keys) {
            if (key in obj) {
                result[key] = obj[key];
            }
        }
        return result;
    }
    /**
     * Remove duplicate values from array
     * @llm-rule WHEN: Cleaning arrays with duplicate values, creating unique lists
     * @llm-rule AVOID: Manual duplicate removal - this is optimized and handles all value types
     * @llm-rule NOTE: Uses Set for performance, handles primitives and object references
     */
    unique(array) {
        if (!Array.isArray(array)) {
            return [];
        }
        if (array.length === 0) {
            return [];
        }
        // Use Set for performance with primitive values
        if (array.length < 1000 || array.every(item => typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            item === null ||
            item === undefined)) {
            return Array.from(new Set(array));
        }
        // Fallback for complex objects
        const seen = new Map();
        const result = [];
        for (const item of array) {
            const key = typeof item === 'object' && item !== null
                ? JSON.stringify(item)
                : item;
            if (!seen.has(key)) {
                seen.set(key, true);
                result.push(item);
            }
        }
        return result;
    }
    /**
     * Constrain number within specified bounds
     * @llm-rule WHEN: Validating user input, constraining values for UI controls (volume, opacity, progress)
     * @llm-rule AVOID: Manual min/max checking - this handles edge cases and type conversion
     * @llm-rule NOTE: clamp(150, 0, 100) returns 100, clamp(-10, 0, 100) returns 0
     */
    clamp(value, min, max) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw createError('Value must be a valid number', 'clamp', { value, min, max });
        }
        if (typeof min !== 'number' || typeof max !== 'number') {
            throw createError('Min and max must be valid numbers', 'clamp', { value, min, max });
        }
        if (min > max) {
            throw createError('Min value cannot be greater than max value', 'clamp', { value, min, max });
        }
        return Math.min(Math.max(value, min), max);
    }
    /**
     * Format byte sizes in human-readable format
     * @llm-rule WHEN: Displaying file sizes, memory usage, or data transfer amounts
     * @llm-rule AVOID: Manual byte formatting - this handles all units and edge cases properly
     * @llm-rule NOTE: formatBytes(1024) returns "1 KB", formatBytes(0) returns "0 Bytes"
     */
    formatBytes(bytes, options = {}) {
        if (typeof bytes !== 'number' || isNaN(bytes)) {
            return '0 Bytes';
        }
        if (bytes === 0) {
            return '0 Bytes';
        }
        const decimals = options.decimals !== undefined ? options.decimals : 2;
        const binary = options.binary !== false; // Default to binary (1024)
        const unitSeparator = options.unitSeparator || ' ';
        const base = binary ? 1024 : 1000;
        const units = binary
            ? ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const absBytes = Math.abs(bytes);
        const unitIndex = Math.floor(Math.log(absBytes) / Math.log(base));
        const clampedIndex = Math.min(unitIndex, units.length - 1);
        const value = bytes / Math.pow(base, clampedIndex);
        const formattedValue = clampedIndex === 0
            ? value.toString()
            : value.toFixed(decimals);
        return `${formattedValue}${unitSeparator}${units[clampedIndex]}`;
    }
    /**
     * Truncate text with intelligent word boundary detection
     * @llm-rule WHEN: Displaying text previews, card descriptions, or mobile content
     * @llm-rule AVOID: Simple string.slice() - this preserves words and handles edge cases
     * @llm-rule NOTE: truncate("Hello World", 8) returns "Hello...", respects word boundaries
     */
    truncate(text, options) {
        if (typeof text !== 'string') {
            return '';
        }
        const { length, suffix = '...', separator, preserveWords = true } = options;
        if (length <= 0) {
            return '';
        }
        if (text.length <= length) {
            return text;
        }
        let truncated = text.slice(0, length - suffix.length);
        // Preserve word boundaries
        if (preserveWords && truncated.length > 0) {
            const lastSpace = truncated.lastIndexOf(' ');
            if (lastSpace > length * 0.5) { // Only if we don't lose too much content
                truncated = truncated.slice(0, lastSpace);
            }
        }
        // Handle custom separator
        if (separator) {
            const lastSeparator = truncated.lastIndexOf(separator);
            if (lastSeparator > 0) {
                truncated = truncated.slice(0, lastSeparator);
            }
        }
        return truncated + suffix;
    }
    /**
     * Promise-based sleep function for async delays
     * @llm-rule WHEN: Adding delays in async functions, rate limiting, or animation timing
     * @llm-rule AVOID: setTimeout in async/await contexts - this provides clean Promise-based delays
     * @llm-rule NOTE: await sleep(1000) pauses execution for 1 second without blocking the event loop
     */
    sleep(ms) {
        if (typeof ms !== 'number' || ms < 0 || isNaN(ms)) {
            throw createError('Sleep duration must be a non-negative number', 'sleep', ms);
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Generate RFC4122 version 4 UUID
     * @llm-rule WHEN: Creating unique identifiers for sessions, temporary keys, or object IDs
     * @llm-rule AVOID: Manual ID generation - this provides cryptographically secure UUIDs
     * @llm-rule NOTE: Returns standard UUID format: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
     */
    uuid() {
        try {
            // Use crypto.randomUUID if available (Node.js 14.17.0+, modern browsers)
            if (typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            // Fallback implementation
            const bytes = crypto.randomBytes(16);
            // Set version (4) and variant bits
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = bytes.toString('hex');
            return [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20, 32)
            ].join('-');
        }
        catch (error) {
            throw createError('Failed to generate UUID', 'uuid', error);
        }
    }
    // Private helper methods
    /**
     * Parse object path with dot notation and array indexing
     */
    parsePath(path) {
        const keys = [];
        let current = '';
        let inBrackets = false;
        for (let i = 0; i < path.length; i++) {
            const char = path[i];
            if (char === '[') {
                if (current) {
                    keys.push(current);
                    current = '';
                }
                inBrackets = true;
            }
            else if (char === ']') {
                if (inBrackets && current) {
                    // Try to parse as number for array index
                    const num = parseInt(current, 10);
                    keys.push(isNaN(num) ? current : num);
                    current = '';
                }
                inBrackets = false;
            }
            else if (char === '.' && !inBrackets) {
                if (current) {
                    keys.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }
        if (current) {
            keys.push(current);
        }
        return keys;
    }
    /**
     * Setup automatic cache cleanup
     */
    setupCacheCleanup() {
        if (!this.config.cache.enabled)
            return;
        const cleanupInterval = Math.min(this.config.cache.ttl, 60000); // Max 1 minute
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.memoCache.entries()) {
                if (now - entry.timestamp > this.config.cache.ttl) {
                    this.memoCache.delete(key);
                }
            }
            // Enforce max size
            if (this.memoCache.size > this.config.cache.maxSize) {
                const entries = Array.from(this.memoCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                const toDelete = entries.slice(0, this.memoCache.size - this.config.cache.maxSize);
                for (const [key] of toDelete) {
                    this.memoCache.delete(key);
                }
            }
        }, cleanupInterval).unref?.();
    }
}
//# sourceMappingURL=util.js.map