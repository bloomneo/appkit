/**
 * Ultra-simple semantic error handling that just works
 * @module @bloomneo/appkit/error
 * @file src/error/index.ts
 * 
 * @llm-rule WHEN: Building apps that need semantic HTTP error handling
 * @llm-rule AVOID: Complex error setups with multiple libraries - this handles everything in one API
 * @llm-rule NOTE: Provides semantic error creation (badRequest, unauthorized) and Express middleware
 * @llm-rule NOTE: Common pattern - errorClass.get() → throw error.badRequest() → app.use(error.handleErrors())
 * @llm-rule NOTE: COMPLETE SETUP: const error = errorClass.get(); app.use(error.handleErrors()); // Done!
 */

import { ErrorClass, AppError } from './error.js';
import { getSmartDefaults, type ErrorConfig } from './defaults.js';

// Re-export the AppError class (value export — AppError is a class as of 4.0.0).
export { AppError };

export interface ExpressRequest {
  [key: string]: any;
}

export interface ExpressResponse {
  status: (code: number) => ExpressResponse;
  json: (data: any) => void;
}

export interface ExpressNextFunction {
  (error?: any): void;
}

export type ExpressErrorHandler = (
  error: AppError,
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => void;

export type AsyncRouteHandler = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => Promise<any>;

export interface ErrorHandlerOptions {
  showStack?: boolean;
  logErrors?: boolean;
}

// Global error instance for performance
let globalError: ErrorClass | null = null;

/**
 * Get error instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any error operation - this is your main entry point
 * @llm-rule AVOID: Calling new ErrorClass() directly - always use this function
 * @llm-rule NOTE: USAGE FLOW: get() → create errors → setup middleware → done
 * @llm-rule NOTE: TYPICAL SETUP: const error = errorClass.get(); app.use(error.handleErrors());
 */
function get(overrides: Partial<ErrorConfig> = {}): ErrorClass {
  // Lazy initialization - parse environment once
  if (!globalError) {
    const defaults = getSmartDefaults();
    const config: ErrorConfig = { ...defaults, ...overrides };
    globalError = new ErrorClass(config);
  }

  return globalError;
}

/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing error logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 * @llm-rule NOTE: TEST PATTERN: const error = errorClass.reset({showStack: false}); // Clean slate
 */
function reset(newConfig: Partial<ErrorConfig> = {}): ErrorClass {
  const defaults = getSmartDefaults();
  const config: ErrorConfig = { ...defaults, ...newConfig };
  globalError = new ErrorClass(config);
  return globalError;
}

/**
 * Clear global instance cache (for testing)
 * @llm-rule WHEN: Testing error configurations or between test suites
 * @llm-rule AVOID: Using in production - only for tests
 */
function clearCache(): void {
  globalError = null;
}

/**
 * Single error export with semantic methods and Express integration
 * @llm-rule NOTE: TWO USAGE PATTERNS: errorClass.get().badRequest() OR errorClass.badRequest() (shortcuts)
 * @llm-rule NOTE: MIDDLEWARE PATTERN: app.use(error.handleErrors()); // Global error handling
 */
export const errorClass = {
  // Core method
  get,
  
  // Utility methods
  reset,
  clearCache,
  
  // Error creation shortcuts - automatically call get()
  /**
   * Creates 400 Bad Request error
   * @llm-rule WHEN: Client input validation failures (missing/invalid data)
   * @llm-rule NOTE: EXAMPLES: missing email, invalid JSON, malformed request
   * @llm-rule NOTE: PATTERN: if (!email) throw error.badRequest('Email required');
   */
  badRequest: (message?: string) => get().badRequest(message),
  
  /**
   * Creates 401 Unauthorized error  
   * @llm-rule WHEN: Authentication required but missing or invalid
   * @llm-rule NOTE: EXAMPLES: missing token, expired session, invalid credentials
   * @llm-rule NOTE: PATTERN: if (!token) throw error.unauthorized('Login required');
   */
  unauthorized: (message?: string) => get().unauthorized(message),
  
  /**
   * Creates 403 Forbidden error
   * @llm-rule WHEN: User authenticated but lacks permission for action
   * @llm-rule NOTE: EXAMPLES: insufficient role, admin-only endpoint, blocked user
   * @llm-rule NOTE: PATTERN: if (!user.isAdmin) throw error.forbidden('Admin only');
   */
  forbidden: (message?: string) => get().forbidden(message),
  
  /**
   * Creates 404 Not Found error
   * @llm-rule WHEN: Requested resource does not exist in database/system
   * @llm-rule NOTE: EXAMPLES: user not found, post not found, file missing
   * @llm-rule NOTE: PATTERN: if (!user) throw error.notFound('User not found');
   */
  notFound: (message?: string) => get().notFound(message),
  
  /**
   * Creates 409 Conflict error
   * @llm-rule WHEN: Business logic conflicts or duplicate resources
   * @llm-rule NOTE: EXAMPLES: email already exists, username taken, state conflicts
   * @llm-rule NOTE: PATTERN: if (existingUser) throw error.conflict('Email exists');
   */
  conflict: (message?: string) => get().conflict(message),
  
  /**
   * Creates 500 Server Error
   * @llm-rule WHEN: Internal failures like database/API errors
   * @llm-rule NOTE: EXAMPLES: database down, external API timeout, file system errors
   * @llm-rule NOTE: PATTERN: catch (dbError) { throw error.serverError('DB unavailable'); }
   */
  serverError: (message?: string) => get().serverError(message),
  
  /**
   * Creates 429 Too Many Requests error
   * @llm-rule WHEN: Client exceeded rate limit
   * @llm-rule NOTE: PATTERN: if (rateExceeded) throw error.tooMany('Slow down');
   */
  tooMany: (message?: string) => get().tooMany(message),

  /**
   * Creates 500 Internal Server Error (alias for serverError)
   * @llm-rule WHEN: Unexpected internal failures
   * @llm-rule NOTE: Identical to serverError() — use either, not both in the same codebase
   */
  internal: (message?: string) => get().internal(message),

  /**
   * Creates custom error with any status code
   * @llm-rule WHEN: Need non-standard HTTP status codes not covered above
   * @llm-rule NOTE: PATTERN: error.createError(503, 'Maintenance mode', 'MAINTENANCE');
   */
  createError: (statusCode: number, message: string, type?: string) => get().createError(statusCode, message, type),

  // Middleware and utility shortcuts
  /**
   * Express error handling middleware - handles all thrown errors
   * @llm-rule WHEN: Setting up Express app - use as LAST middleware
   * @llm-rule AVOID: Multiple error handlers - this should be the final one
   * @llm-rule NOTE: EXPRESS SETUP: app.use(error.handleErrors()); // Must be last!
   * @llm-rule NOTE: AUTO-FEATURES: dev vs prod responses, stack hiding, error logging
   */
  handleErrors: (options?: ErrorHandlerOptions) => get().handleErrors(options),
  
  /**
   * Async route wrapper - automatically catches thrown errors
   * @llm-rule WHEN: Creating async Express routes that might throw errors
   * @llm-rule AVOID: Manual try/catch in routes - this handles it automatically
   * @llm-rule NOTE: ASYNC PATTERN: app.post('/api', error.asyncRoute(async (req, res) => {...}));
   * @llm-rule NOTE: ERROR FLOW: throw error → asyncRoute catches → handleErrors processes
   */
  asyncRoute: (fn: AsyncRouteHandler) => get().asyncRoute(fn),
  
  /**
   * Checks if error is 4xx client error
   * @llm-rule WHEN: Categorizing errors for logging/metrics
   * @llm-rule NOTE: CLIENT ERRORS: 400-499 (user's fault)
   */
  isClientError: (err: AppError) => get().isClientError(err),
  
  /**
   * Checks if error is 5xx server error
   * @llm-rule WHEN: Categorizing errors for monitoring/alerting
   * @llm-rule NOTE: SERVER ERRORS: 500-599 (server's fault)
   */
  isServerError: (err: AppError) => get().isServerError(err),
} as const;

// Re-export types for consumers
export type { ErrorConfig } from './defaults.js';
export { ErrorClass } from './error.js';

// Default export
export default errorClass;