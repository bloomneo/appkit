/**
 * Core authentication class with role-level-permission system
 * @module @bloomneo/appkit/auth
 * @file src/auth/authentication.ts
 *
 * @llm-rule WHEN: Building apps that need JWT operations, password hashing, and role-based middleware
 * @llm-rule AVOID: Using directly - always get instance via auth.get()
 * @llm-rule NOTE: Use requireUserRoles() for hierarchy-based access, requireUserPermissions() for action-specific access
 * @llm-rule NOTE: Uses role.level format (user.basic, admin.tenant) with automatic inheritance
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { validateRounds, validateRoleLevel, validatePermission, } from './defaults.js';
/**
 * Authentication class with JWT, password, and role-level-permission system
 */
export class AuthenticationClass {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Generates a login JWT token for user authentication
     * @llm-rule WHEN: User successfully logs in to your app (mobile/web)
     * @llm-rule AVOID: Using for API access - use generateApiToken instead
     * @llm-rule NOTE: Creates JWT with userId and type: 'login'
     */
    generateLoginToken(payload, expiresIn) {
        const loginPayload = {
            ...payload,
            type: 'login',
        };
        return this.signToken(loginPayload, expiresIn || '7d');
    }
    /**
     * Generates an API JWT token for external access
     * @llm-rule WHEN: Creating API keys for third-party integrations
     * @llm-rule AVOID: Using for user authentication - use generateLoginToken instead
     * @llm-rule NOTE: Creates JWT with keyId and type: 'api_key'
     */
    generateApiToken(payload, expiresIn) {
        const apiPayload = {
            ...payload,
            type: 'api_key',
        };
        return this.signToken(apiPayload, expiresIn || '1y');
    }
    /**
     * Internal method to create and sign JWT tokens
     * @private
     */
    signToken(payload, expiresIn) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Payload must be an object');
        }
        // Validate based on token type
        if (payload.type === 'login') {
            if (!payload.userId) {
                throw new Error('Login token must include userId');
            }
        }
        else if (payload.type === 'api_key') {
            if (!payload.keyId) {
                throw new Error('API token must include keyId');
            }
        }
        else {
            throw new Error('Token type must be "login" or "api_key"');
        }
        if (!payload.role || !payload.level) {
            throw new Error('Payload must include both role and level');
        }
        // Validate role.level exists
        const roleLevel = `${payload.role}.${payload.level}`;
        if (!validateRoleLevel(roleLevel, this.config.roles)) {
            throw new Error(`Invalid role.level: "${roleLevel}"`);
        }
        const jwtSecret = this.config.jwt.secret;
        if (!jwtSecret) {
            throw new Error('JWT secret required. Set VOILA_AUTH_SECRET environment variable');
        }
        const tokenExpiration = expiresIn || this.config.jwt.expiresIn;
        try {
            return jwt.sign(payload, jwtSecret, {
                expiresIn: tokenExpiration,
            });
        }
        catch (error) {
            throw new Error(`Failed to generate token: ${error.message}`);
        }
    }
    /**
     * Verifies and decodes a JWT token (both login and API tokens)
     * @llm-rule WHEN: Validating incoming tokens from requests
     * @llm-rule AVOID: Using jwt.verify directly - this handles errors and validates structure
     * @llm-rule NOTE: Handles both login tokens (userId) and API tokens (keyId)
     */
    verifyToken(token) {
        if (!token || typeof token !== 'string') {
            throw new Error('Token must be a string');
        }
        const jwtSecret = this.config.jwt.secret;
        if (!jwtSecret) {
            throw new Error('JWT secret required. Set VOILA_AUTH_SECRET environment variable');
        }
        try {
            const decoded = jwt.verify(token, jwtSecret, {
                algorithms: [this.config.jwt.algorithm],
            });
            // Validate decoded token has required structure
            if (!decoded.role || !decoded.level || !decoded.type) {
                throw new Error('Token missing required role, level, or type information');
            }
            // Validate type-specific requirements
            if (decoded.type === 'login' && !decoded.userId) {
                throw new Error('Login token missing userId');
            }
            if (decoded.type === 'api_key' && !decoded.keyId) {
                throw new Error('API token missing keyId');
            }
            return decoded;
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }
    /**
     * Hashes a password using bcrypt
     * @llm-rule WHEN: Storing user passwords - always hash before saving to database
     * @llm-rule AVOID: Storing plain text passwords - major security vulnerability
     * @llm-rule NOTE: Takes ~100ms with default 10 rounds - don't call in tight loops
     */
    async hashPassword(password, rounds) {
        if (!password || typeof password !== 'string') {
            throw new Error('Password must be a non-empty string');
        }
        const saltRounds = rounds || this.config.password.saltRounds;
        validateRounds(saltRounds);
        try {
            return await bcrypt.hash(password, saltRounds);
        }
        catch (error) {
            throw new Error(`Password hashing failed: ${error.message}`);
        }
    }
    /**
     * Compares a password with its hash
     * @llm-rule WHEN: Validating user login credentials
     * @llm-rule AVOID: Manual string comparison - timing attacks possible
     * @llm-rule NOTE: Always returns boolean, never throws on comparison failure
     */
    async comparePassword(password, hash) {
        if (!password || typeof password !== 'string') {
            return false;
        }
        if (!hash || typeof hash !== 'string') {
            return false;
        }
        try {
            return await bcrypt.compare(password, hash);
        }
        catch (error) {
            // bcrypt.compare can fail on malformed hashes
            return false;
        }
    }
    /**
     * Safely extracts user from request - never crashes
     * @llm-rule WHEN: Need to access user data from authenticated requests
     * @llm-rule AVOID: Accessing req.user directly - may be undefined and cause crashes
     * @llm-rule NOTE: Always returns null for unauthenticated requests - safe to use
     * @llm-rule NOTE: Works with both login authentication (req.user) and API tokens (req.token)
     */
    user(request) {
        if (!request || typeof request !== 'object') {
            return null;
        }
        // Check for user authentication first (login-based)
        if (request.user && typeof request.user === 'object' && (request.user.userId || request.user.keyId)) {
            return request.user;
        }
        // Check for token authentication (API-based)
        if (request.token && typeof request.token === 'object' && (request.token.userId || request.token.keyId)) {
            return request.token;
        }
        return null;
    }
    /**
     * Checks if user has specified role with automatic inheritance
     * @llm-rule WHEN: Checking if user can access role-protected resources
     * @llm-rule AVOID: Manual role comparisons - this handles inheritance automatically
     * @llm-rule NOTE: Higher levels inherit lower (admin.org has admin.tenant access)
     * @llm-rule NOTE: INHERITANCE EXAMPLES:
     * @llm-rule NOTE: auth.hasRole('admin.org', 'admin.tenant') → TRUE (org > tenant)
     * @llm-rule NOTE: auth.hasRole('admin.system', 'user.basic') → TRUE (system > basic)
     * @llm-rule NOTE: auth.hasRole('user.basic', 'admin.tenant') → FALSE (basic < tenant)
     * @llm-rule NOTE: Role hierarchy: admin.system > admin.org > admin.tenant > user.max > user.pro > user.basic
     */
    hasRole(userRoleLevel, requiredRoleLevel) {
        // INHERITANCE RULE: Higher role levels automatically include lower levels
        // Example: admin.org (level 6) includes admin.tenant (level 5) access
        if (!userRoleLevel || !requiredRoleLevel) {
            return false;
        }
        if (!validateRoleLevel(userRoleLevel, this.config.roles)) {
            return false;
        }
        if (!validateRoleLevel(requiredRoleLevel, this.config.roles)) {
            return false;
        }
        const userLevel = this.config.roles[userRoleLevel]?.level;
        const requiredLevel = this.config.roles[requiredRoleLevel]?.level;
        if (userLevel === undefined || requiredLevel === undefined) {
            return false;
        }
        // Higher numeric levels include lower levels
        return userLevel >= requiredLevel;
    }
    /**
     * Checks if user has specific permission with automatic action inheritance
     * @llm-rule WHEN: Checking fine-grained permissions for specific actions
     * @llm-rule AVOID: Hardcoding permission checks - this handles action inheritance
     * @llm-rule NOTE: 'manage:scope' includes ALL other actions for that scope
     * @llm-rule NOTE: PERMISSION INHERITANCE EXAMPLES:
     * @llm-rule NOTE: If user has 'manage:tenant' → can('edit:tenant') returns TRUE
     * @llm-rule NOTE: If user has 'manage:tenant' → can('view:tenant') returns TRUE
     * @llm-rule NOTE: If user has 'edit:tenant' → can('manage:tenant') returns FALSE
     * @llm-rule NOTE: Actions hierarchy: manage > delete > edit > create > view
     */
    can(user, permission) {
        // PERMISSION INHERITANCE: 'manage:tenant' automatically includes:
        // - view:tenant, create:tenant, edit:tenant, delete:tenant
        // Example: if user has 'manage:tenant', they can do 'edit:tenant'
        if (!user || !permission) {
            return false;
        }
        if (!validatePermission(permission)) {
            throw new Error(`Invalid permission format: "${permission}"`);
        }
        // Check if user has the specific permission
        if (user.permissions && Array.isArray(user.permissions)) {
            if (user.permissions.includes(permission)) {
                return true;
            }
            // Check for manage permission (includes all other actions)
            const [action, scope] = permission.split(':');
            if (action !== 'manage') {
                const managePermission = `manage:${scope}`;
                if (user.permissions.includes(managePermission)) {
                    return true;
                }
            }
        }
        // Fallback: check default permissions for user's role.level
        const userRoleLevel = `${user.role}.${user.level}`;
        const defaultPermissions = this.config.permissions.defaults[userRoleLevel];
        if (defaultPermissions && Array.isArray(defaultPermissions)) {
            if (defaultPermissions.includes(permission)) {
                return true;
            }
            // Check for manage permission in defaults
            const [action, scope] = permission.split(':');
            if (action !== 'manage') {
                const managePermission = `manage:${scope}`;
                if (defaultPermissions.includes(managePermission)) {
                    return true;
                }
            }
        }
        return false;
    }
    // ====================================================================
    // EXPRESS MIDDLEWARE
    // ====================================================================
    /**
     * Creates Express authentication middleware for login tokens
     * @llm-rule WHEN: Protecting routes that need authenticated users
     * @llm-rule AVOID: Using for API routes - use requireApiToken instead
     * @llm-rule NOTE: Validates login tokens (type: 'login') and sets req.user
     */
    requireLoginToken(options = {}) {
        if (!this.config.jwt.secret) {
            throw new Error('JWT secret required for authentication middleware');
        }
        const getToken = options.getToken || this.getDefaultTokenExtractor();
        return (req, res, next) => {
            try {
                const token = getToken(req);
                if (!token) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        message: this.config.middleware.errorMessages.noToken,
                    });
                }
                const payload = this.verifyToken(token);
                if (payload.type !== 'login') {
                    return res.status(401).json({
                        error: 'Invalid token type',
                        message: 'Login token required for this endpoint',
                    });
                }
                req.user = payload;
                next();
            }
            catch (error) {
                const isExpired = error.message === 'Token has expired';
                const message = isExpired
                    ? this.config.middleware.errorMessages.expiredToken
                    : this.config.middleware.errorMessages.invalidToken;
                return res.status(401).json({
                    error: 'Unauthorized',
                    message,
                });
            }
        };
    }
    /**
     * Creates Express role-based authorization middleware for authenticated users
     * @llm-rule WHEN: Protecting routes that require specific user roles
     * @llm-rule AVOID: Using without requireLoginToken - this assumes user is already authenticated
     * @llm-rule AVOID: Using with API tokens - API tokens don't have user roles
     * @llm-rule NOTE: User needs ANY role from the array (OR logic)
     * @llm-rule NOTE: Role inheritance applies - admin.org can access admin.tenant routes
     */
    requireUserRoles(requiredRoles) {
        if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
            throw new Error('requiredRoles must be a non-empty array');
        }
        // Validate all roles exist
        for (const role of requiredRoles) {
            if (!validateRoleLevel(role, this.config.roles)) {
                throw new Error(`Invalid role.level for middleware: "${role}"`);
            }
        }
        return (req, res, next) => {
            const user = this.user(req);
            if (!user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: this.config.middleware.errorMessages.noToken,
                });
            }
            if (user.type !== 'login') {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'User roles only apply to login tokens',
                });
            }
            const userRoleLevel = `${user.role}.${user.level}`;
            const hasRequiredRole = requiredRoles.some(requiredRole => this.hasRole(userRoleLevel, requiredRole));
            if (!hasRequiredRole) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: this.config.middleware.errorMessages.insufficientRole,
                });
            }
            next();
        };
    }
    /**
     * Creates Express permission-based authorization middleware for authenticated users
     * @llm-rule WHEN: Protecting routes that require specific user permissions
     * @llm-rule AVOID: Using without requireLoginToken - this assumes user is already authenticated
     * @llm-rule AVOID: Using with API tokens - API tokens don't have user permissions
     * @llm-rule NOTE: User needs ALL permissions from the array (AND logic)
     * @llm-rule NOTE: Permission inheritance applies - manage:tenant can access edit:tenant routes
     */
    requireUserPermissions(requiredPermissions) {
        if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
            throw new Error('requiredPermissions must be a non-empty array');
        }
        // Validate all permissions
        for (const permission of requiredPermissions) {
            if (!validatePermission(permission)) {
                throw new Error(`Invalid permission format for middleware: "${permission}"`);
            }
        }
        return (req, res, next) => {
            const user = this.user(req);
            if (!user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: this.config.middleware.errorMessages.noToken,
                });
            }
            if (user.type !== 'login') {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'User permissions only apply to login tokens',
                });
            }
            const hasAllPermissions = requiredPermissions.every(permission => this.can(user, permission));
            if (!hasAllPermissions) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: this.config.middleware.errorMessages.insufficientPermissions,
                });
            }
            next();
        };
    }
    /**
     * Creates Express API token authentication middleware for external access
     * @llm-rule WHEN: Protecting API routes for third-party integrations
     * @llm-rule AVOID: Using for user routes - use requireLoginToken instead
     * @llm-rule NOTE: Validates API tokens (type: 'api_key') and sets req.token
     */
    requireApiToken(options = {}) {
        if (!this.config.jwt.secret) {
            throw new Error('JWT secret required for API token authentication middleware');
        }
        const getToken = options.getToken || this.getDefaultTokenExtractor();
        return (req, res, next) => {
            try {
                const token = getToken(req);
                if (!token) {
                    return res.status(401).json({
                        error: 'API token required',
                        message: 'API token required for this endpoint',
                    });
                }
                const payload = this.verifyToken(token);
                if (payload.type !== 'api_key') {
                    return res.status(401).json({
                        error: 'Invalid token type',
                        message: 'API token required for this endpoint',
                    });
                }
                req.token = payload;
                next();
            }
            catch (error) {
                const isExpired = error.message === 'Token has expired';
                const message = isExpired
                    ? 'API token has expired'
                    : 'Invalid API token';
                return res.status(401).json({
                    error: 'Unauthorized',
                    message,
                });
            }
        };
    }
    /**
     * Gets default token extractor that checks headers, cookies, and query params
     * @llm-rule WHEN: Need custom token extraction logic
     * @llm-rule AVOID: Modifying directly - pass custom getToken to middleware options
     */
    getDefaultTokenExtractor() {
        return (request) => {
            // Check Authorization header (Bearer token)
            const authHeader = request.headers.authorization;
            if (authHeader && typeof authHeader === 'string') {
                const match = authHeader.match(/^Bearer\s+(.+)$/);
                if (match) {
                    return match[1];
                }
            }
            // Check cookies
            if (request.cookies?.token) {
                return request.cookies.token;
            }
            // Check query parameter
            if (request.query?.token && typeof request.query.token === 'string') {
                return request.query.token;
            }
            return null;
        };
    }
}
//# sourceMappingURL=auth.js.map