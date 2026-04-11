/**
 * Core security class with CSRF, rate limiting, sanitization, and encryption
 * @module @bloomneo/appkit/security
 * @file src/security/security.ts
 *
 * @llm-rule WHEN: Building apps that need security protection (CSRF, rate limiting, input sanitization, encryption)
 * @llm-rule AVOID: Using directly - always get instance via securityClass.get()
 * @llm-rule NOTE: Provides enterprise-grade security with CSRF tokens, rate limiting, XSS prevention, and AES-256-GCM encryption
 */
import type { SecurityConfig } from './defaults.js';
export interface ExpressRequest {
    method: string;
    session?: any;
    body?: any;
    headers?: Record<string, string | string[] | undefined>;
    query?: any;
    ip?: string;
    connection?: {
        remoteAddress?: string;
    };
    csrfToken?: () => string;
    [key: string]: any;
}
export interface ExpressResponse {
    setHeader?: (name: string, value: string | number) => void;
    [key: string]: any;
}
export interface ExpressNextFunction {
    (error?: any): void;
}
export type ExpressMiddleware = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void;
export interface CSRFOptions {
    secret?: string;
    tokenField?: string;
    headerField?: string;
    expiryMinutes?: number;
}
export interface RateLimitOptions {
    maxRequests?: number;
    windowMs?: number;
    message?: string;
    keyGenerator?: (req: ExpressRequest) => string;
}
export interface InputOptions {
    maxLength?: number;
    trim?: boolean;
    removeXSS?: boolean;
}
export interface HTMLOptions {
    allowedTags?: string[];
    stripAllTags?: boolean;
}
/**
 * Security class with enterprise-grade protection functionality
 */
export declare class SecurityClass {
    config: SecurityConfig;
    private requestStore;
    private cleanupInitialized;
    constructor(config: SecurityConfig);
    /**
     * Creates CSRF protection middleware for forms and AJAX requests
     * @llm-rule WHEN: Protecting forms and state-changing requests from CSRF attacks
     * @llm-rule AVOID: Using without session middleware - CSRF requires sessions for token storage
     * @llm-rule NOTE: Automatically validates tokens on POST/PUT/DELETE/PATCH requests, adds req.csrfToken() method
     */
    forms(options?: CSRFOptions): ExpressMiddleware;
    /**
     * Creates rate limiting middleware with configurable limits and windows
     * @llm-rule WHEN: Protecting endpoints from abuse and brute force attacks
     * @llm-rule AVOID: Using same limits for all endpoints - auth should have stricter limits than API
     * @llm-rule NOTE: Uses in-memory storage with automatic cleanup, sets standard rate limit headers
     */
    requests(maxRequests?: number, windowMs?: number, options?: RateLimitOptions): ExpressMiddleware;
    /**
     * Cleans text input with XSS prevention and length limiting
     * @llm-rule WHEN: Processing any user text input before storage or display
     * @llm-rule AVOID: Storing raw user input - always clean to prevent XSS attacks
     * @llm-rule NOTE: Removes dangerous patterns like <script>, javascript:, event handlers
     */
    input(text: any, options?: InputOptions): string;
    /**
     * Cleans HTML content allowing only specified safe tags
     * @llm-rule WHEN: Processing user HTML content like rich text editor input
     * @llm-rule AVOID: Allowing all HTML tags - only whitelist safe formatting tags
     * @llm-rule NOTE: Removes script, iframe, object tags and dangerous attributes like onclick
     */
    html(html: any, options?: HTMLOptions): string;
    /**
     * Escapes HTML special characters for safe display in HTML content
     * @llm-rule WHEN: Displaying user text content in HTML without allowing any HTML tags
     * @llm-rule AVOID: Direct interpolation of user content in HTML - always escape first
     * @llm-rule NOTE: Converts &, <, >, quotes to HTML entities for safe display
     */
    escape(text: any): string;
    /**
     * Encrypts sensitive data using AES-256-GCM with authentication
     * @llm-rule WHEN: Storing sensitive data like SSNs, credit cards, personal info
     * @llm-rule AVOID: Storing sensitive data in plain text - always encrypt before database storage
     * @llm-rule NOTE: Uses random IV per encryption, includes authentication tag to prevent tampering
     */
    encrypt(data: string | Buffer, key?: string | Buffer, associatedData?: Buffer): string;
    /**
     * Decrypts previously encrypted data with authentication verification
     * @llm-rule WHEN: Retrieving sensitive data that was encrypted with encrypt() method
     * @llm-rule AVOID: Using with data not encrypted by this module - will fail authentication
     * @llm-rule NOTE: Automatically verifies authentication tag to detect tampering
     */
    decrypt(encryptedData: string, key?: string | Buffer, associatedData?: Buffer): string;
    /**
     * Generates a cryptographically secure 256-bit encryption key
     * @llm-rule WHEN: Setting up encryption for the first time or rotating keys
     * @llm-rule AVOID: Using weak or predictable keys - always use this method for key generation
     * @llm-rule NOTE: Returns 64-character hex string suitable for VOILA_SECURITY_ENCRYPTION_KEY
     */
    generateKey(): string;
    /**
     * Generates a cryptographically secure CSRF token
     */
    private generateCSRFToken;
    /**
     * Verifies CSRF token using timing-safe comparison
     */
    private verifyCSRFToken;
    /**
     * Gets unique identifier for the client
     */
    private getClientKey;
    /**
     * Initializes cleanup interval for memory management
     */
    private initializeCleanup;
    /**
     * Validates encryption key format and length
     */
    private validateEncryptionKey;
}
//# sourceMappingURL=security.d.ts.map