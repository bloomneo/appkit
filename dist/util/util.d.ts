/**
 * Core utility class with 12 essential JavaScript functions
 * @module @bloomneo/appkit/util
 * @file src/util/util.ts
 *
 * @llm-rule WHEN: Building apps that need common utility functions (get, chunk, slugify, debounce, etc.)
 * @llm-rule AVOID: Using directly - always get instance via utilClass.get()
 * @llm-rule NOTE: Provides 12 essential utilities: get, isEmpty, slugify, chunk, debounce, pick, unique, clamp, formatBytes, truncate, sleep, uuid
 */
import type { UtilConfig } from './defaults.js';
export interface GetOptions {
    strict?: boolean;
    throwOnMissing?: boolean;
}
export interface ChunkOptions {
    fillIncomplete?: boolean;
    fillValue?: any;
}
export interface TruncateOptions {
    length: number;
    suffix?: string;
    separator?: string;
    preserveWords?: boolean;
}
export interface DebounceOptions {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
}
export interface FormatBytesOptions {
    decimals?: number;
    binary?: boolean;
    unitSeparator?: string;
}
export interface SlugifyOptions {
    replacement?: string;
    lowercase?: boolean;
    strict?: boolean;
    locale?: string;
}
/**
 * Utility class with 12 essential JavaScript functions
 */
export declare class UtilClass {
    config: UtilConfig;
    private memoCache;
    private debounceCache;
    constructor(config: UtilConfig);
    /**
     * Safe property access with dot notation and array indexing
     * @llm-rule WHEN: Accessing nested object properties safely to prevent "Cannot read property of undefined" errors
     * @llm-rule AVOID: Direct property access on potentially undefined objects - always use this for nested access
     * @llm-rule NOTE: Supports array indexing, optional chaining syntax, and type-safe defaults
     */
    get<T = any>(obj: any, path: string, defaultValue?: T, options?: GetOptions): T;
    /**
     * Universal empty check for all JavaScript values
     * @llm-rule WHEN: Validating if any value is truly empty (null, undefined, {}, [], "", whitespace-only strings)
     * @llm-rule AVOID: Manual empty checks like !value - this handles all edge cases properly
     * @llm-rule NOTE: Returns true for null, undefined, {}, [], "", "   ", false for 0 and false
     */
    isEmpty(value: any): boolean;
    /**
     * Convert text to URL-safe slugs
     * @llm-rule WHEN: Creating URLs, filenames, or IDs from user text input
     * @llm-rule AVOID: Manual string replacement - this handles unicode, special characters, and edge cases
     * @llm-rule NOTE: Converts "Hello World! 123" to "hello-world-123", handles accents and special characters
     */
    slugify(text: string, options?: SlugifyOptions): string;
    /**
     * Split array into smaller chunks of specified size
     * @llm-rule WHEN: Processing large arrays in batches, creating pagination, or organizing data into grids
     * @llm-rule AVOID: Manual array slicing - this handles edge cases and provides consistent behavior
     * @llm-rule NOTE: chunk([1,2,3,4,5], 2) returns [[1,2], [3,4], [5]], handles empty arrays safely
     */
    chunk<T>(array: T[], size: number, options?: ChunkOptions): T[][];
    /**
     * Debounce function calls to prevent excessive execution
     * @llm-rule WHEN: Handling user input events (search, resize, scroll) to optimize performance
     * @llm-rule AVOID: Manual setTimeout management - this handles cleanup and edge cases properly
     * @llm-rule NOTE: Delays function execution until after specified wait period, cancels previous calls
     */
    debounce<T extends (...args: any[]) => any>(func: T, wait: number, options?: DebounceOptions): T & {
        cancel: () => void;
        flush: () => any;
    };
    /**
     * Extract specific properties from an object
     * @llm-rule WHEN: Cleaning API responses, extracting specific data, or creating object subsets
     * @llm-rule AVOID: Manual property extraction - this handles nested keys and edge cases
     * @llm-rule NOTE: pick(user, ['id', 'name', 'email']) returns object with only specified properties
     */
    pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
    /**
     * Remove duplicate values from array
     * @llm-rule WHEN: Cleaning arrays with duplicate values, creating unique lists
     * @llm-rule AVOID: Manual duplicate removal - this is optimized and handles all value types
     * @llm-rule NOTE: Uses Set for performance, handles primitives and object references
     */
    unique<T>(array: T[]): T[];
    /**
     * Constrain number within specified bounds
     * @llm-rule WHEN: Validating user input, constraining values for UI controls (volume, opacity, progress)
     * @llm-rule AVOID: Manual min/max checking - this handles edge cases and type conversion
     * @llm-rule NOTE: clamp(150, 0, 100) returns 100, clamp(-10, 0, 100) returns 0
     */
    clamp(value: number, min: number, max: number): number;
    /**
     * Format byte sizes in human-readable format
     * @llm-rule WHEN: Displaying file sizes, memory usage, or data transfer amounts
     * @llm-rule AVOID: Manual byte formatting - this handles all units and edge cases properly
     * @llm-rule NOTE: formatBytes(1024) returns "1 KB", formatBytes(0) returns "0 Bytes"
     */
    formatBytes(bytes: number, options?: FormatBytesOptions): string;
    /**
     * Truncate text with intelligent word boundary detection
     * @llm-rule WHEN: Displaying text previews, card descriptions, or mobile content
     * @llm-rule AVOID: Simple string.slice() - this preserves words and handles edge cases
     * @llm-rule NOTE: truncate("Hello World", 8) returns "Hello...", respects word boundaries
     */
    truncate(text: string, options: TruncateOptions): string;
    /**
     * Promise-based sleep function for async delays
     * @llm-rule WHEN: Adding delays in async functions, rate limiting, or animation timing
     * @llm-rule AVOID: setTimeout in async/await contexts - this provides clean Promise-based delays
     * @llm-rule NOTE: await sleep(1000) pauses execution for 1 second without blocking the event loop
     */
    sleep(ms: number): Promise<void>;
    /**
     * Generate RFC4122 version 4 UUID
     * @llm-rule WHEN: Creating unique identifiers for sessions, temporary keys, or object IDs
     * @llm-rule AVOID: Manual ID generation - this provides cryptographically secure UUIDs
     * @llm-rule NOTE: Returns standard UUID format: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
     */
    uuid(): string;
    /**
     * Parse object path with dot notation and array indexing
     */
    private parsePath;
    /**
     * Setup automatic cache cleanup
     */
    private setupCacheCleanup;
}
//# sourceMappingURL=util.d.ts.map