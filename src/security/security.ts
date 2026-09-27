/**
 * Core security class with rate limiting and encryption
 * @module @bloomneo/appkit/security
 * @file src/security/security.ts
 * 
 * @llm-rule WHEN: Building apps that need rate limiting or AES-256-GCM encryption
 * @llm-rule AVOID: Using directly - always get instance via securityClass.get()
 * @llm-rule NOTE: Provides rate limiting and AES-256-GCM encryption
 */

import crypto from 'crypto';
import type { SecurityConfig, SecurityError } from './defaults.js';
import { createSecurityError } from './defaults.js';

// Extended crypto interfaces for GCM mode
interface CipherGCM extends crypto.Cipher {
  setAAD(buffer: Buffer): this;
  getAuthTag(): Buffer;
}

interface DecipherGCM extends crypto.Decipher {
  setAAD(buffer: Buffer): this;
  setAuthTag(buffer: Buffer): this;
}

export interface ExpressRequest {
  method: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  query?: any;
  ip?: string;
  connection?: { remoteAddress?: string };
  [key: string]: any;
}

export interface ExpressResponse {
  setHeader?: (name: string, value: string | number) => void;
  [key: string]: any;
}

export interface ExpressNextFunction {
  (error?: any): void;
}

export type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => void;

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  message?: string;
  keyGenerator?: (req: ExpressRequest) => string;
  /**
   * Bucket name for this limiter. Each `requests()` call counts separately;
   * limiters that share a name share a count (e.g. one login budget across
   * two routes). Defaults to a name unique to the call.
   */
  name?: string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Security class with enterprise-grade protection functionality
 */
export class SecurityClass {
  public config: SecurityConfig;
  private requestStore: Map<string, RateLimitRecord>;
  private cleanupInitialized: boolean;
  private limiterCount = 0;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.requestStore = new Map();
    this.cleanupInitialized = false;
  }

  /**
   * Creates rate limiting middleware with configurable limits and windows
   * @llm-rule WHEN: Protecting endpoints from abuse and brute force attacks
   * @llm-rule AVOID: Using same limits for all endpoints - auth should have stricter limits than API
   * @llm-rule NOTE: Uses in-memory storage with automatic cleanup, sets standard rate limit headers
   */
  requests(maxRequests?: number, windowMs?: number, options: RateLimitOptions = {}): ExpressMiddleware {
    // Handle argument polymorphism
    if (typeof maxRequests === 'object') {
      options = maxRequests;
      maxRequests = options.maxRequests;
      windowMs = options.windowMs;
    } else if (typeof windowMs === 'object') {
      options = windowMs;
      windowMs = options.windowMs;
    }

    // Use provided values or config defaults
    const max = maxRequests || this.config.rateLimit.maxRequests;
    const window = windowMs || this.config.rateLimit.windowMs;
    const message = options.message || this.config.rateLimit.message;
    const keyGenerator = options.keyGenerator || this.getClientKey;
    // One store serves every limiter, so each needs its own key space.
    // Without it a 5-per-15-minutes login limiter and a 100-per-minute API
    // limiter counted the same IP together: ordinary API traffic locked the
    // user out of login.
    const bucket = options.name || `limiter-${++this.limiterCount}`;

    // Validate configuration
    if (max < 0 || window <= 0) {
      throw createSecurityError('Invalid rate limit configuration', 500);
    }

    // Initialize cleanup for memory management
    this.initializeCleanup(window);

    return (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): void => {
      const key = `${bucket}:${keyGenerator(req)}`;
      const now = Date.now();

      // Get or create rate limit record
      let record = this.requestStore.get(key);
      if (!record) {
        record = { count: 0, resetTime: now + window };
        this.requestStore.set(key, record);
      } else if (now > record.resetTime) {
        // Reset if window has passed
        record.count = 0;
        record.resetTime = now + window;
      }

      // Increment request count
      record.count++;

      // Set rate limit headers
      if (res.setHeader) {
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      }

      // Check if limit exceeded
      if (record.count > max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);

        if (res.setHeader) {
          res.setHeader('Retry-After', retryAfter);
        }

        const error = createSecurityError(message, 429, {
          retryAfter,
          limit: max,
          remaining: 0,
          resetTime: record.resetTime,
        });

        return next(error);
      }

      next();
    };
  }

  /**
   * Encrypts sensitive data using AES-256-GCM with authentication
   * @llm-rule WHEN: Storing sensitive data like SSNs, credit cards, personal info
   * @llm-rule AVOID: Storing sensitive data in plain text - always encrypt before database storage
   * @llm-rule NOTE: Uses random IV per encryption, includes authentication tag to prevent tampering
   */
  encrypt(data: string | Buffer, key?: string | Buffer, associatedData?: Buffer): string {
    if (!data) {
      throw createSecurityError('Data to encrypt cannot be empty');
    }

    const encryptionKey = key || this.config.encryption.key;

    if (!encryptionKey) {
      throw createSecurityError(
        'Encryption key required. Provide as argument or set BLOOM_SECURITY_ENCRYPTION_KEY environment variable',
        500
      );
    }

    this.validateEncryptionKey(encryptionKey);

    const keyBuffer = typeof encryptionKey === 'string' 
      ? Buffer.from(encryptionKey, 'hex')
      : encryptionKey;

    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.config.encryption.ivLength);
      const cipher = crypto.createCipheriv(this.config.encryption.algorithm, keyBuffer, iv) as CipherGCM;

      // Set AAD if provided
      if (associatedData) {
        if (!Buffer.isBuffer(associatedData)) {
          throw createSecurityError('Associated data must be a Buffer');
        }
        cipher.setAAD(associatedData);
      }

      // Encrypt data
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV, ciphertext, and auth tag
      return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
    } catch (error) {
      throw createSecurityError(`Encryption failed: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Decrypts previously encrypted data with authentication verification
   * @llm-rule WHEN: Retrieving sensitive data that was encrypted with encrypt() method
   * @llm-rule AVOID: Using with data not encrypted by this module - will fail authentication
   * @llm-rule NOTE: Automatically verifies authentication tag to detect tampering
   */
  decrypt(encryptedData: string, key?: string | Buffer, associatedData?: Buffer): string {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw createSecurityError('Encrypted data must be a non-empty string');
    }

    const decryptionKey = key || this.config.encryption.key;

    if (!decryptionKey) {
      throw createSecurityError(
        'Decryption key required. Provide as argument or set BLOOM_SECURITY_ENCRYPTION_KEY environment variable',
        500
      );
    }

    this.validateEncryptionKey(decryptionKey);

    const keyBuffer = typeof decryptionKey === 'string'
      ? Buffer.from(decryptionKey, 'hex')
      : decryptionKey;

    // Parse encrypted data format
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw createSecurityError(
        'Invalid encrypted data format. Expected IV:ciphertext:authTag'
      );
    }

    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');

      // Validate component lengths
      if (iv.length !== this.config.encryption.ivLength || 
          authTag.length !== this.config.encryption.tagLength) {
        throw createSecurityError('Invalid IV or authentication tag length');
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.config.encryption.algorithm, keyBuffer, iv) as DecipherGCM;

      // Set AAD if provided
      if (associatedData) {
        if (!Buffer.isBuffer(associatedData)) {
          throw createSecurityError('Associated data must be a Buffer');
        }
        decipher.setAAD(associatedData);
      }

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error: any) {
      if (error.code === 'EBADTAG') {
        throw createSecurityError(
          'Authentication failed: Data may be tampered with or incorrect key/AAD provided',
          401
        );
      }
      throw createSecurityError(`Decryption failed: ${error.message}`, 500);
    }
  }

  /**
   * Generates a cryptographically secure 256-bit encryption key
   * @llm-rule WHEN: Setting up encryption for the first time or rotating keys
   * @llm-rule AVOID: Using weak or predictable keys - always use this method for key generation
   * @llm-rule NOTE: Returns 64-character hex string suitable for BLOOM_SECURITY_ENCRYPTION_KEY
   */
  generateKey(): string {
    try {
      return crypto.randomBytes(this.config.encryption.keyLength).toString('hex');
    } catch (error) {
      throw createSecurityError(`Key generation failed: ${(error as Error).message}`, 500);
    }
  }

  // Private helper methods

  /**
   * Gets unique identifier for the client
   */
  private getClientKey = (req: ExpressRequest): string => {
    return req.ip ||
           req.connection?.remoteAddress ||
           (req.headers && (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ||
           'unknown';
  };

  /**
   * Initializes cleanup interval for memory management
   */
  private initializeCleanup(windowMs: number): void {
    if (this.cleanupInitialized) return;

    const cleanupInterval = Math.min(windowMs, 60 * 1000);

    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.requestStore.entries()) {
        if (now > record.resetTime) {
          this.requestStore.delete(key);
        }
      }
    }, cleanupInterval).unref();

    this.cleanupInitialized = true;
  }

  /**
   * Validates encryption key format and length
   */
  private validateEncryptionKey(key: string | Buffer): void {
    if (!key) {
      throw createSecurityError('Encryption key is required', 500);
    }

    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;

    if (keyBuffer.length !== this.config.encryption.keyLength) {
      throw createSecurityError(
        `Invalid key length. Expected ${this.config.encryption.keyLength} bytes, got ${keyBuffer.length} bytes`,
        500
      );
    }
  }
}