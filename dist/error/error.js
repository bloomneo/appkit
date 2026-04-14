/**
 * Core error class with semantic HTTP status codes and middleware
 * @module @bloomneo/appkit/error
 * @file src/error/error.ts
 *
 * @llm-rule WHEN: Building apps that need semantic HTTP error handling
 * @llm-rule AVOID: Using directly - always get instance via errorClass.get()
 * @llm-rule NOTE: Provides semantic error creation (badRequest, unauthorized) and Express middleware
 */
/**
 * Error class with semantic HTTP status codes and middleware functionality
 */
export class ErrorClass {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Creates a 400 Bad Request error
     * @llm-rule WHEN: Client sends invalid input data (missing fields, wrong format)
     * @llm-rule AVOID: Using for server-side validation errors - use conflict() instead
     * @llm-rule NOTE: EXAMPLES: missing email, invalid JSON, malformed request body
     * @llm-rule NOTE: PATTERN: if (!req.body.email) throw error.badRequest('Email required');
     */
    badRequest(message) {
        const error = new Error(message || this.config.messages.badRequest);
        error.statusCode = 400;
        error.type = 'BAD_REQUEST';
        return error;
    }
    /**
     * Creates a 401 Unauthorized error
     * @llm-rule WHEN: Authentication is required but missing or invalid
     * @llm-rule AVOID: Using for permission issues - use forbidden() for access control
     * @llm-rule NOTE: EXAMPLES: missing token, invalid token, expired session
     * @llm-rule NOTE: PATTERN: if (!token) throw error.unauthorized('Token required');
     */
    unauthorized(message) {
        const error = new Error(message || this.config.messages.unauthorized);
        error.statusCode = 401;
        error.type = 'UNAUTHORIZED';
        return error;
    }
    /**
     * Creates a 403 Forbidden error
     * @llm-rule WHEN: User is authenticated but lacks permission for the action
     * @llm-rule AVOID: Using for authentication issues - use unauthorized() instead
     * @llm-rule NOTE: EXAMPLES: insufficient role, blocked user, admin-only endpoint
     * @llm-rule NOTE: PATTERN: if (!user.isAdmin) throw error.forbidden('Admin access required');
     */
    forbidden(message) {
        const error = new Error(message || this.config.messages.forbidden);
        error.statusCode = 403;
        error.type = 'FORBIDDEN';
        return error;
    }
    /**
     * Creates a 404 Not Found error
     * @llm-rule WHEN: Requested resource does not exist
     * @llm-rule AVOID: Using for business logic failures - use conflict() instead
     * @llm-rule NOTE: EXAMPLES: user not found, post not found, missing file
     * @llm-rule NOTE: PATTERN: if (!user) throw error.notFound('User not found');
     */
    notFound(message) {
        const error = new Error(message || this.config.messages.notFound);
        error.statusCode = 404;
        error.type = 'NOT_FOUND';
        return error;
    }
    /**
     * Creates a 409 Conflict error
     * @llm-rule WHEN: Business logic conflicts or resource already exists
     * @llm-rule AVOID: Using for validation errors - use badRequest() for input validation
     * @llm-rule NOTE: EXAMPLES: email already exists, duplicate username, state conflicts
     * @llm-rule NOTE: PATTERN: if (existingUser) throw error.conflict('Email already registered');
     */
    conflict(message) {
        const error = new Error(message || this.config.messages.conflict);
        error.statusCode = 409;
        error.type = 'CONFLICT';
        return error;
    }
    /**
     * Creates a 500 Server Error
     * @llm-rule WHEN: Internal server failures like database errors, external API failures
     * @llm-rule AVOID: Using for business logic issues - use appropriate 4xx errors instead
     * @llm-rule NOTE: EXAMPLES: database connection failure, external API timeout, file system errors
     * @llm-rule NOTE: PATTERN: catch (dbError) { throw error.serverError('Database unavailable'); }
     */
    serverError(message) {
        const error = new Error(message || this.config.messages.serverError);
        error.statusCode = 500;
        error.type = 'SERVER_ERROR';
        return error;
    }
    /**
     * Creates a 429 Too Many Requests error
     * @llm-rule WHEN: Client has exceeded rate limits
     * @llm-rule NOTE: PATTERN: if (rateExceeded) throw error.tooMany('Slow down');
     */
    tooMany(message) {
        const error = new Error(message || 'Too many requests');
        error.statusCode = 429;
        error.type = 'TOO_MANY_REQUESTS';
        return error;
    }
    /**
     * Creates a 500 Internal Server Error (alias for serverError — prefer serverError())
     * @llm-rule WHEN: Unexpected internal failures where serverError() feels too generic
     * @llm-rule NOTE: Identical to serverError() — use either, not both in the same codebase
     */
    internal(message) {
        return this.serverError(message);
    }
    /**
     * Creates a custom error with any status code
     * @llm-rule WHEN: Need custom HTTP status codes not covered by semantic methods
     * @llm-rule AVOID: Using for standard HTTP codes - use semantic methods instead
     * @llm-rule NOTE: EXAMPLES: 429 rate limit, 503 service unavailable, 418 teapot
     * @llm-rule NOTE: PATTERN: error.createError(429, 'Rate limit exceeded', 'RATE_LIMIT');
     */
    createError(statusCode, message, type) {
        const error = new Error(message);
        error.statusCode = statusCode;
        error.type = type || `HTTP_${statusCode}`;
        return error;
    }
    /**
     * Creates production-ready Express error handling middleware
     * @llm-rule WHEN: Setting up Express app error handling - use as last middleware
     * @llm-rule AVOID: Using multiple error handlers - this should be the final middleware
     * @llm-rule NOTE: MIDDLEWARE SETUP: app.use(error.handleErrors()); // Must be LAST
     * @llm-rule NOTE: AUTO-FEATURES: dev vs prod responses, stack trace hiding, error logging
     */
    handleErrors(options = {}) {
        // Use instance config as defaults, allow options to override
        const showStack = options.showStack !== undefined
            ? options.showStack
            : this.config.middleware.showStack;
        const logErrors = options.logErrors !== undefined
            ? options.logErrors
            : this.config.middleware.logErrors;
        return (error, req, res, next) => {
            // Log errors if enabled
            if (logErrors) {
                console.error('[@bloomneo/appkit/error] Error:', error.message);
                if (showStack && error.stack) {
                    console.error('[@bloomneo/appkit/error] Stack:', error.stack);
                }
            }
            // Determine status code
            const statusCode = error.statusCode || 500;
            // Determine error type
            const errorType = error.type || (statusCode >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR');
            // Build response object
            const response = {
                error: errorType,
                message: error.message || 'An error occurred',
            };
            // Include stack trace in development
            if (showStack && error.stack) {
                response.stack = error.stack;
            }
            // Send error response
            res.status(statusCode).json(response);
        };
    }
    /**
     * Wraps async route handlers to catch errors automatically
     * @llm-rule WHEN: Creating async Express route handlers that might throw errors
     * @llm-rule AVOID: Manual try/catch in every route - this handles it automatically
     * @llm-rule NOTE: ASYNC PATTERN: app.post('/route', error.asyncRoute(async (req, res) => {...}));
     * @llm-rule NOTE: ERROR FLOW: thrown errors → automatically caught → sent to handleErrors middleware
     */
    asyncRoute(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
    /**
     * Checks if error is a 4xx client error
     * @llm-rule WHEN: Need to categorize errors for logging or metrics
     * @llm-rule AVOID: Manual status code checking - this handles the logic
     * @llm-rule NOTE: CLIENT ERRORS: 400-499 status codes (user's fault)
     */
    isClientError(error) {
        return error.statusCode >= 400 && error.statusCode < 500;
    }
    /**
     * Checks if error is a 5xx server error
     * @llm-rule WHEN: Need to categorize errors for monitoring or alerting
     * @llm-rule AVOID: Manual status code checking - this handles the logic
     * @llm-rule NOTE: SERVER ERRORS: 500-599 status codes (server's fault)
     */
    isServerError(error) {
        return error.statusCode >= 500;
    }
    /**
     * Gets current environment detection info
     * @llm-rule WHEN: Need to check current environment configuration
     * @llm-rule AVOID: Direct process.env access - this provides parsed config
     */
    getEnvironmentInfo() {
        return {
            isDevelopment: this.config.environment.isDevelopment,
            isProduction: this.config.environment.isProduction,
            nodeEnv: this.config.environment.nodeEnv,
        };
    }
    /**
     * Gets current error configuration
     * @llm-rule WHEN: Debugging error setup or inspecting current settings
     * @llm-rule AVOID: Accessing config directly - this provides clean interface
     */
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=error.js.map