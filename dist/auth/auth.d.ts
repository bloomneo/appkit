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
import { AppKitError } from '../util/errors.js';
import { type AuthConfig } from './defaults.js';
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
export declare class TokenError extends AppKitError {
    readonly code: 'expired' | 'not_before' | 'invalid' | 'malformed';
    constructor(code: TokenError['code'], message: string);
}
export interface JwtPayload {
    userId?: string | number;
    keyId?: string;
    type: 'login' | 'api_key';
    /** Capability axis in matrix mode (same value as `tier`). */
    role: string;
    /** Reach axis in matrix mode (same value as `scope`). */
    level: string;
    /** Derived from role in matrix mode. Convenience only — role is canonical. */
    tier?: string;
    /** Derived from level in matrix mode. Convenience only — level is canonical. */
    scope?: string;
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
    headers: {
        [key: string]: string | string[] | undefined;
    };
    cookies?: {
        [key: string]: string;
    };
    query?: {
        [key: string]: any;
    };
    user?: JwtPayload;
    token?: JwtPayload;
    [key: string]: any;
}
export interface ExpressResponse {
    status: (code: number) => {
        json: (data: any) => void;
    };
    json: (data: any) => void;
}
export interface MiddlewareOptions {
    getToken?: (request: ExpressRequest) => string | null;
}
export type ExpressMiddleware = (req: ExpressRequest, res: ExpressResponse, next: () => void) => void;
/**
 * Authentication class with JWT, password, and role-level-permission system
 */
export declare class AuthenticationClass {
    config: AuthConfig;
    constructor(config: AuthConfig);
    /**
     * Generates a login JWT token for user authentication
     * @llm-rule WHEN: User successfully logs in to your app (mobile/web)
     * @llm-rule AVOID: Using for API access - use generateApiToken instead
     * @llm-rule NOTE: Creates JWT with userId and type: 'login'
     */
    generateLoginToken(payload: Omit<LoginTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>, expiresIn?: string): string;
    /**
     * Generates an API JWT token for external access
     * @llm-rule WHEN: Creating API keys for third-party integrations
     * @llm-rule AVOID: Using for user authentication - use generateLoginToken instead
     * @llm-rule NOTE: Creates JWT with keyId and type: 'api_key'
     */
    generateApiToken(payload: Omit<ApiTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>, expiresIn?: string): string;
    /**
     * Internal method to create and sign JWT tokens
     * @private
     */
    private signToken;
    /**
     * Verifies and decodes a JWT token (both login and API tokens)
     * @llm-rule WHEN: Validating incoming tokens from requests
     * @llm-rule AVOID: Using jwt.verify directly - this handles errors and validates structure
     * @llm-rule NOTE: Handles both login tokens (userId) and API tokens (keyId)
     */
    verifyToken(token: string): JwtPayload;
    /**
     * Hashes a password using bcrypt
     * @llm-rule WHEN: Storing user passwords - always hash before saving to database
     * @llm-rule AVOID: Storing plain text passwords - major security vulnerability
     * @llm-rule NOTE: Takes ~100ms with default 10 rounds - don't call in tight loops
     */
    hashPassword(password: string, rounds?: number): Promise<string>;
    /**
     * Compares a password with its hash
     * @llm-rule WHEN: Validating user login credentials
     * @llm-rule AVOID: Manual string comparison - timing attacks possible
     * @llm-rule NOTE: Always returns boolean, never throws on comparison failure
     */
    comparePassword(password: string, hash: string): Promise<boolean>;
    /**
     * Safely extracts user from request - never crashes
     * @llm-rule WHEN: Need to access user data from authenticated requests
     * @llm-rule AVOID: Accessing req.user directly - may be undefined and cause crashes
     * @llm-rule NOTE: Always returns null for unauthenticated requests - safe to use
     * @llm-rule NOTE: Works with both login authentication (req.user) and API tokens (req.token)
     * @llm-rule NOTE: Previously named user(). Renamed to getUser() pre-v1 per NAMING.md
     *                 (no bare-noun methods). There is no user() alias.
     */
    getUser(request: ExpressRequest): JwtPayload | null;
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
    hasRole(userRoleLevel: string, requiredRoleLevel: string): boolean;
    /**
     * Split a `tier.scope` identifier into its two axes and their ranks.
     *
     * @llm-rule WHEN: You need the capability or reach of a role separately
     * @llm-rule AVOID: Splitting role.level by hand - ranks come from the configured axes
     * @llm-rule NOTE: Returns null in linear mode, or when either half isn't a configured axis value
     */
    roleParts(roleLevel: string): {
        tier: string;
        scope: string;
        tierRank: number;
        scopeRank: number;
    } | null;
    /**
     * Capability check, any reach. `requireTier('admin')` admits admin.client
     * through admin.system but never a moderator.
     *
     * @llm-rule WHEN: A route is about what the caller may DO, regardless of scope
     * @llm-rule AVOID: Using in linear mode - there are no tiers, so it always denies
     * @llm-rule NOTE: Chain AFTER requireLoginToken(), same as requireUserRoles()
     */
    requireTier(minimumTier: string): ExpressMiddleware;
    /**
     * Reach check, any capability. `requireScope('tenant')` admits any role at
     * tenant reach or above, whatever its tier.
     *
     * @llm-rule WHEN: A route is about WHERE the caller operates, not what they may do
     * @llm-rule AVOID: Using it as a data filter - that's scopedWhere(), a separate concern
     * @llm-rule NOTE: Chain AFTER requireLoginToken(), same as requireUserRoles()
     */
    requireScope(minimumScope: string): ExpressMiddleware;
    /**
     * Data scope for the caller, ready to spread into a query filter.
     *
     * This is deliberately NOT a role check. "May they do this?" is the role
     * (tier x scope); "on whose data?" is tenantId/clientId. Conflating them is
     * how apps end up with a firm admin who can read another firm.
     *
     * ```ts
     * const rows = await db.invoice.findMany({ where: { ...auth.scopedWhere(req), status } });
     * ```
     *
     * A platform account carries null and gets `{}` — no filter, cross-tenant by
     * design. Anything narrower gets the columns it is bound to.
     *
     * @llm-rule WHEN: Filtering a query by the caller's tenant/client binding
     * @llm-rule AVOID: Trusting it alone for authorization - pair it with requireUserRoles()
     * @llm-rule NOTE: Returns {} for platform scopes, so it is safe to always spread
     */
    /**
     * May this caller see unmasked personal data?
     *
     * Default rule: admin tier only. Moderators routinely need to review records
     * without reading the person's identity, and every app was re-inventing that
     * check at the serialization edge.
     *
     * @llm-rule WHEN: Deciding whether to mask PII before serialising a response
     * @llm-rule AVOID: Using it as an access gate - it decides presentation, not permission
     * @llm-rule NOTE: Matrix mode reads the tier; linear mode falls back to the role half
     */
    canSeePII(user: JwtPayload | null | undefined): boolean;
    /**
     * Mask a personal value for display.
     *
     * Deliberately lossy and one-way — this is for rendering, never for storage
     * or comparison. Enough of the value survives that a human can recognise a
     * record they already know without learning one they don't.
     *
     * @llm-rule WHEN: Serialising a record for a caller where canSeePII() is false
     * @llm-rule AVOID: Masking then persisting - the original is unrecoverable
     * @llm-rule NOTE: Pair with canSeePII(): mask only when it returns false
     */
    maskPII(value: unknown, options: {
        as: 'email' | 'phone' | 'name' | 'id';
    }): string;
    scopedWhere(req: ExpressRequest): {
        tenantId?: string;
        clientId?: string;
    };
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
    hasPermission(user: JwtPayload, permission: string): boolean;
    /**
     * Creates Express authentication middleware for login tokens
     * @llm-rule WHEN: Protecting routes that need authenticated users
     * @llm-rule AVOID: Using for API routes - use requireApiToken instead
     * @llm-rule NOTE: Validates login tokens (type: 'login') and sets req.user
     */
    requireLoginToken(options?: MiddlewareOptions): ExpressMiddleware;
    /**
     * Creates Express role-based authorization middleware for authenticated users
     * @llm-rule WHEN: Protecting routes that require specific user roles
     * @llm-rule AVOID: Using without requireLoginToken - this assumes user is already authenticated
     * @llm-rule AVOID: Using with API tokens - API tokens don't have user roles
     * @llm-rule NOTE: User needs ANY role from the array (OR logic)
     * @llm-rule NOTE: Role inheritance applies - admin.org can access admin.tenant routes
     */
    requireUserRoles(requiredRoles: string[]): ExpressMiddleware;
    /**
     * Creates Express permission-based authorization middleware for authenticated users
     * @llm-rule WHEN: Protecting routes that require specific user permissions
     * @llm-rule AVOID: Using without requireLoginToken - this assumes user is already authenticated
     * @llm-rule AVOID: Using with API tokens - API tokens don't have user permissions
     * @llm-rule NOTE: User needs ALL permissions from the array (AND logic)
     * @llm-rule NOTE: Permission inheritance applies - manage:tenant can access edit:tenant routes
     */
    requireUserPermissions(requiredPermissions: string[]): ExpressMiddleware;
    /**
     * Creates Express API token authentication middleware for external access
     * @llm-rule WHEN: Protecting API routes for third-party integrations
     * @llm-rule AVOID: Using for user routes - use requireLoginToken instead
     * @llm-rule NOTE: Validates API tokens (type: 'api_key') and sets req.token
     */
    requireApiToken(options?: MiddlewareOptions): ExpressMiddleware;
    /**
     * Gets default token extractor that checks headers, cookies, and query params
     * @llm-rule WHEN: Need custom token extraction logic
     * @llm-rule AVOID: Modifying directly - pass custom getToken to middleware options
     */
    private getDefaultTokenExtractor;
}
//# sourceMappingURL=auth.d.ts.map