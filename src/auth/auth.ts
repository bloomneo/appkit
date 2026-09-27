/**
 * Core authentication class with a linear role.level hierarchy
 * @module @bloomneo/appkit/auth
 * @file src/auth/auth.ts
 *
 * @llm-rule WHEN: Building apps that need JWT operations, password hashing, and role-based middleware
 * @llm-rule AVOID: Constructing AuthenticationClass directly — always get the instance via authClass.get()
 * @llm-rule NOTE: Use requireUserRoles() for access control; scopedWhere() for the caller's data scope
 * @llm-rule NOTE: Uses role.level format (user.basic, admin.tenant) with automatic inheritance
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AppKitError } from '../internal/errors.js';
import {
  validateRounds,
  validateRoleLevel,
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
export class TokenError extends AppKitError {
  public readonly code: 'expired' | 'not_before' | 'invalid' | 'malformed';
  constructor(code: TokenError['code'], message: string) {
    super(message, { module: 'auth', code });
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
  /**
   * Data scope: which tenant this identity is bound to. null/undefined means
   * platform-wide. This is NOT a capability — see auth.scopedWhere().
   *
   * Carrying it in the token is what lets a route filter without a per-request
   * lookup, and what lets an offline or mobile client know its own reach.
   */
  tenantId?: string | null;
  /** Data scope: which client within the tenant, when the app has that level. */
  clientId?: string | null;
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
  [key: string]: any;
}

export interface ApiTokenPayload {
  keyId: string;
  type: 'api_key';
  role: string;
  level: string;
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
 * Authentication class with JWT, password, and role.level hierarchy
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
   * Data scope for the caller, ready to spread into a query filter.
   *
   * This is deliberately NOT a role check. "May they do this?" is the role;
   * "on whose data?" is tenantId/clientId. Conflating them is
   * how apps end up with a firm admin who can read another firm.
   *
   * ```ts
   * const rows = await db.invoice.findMany({ where: { ...auth.scopedWhere(req), status } });
   * ```
   *
   * A platform account carries an explicit `tenantId: null` and gets `{}` —
   * no filter, cross-tenant by design. Anything narrower gets the columns it
   * is bound to.
   *
   * It throws, rather than returning `{}`, when it cannot tell: no
   * authenticated user, or a token with no `tenantId` claim at all. `{}` means
   * "all data", so guessing it on a missing claim turned a forgotten login
   * field into every tenant's rows.
   *
   * @llm-rule WHEN: Filtering a query by the caller's tenant/client binding
   * @llm-rule AVOID: Trusting it alone for authorization - pair it with requireUserRoles()
   * @llm-rule NOTE: Login tokens must carry tenantId (null for platform accounts) or this throws
   */
  scopedWhere(req: ExpressRequest): { tenantId?: string; clientId?: string } {
    const user = this.getUser(req) as ({ tenantId?: string | null; clientId?: string | null } | null);
    if (!user) {
      throw new AppKitError(
        `[@bloomneo/appkit/auth] scopedWhere() needs an authenticated user. Chain auth.requireLoginToken() before the handler. See: ${DOCS_URL}#role-level-permission-architecture`,
        { module: 'auth', code: 'AUTH_SCOPE_NO_USER' }
      );
    }
    if (!('tenantId' in user)) {
      throw new AppKitError(
        `[@bloomneo/appkit/auth] The login token has no tenantId claim, so its data scope is unknown. Pass tenantId to generateLoginToken() (null for platform accounts). See: ${DOCS_URL}#role-level-permission-architecture`,
        { module: 'auth', code: 'AUTH_SCOPE_MISSING_CLAIM' }
      );
    }

    const where: { tenantId?: string; clientId?: string } = {};
    if (user.tenantId) where.tenantId = user.tenantId;
    if (user.clientId) where.clientId = user.clientId;
    return where;
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