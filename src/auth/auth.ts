/**
 * Core authentication class with role-level-permission system
 * @module @bloomneo/appkit/auth
 * @file src/auth/auth.ts
 *
 * @llm-rule WHEN: Building apps that need JWT operations, password hashing, and role-based middleware
 * @llm-rule AVOID: Constructing AuthenticationClass directly — always get the instance via authClass.get()
 * @llm-rule NOTE: Use requireUserRoles() for hierarchy-based access, requireUserPermissions() for action-specific access
 * @llm-rule NOTE: Uses role.level format (user.basic, admin.tenant) with automatic inheritance
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  validateRounds,
  validateRoleLevel,
  validatePermission,
  type AuthConfig,
} from './defaults.js';

/**
 * Canonical doc URL appended to runtime errors so devs (and AI agents)
 * can self-correct without grepping the codebase. Points at the auth
 * module README on GitHub which has the LLM Quick Reference + Common
 * Mistakes sections that match the most-hit error scenarios.
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/auth/README.md';

/**
 * Typed error thrown by verifyToken() for all JWT failure modes.
 *
 * Middleware checks `error.code` to decide which user-facing message to
 * render. Using a typed error (instead of matching `error.message`) means
 * we can safely prefix / reword messages without breaking middleware.
 *
 * @llm-rule WHEN: Catching verifyToken() failures to branch on failure type
 * @llm-rule AVOID: Comparing error.message strings — use error.code instead
 */
export class TokenError extends Error {
  public readonly code: 'expired' | 'not_before' | 'invalid' | 'malformed';
  constructor(code: TokenError['code'], message: string) {
    super(message);
    this.name = 'TokenError';
    this.code = code;
  }
}

export interface JwtPayload {
  userId?: string | number;
  keyId?: string;
  type: 'login' | 'api_key';
  role: string;
  level: string;
  permissions?: string[];
  [key: string]: any;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface LoginTokenPayload {
  userId: string | number;
  type: 'login';
  role: string;
  level: string;
  permissions?: string[];
  [key: string]: any;
}

export interface ApiTokenPayload {
  keyId: string;
  type: 'api_key';
  role: string;
  level: string;
  permissions?: string[];
  [key: string]: any;
}

export interface ExpressRequest {
  headers: { [key: string]: string | string[] | undefined };
  cookies?: { [key: string]: string };
  query?: { [key: string]: any };
  user?: JwtPayload;
  token?: JwtPayload;
  [key: string]: any;
}

export interface ExpressResponse {
  status: (code: number) => { json: (data: any) => void };
  json: (data: any) => void;
}

export interface MiddlewareOptions {
  getToken?: (request: ExpressRequest) => string | null;
}

export type ExpressMiddleware = (req: ExpressRequest, res: ExpressResponse, next: () => void) => void;

/**
 * Authentication class with JWT, password, and role-level-permission system
 */
export class AuthenticationClass {
  public config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Generates a login JWT token for user authentication
   * @llm-rule WHEN: User successfully logs in to your app (mobile/web)
   * @llm-rule AVOID: Using for API access - use generateApiToken instead
   * @llm-rule NOTE: Creates JWT with userId and type: 'login'
   */
  generateLoginToken(payload: Omit<LoginTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>, expiresIn?: string): string {
    const loginPayload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
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
  generateApiToken(payload: Omit<ApiTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>, expiresIn?: string): string {
    const apiPayload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      ...payload,
      type: 'api_key',
    };

    return this.signToken(apiPayload, expiresIn || '1y');
  }

  /**
   * Internal method to create and sign JWT tokens
   * @private
   */
  private signToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'>, expiresIn?: string): string {
    if (!payload || typeof payload !== 'object') {
      throw new Error(`[@bloomneo/appkit/auth] Payload must be an object. See: ${DOCS_URL}#token-generation`);
    }

    // Validate based on token type
    if (payload.type === 'login') {
      if (!payload.userId) {
        throw new Error(`[@bloomneo/appkit/auth] Login token must include userId. Use auth.generateLoginToken({ userId, role, level }). See: ${DOCS_URL}#token-generation`);
      }
    } else if (payload.type === 'api_key') {
      if (!payload.keyId) {
        throw new Error(`[@bloomneo/appkit/auth] API token must include keyId. Use auth.generateApiToken({ keyId, role, level }). See: ${DOCS_URL}#token-generation`);
      }
    } else {
      throw new Error(`[@bloomneo/appkit/auth] Token type must be "login" or "api_key". Use auth.generateLoginToken() or auth.generateApiToken(). See: ${DOCS_URL}#token-generation`);
    }

    if (!payload.role || !payload.level) {
      throw new Error(`[@bloomneo/appkit/auth] Payload must include both role and level (e.g. role: 'admin', level: 'tenant'). See: ${DOCS_URL}#role-level-permission-architecture`);
    }

    // Validate role.level exists
    const roleLevel = `${payload.role}.${payload.level}`;
    if (!validateRoleLevel(roleLevel, this.config.roles)) {
      throw new Error(`[@bloomneo/appkit/auth] Invalid role.level: "${roleLevel}". The default hierarchy ships with user.basic, user.pro, user.max, moderator.review, moderator.approve, moderator.manage, admin.tenant, admin.org, admin.system. To register custom roles, set BLOOM_AUTH_ROLES env var. See: ${DOCS_URL}#role-level-permission-architecture`);
    }

    const jwtSecret = this.config.jwt.secret;
    if (!jwtSecret) {
      throw new Error(
        `[@bloomneo/appkit/auth] JWT secret required. Set BLOOM_AUTH_SECRET environment variable. See: ${DOCS_URL}#configuration`
      );
    }

    const tokenExpiration = expiresIn || this.config.jwt.expiresIn;

    try {
      return jwt.sign(payload, jwtSecret, {
        expiresIn: tokenExpiration,
        algorithm: this.config.jwt.algorithm as jwt.Algorithm,
      } as jwt.SignOptions);
    } catch (error) {
      throw new Error(`[@bloomneo/appkit/auth] Failed to generate token: ${(error as Error).message}. See: ${DOCS_URL}#token-generation`);
    }
  }

  /**
   * Verifies and decodes a JWT token (both login and API tokens)
   * @llm-rule WHEN: Validating incoming tokens from requests
   * @llm-rule AVOID: Using jwt.verify directly - this handles errors and validates structure
   * @llm-rule NOTE: Handles both login tokens (userId) and API tokens (keyId)
   */
  verifyToken(token: string): JwtPayload {
    if (!token || typeof token !== 'string') {
      throw new Error(`[@bloomneo/appkit/auth] Token must be a non-empty string. See: ${DOCS_URL}#token-verification`);
    }

    const jwtSecret = this.config.jwt.secret;
    if (!jwtSecret) {
      throw new Error(
        `[@bloomneo/appkit/auth] JWT secret required. Set BLOOM_AUTH_SECRET environment variable. See: ${DOCS_URL}#configuration`
      );
    }

    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: [this.config.jwt.algorithm as jwt.Algorithm],
      }) as JwtPayload;

      // Validate decoded token has required structure
      if (!decoded.role || !decoded.level || !decoded.type) {
        throw new Error(`[@bloomneo/appkit/auth] Token missing required role, level, or type information. See: ${DOCS_URL}#token-verification`);
      }

      // Validate type-specific requirements
      if (decoded.type === 'login' && !decoded.userId) {
        throw new Error(`[@bloomneo/appkit/auth] Login token missing userId. See: ${DOCS_URL}#token-verification`);
      }
      if (decoded.type === 'api_key' && !decoded.keyId) {
        throw new Error(`[@bloomneo/appkit/auth] API token missing keyId. See: ${DOCS_URL}#token-verification`);
      }

      return decoded;
    } catch (error) {
      // Re-throw our own typed errors unchanged so callers see the real cause.
      if (error instanceof TokenError) throw error;

      const name = (error as any).name;
      if (name === 'TokenExpiredError') {
        throw new TokenError('expired', `[@bloomneo/appkit/auth] Token has expired. See: ${DOCS_URL}#token-verification`);
      }
      if (name === 'NotBeforeError') {
        throw new TokenError('not_before', `[@bloomneo/appkit/auth] Token is not yet active (nbf). See: ${DOCS_URL}#token-verification`);
      }
      if (name === 'JsonWebTokenError') {
        throw new TokenError('invalid', `[@bloomneo/appkit/auth] Invalid token: ${(error as Error).message}. See: ${DOCS_URL}#token-verification`);
      }
      throw new TokenError('malformed', `[@bloomneo/appkit/auth] Token verification failed: ${(error as Error).message}. See: ${DOCS_URL}#token-verification`);
    }
  }

  /**
   * Hashes a password using bcrypt
   * @llm-rule WHEN: Storing user passwords - always hash before saving to database
   * @llm-rule AVOID: Storing plain text passwords - major security vulnerability
   * @llm-rule NOTE: Takes ~100ms with default 10 rounds - don't call in tight loops
   */
  async hashPassword(password: string, rounds?: number): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new Error(`[@bloomneo/appkit/auth] Password must be a non-empty string. See: ${DOCS_URL}#password-hashing`);
    }

    const saltRounds = rounds || this.config.password.saltRounds;
    validateRounds(saltRounds);

    try {
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error(`[@bloomneo/appkit/auth] Password hashing failed: ${(error as Error).message}. See: ${DOCS_URL}#password-hashing`);
    }
  }

  /**
   * Compares a password with its hash
   * @llm-rule WHEN: Validating user login credentials
   * @llm-rule AVOID: Manual string comparison - timing attacks possible
   * @llm-rule NOTE: Always returns boolean, never throws on comparison failure
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!password || typeof password !== 'string') {
      return false;
    }

    if (!hash || typeof hash !== 'string') {
      return false;
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
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
   * @llm-rule NOTE: Previously named user(). Renamed to getUser() pre-v1 per NAMING.md
   *                 (no bare-noun methods). There is no user() alias.
   */
  getUser(request: ExpressRequest): JwtPayload | null {
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
  hasRole(userRoleLevel: string, requiredRoleLevel: string): boolean {
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
   * Checks if user has specific permission with automatic action inheritance.
   *
   * Permission resolution rule (REPLACEMENT, not additive):
   *   - If `user.permissions` is set (an array, even empty), it is the COMPLETE
   *     permission set for the user. Role defaults are NOT consulted.
   *   - If `user.permissions` is undefined / null, the role.level's default
   *     permissions from the configured RolePermissionConfig are used.
   *
   * This matches AWS IAM, Casbin, OPA, Auth0 RBAC, and every mainstream
   * permission system: explicit permissions are the truth, defaults are the
   * fallback. To downgrade a user below their role's defaults, pass an
   * explicit `permissions: [...]` array (even an empty `[]` is valid — it
   * means "no permissions despite the role").
   *
   * Action inheritance rule (within a scope):
   *   - `manage:<scope>` includes view, create, edit, delete for that scope
   *   - No upward inheritance: `edit:tenant` does NOT grant `manage:tenant`
   *
   * @llm-rule WHEN: Checking fine-grained permissions for specific actions
   * @llm-rule AVOID: Hardcoding permission checks - this handles inheritance
   * @llm-rule NOTE: 'manage:scope' includes ALL other actions for that scope
   * @llm-rule NOTE: Explicit user.permissions REPLACES role defaults (not additive)
   * @llm-rule NOTE: If user has 'manage:tenant' → hasPermission('edit:tenant') returns TRUE
   * @llm-rule NOTE: If user has 'edit:tenant' → hasPermission('manage:tenant') returns FALSE
   * @llm-rule NOTE: To downgrade a user, pass permissions: [] (empty array)
   * @llm-rule NOTE: Actions hierarchy: manage > delete > edit > create > view
   * @llm-rule NOTE: Previously named can(). Renamed to hasPermission() pre-v1 per
   *                 NAMING.md (has/is/can are boolean prefixes, not bare verbs).
   */
  hasPermission(user: JwtPayload, permission: string): boolean {
    if (!user || !permission) {
      return false;
    }

    if (!validatePermission(permission)) {
      throw new Error(
        `[@bloomneo/appkit/auth] Invalid permission format: "${permission}". ` +
        `Permissions must be in "action:scope" form (e.g. "edit:tenant", "manage:users"). ` +
        `See: ${DOCS_URL}#role-level-permission-architecture`
      );
    }

    // PERMISSION RESOLUTION: explicit user.permissions REPLACES role defaults.
    // If you want a user to have ONLY a narrow set of permissions, pass them
    // explicitly. If you want the role's defaults, omit user.permissions entirely.
    const effectivePermissions: string[] =
      user.permissions && Array.isArray(user.permissions)
        ? user.permissions
        : this.config.permissions.defaults[`${user.role}.${user.level}`] ?? [];

    // Direct match
    if (effectivePermissions.includes(permission)) {
      return true;
    }

    // Action inheritance: manage:<scope> grants all other actions for that scope.
    // No upward inheritance — edit:scope does NOT grant manage:scope.
    const [action, scope] = permission.split(':');
    if (action !== 'manage') {
      const managePermission = `manage:${scope}`;
      if (effectivePermissions.includes(managePermission)) {
        return true;
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
  requireLoginToken(options: MiddlewareOptions = {}): ExpressMiddleware {
    const getToken = options.getToken || this.getDefaultTokenExtractor();

    return (req: ExpressRequest, res: ExpressResponse, next: () => void): void => {
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
      } catch (error) {
        const isExpired = error instanceof TokenError && error.code === 'expired';
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
  requireUserRoles(requiredRoles: string[]): ExpressMiddleware {
    if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
      throw new Error(`[@bloomneo/appkit/auth] requiredRoles must be a non-empty array. See: ${DOCS_URL}#role-level-permission-architecture`);
    }

    // Validate all roles exist
    for (const role of requiredRoles) {
      if (!validateRoleLevel(role, this.config.roles)) {
        throw new Error(`[@bloomneo/appkit/auth] Invalid role.level for middleware: "${role}". See: ${DOCS_URL}#role-level-permission-architecture`);
      }
    }

    return (req: ExpressRequest, res: ExpressResponse, next: () => void): void => {
      const user = this.getUser(req);

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
      const hasRequiredRole = requiredRoles.some(requiredRole => 
        this.hasRole(userRoleLevel, requiredRole)
      );

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
  requireUserPermissions(requiredPermissions: string[]): ExpressMiddleware {
    if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
      throw new Error(`[@bloomneo/appkit/auth] requiredPermissions must be a non-empty array. See: ${DOCS_URL}#role-level-permission-architecture`);
    }

    // Validate all permissions
    for (const permission of requiredPermissions) {
      if (!validatePermission(permission)) {
        throw new Error(`[@bloomneo/appkit/auth] Invalid permission format for middleware: "${permission}". See: ${DOCS_URL}#role-level-permission-architecture`);
      }
    }

    return (req: ExpressRequest, res: ExpressResponse, next: () => void): void => {
      const user = this.getUser(req);

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

      const hasAllPermissions = requiredPermissions.every(permission =>
        this.hasPermission(user, permission)
      );

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
  requireApiToken(options: MiddlewareOptions = {}): ExpressMiddleware {
    const getToken = options.getToken || this.getDefaultTokenExtractor();

    return (req: ExpressRequest, res: ExpressResponse, next: () => void): void => {
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
      } catch (error) {
        const isExpired = error instanceof TokenError && error.code === 'expired';
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
  private getDefaultTokenExtractor(): (request: ExpressRequest) => string | null {
    return (request: ExpressRequest): string | null => {
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