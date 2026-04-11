/**
 * Smart defaults and environment validation for role-level-permission authentication
 * @module @bloomneo/appkit/auth
 * @file src/auth/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to parse auth environment variables and build role hierarchy
 * @llm-rule AVOID: Calling multiple times - expensive validation, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export interface RoleConfig {
    level: number;
    inherits: string[];
}
export interface RoleHierarchy {
    [roleLevel: string]: RoleConfig;
}
export interface PermissionDefaults {
    [roleLevel: string]: string[];
}
export interface AuthConfig {
    jwt: {
        secret: string;
        expiresIn: string;
        algorithm: string;
    };
    password: {
        saltRounds: number;
    };
    roles: RoleHierarchy;
    permissions: {
        coreActions: string[];
        coreScopes: string[];
        defaults: PermissionDefaults;
    };
    user: {
        defaultRole: string;
        defaultLevel: string;
    };
    middleware: {
        tokenSources: string[];
        errorMessages: {
            noToken: string;
            invalidToken: string;
            expiredToken: string;
            insufficientRole: string;
            insufficientPermissions: string;
        };
    };
    environment: {
        isDevelopment: boolean;
        isProduction: boolean;
        nodeEnv: string;
    };
}
/**
 * Default role hierarchy with semantic level names and clear inheritance
 */
declare const DEFAULT_ROLE_HIERARCHY: RoleHierarchy;
/**
 * Core permission actions
 */
declare const CORE_ACTIONS: string[];
/**
 * Core permission scopes
 */
declare const CORE_SCOPES: string[];
/**
 * Default permissions for each role.level
 */
declare const DEFAULT_PERMISSIONS: PermissionDefaults;
/**
 * Gets smart defaults using BLOOM_AUTH_* environment variables
 * @llm-rule WHEN: App startup to get production-ready auth configuration
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule AVOID: Calling in request handlers - expensive environment parsing
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export declare function getSmartDefaults(): AuthConfig;
/**
 * Validates JWT secret strength and format
 * @llm-rule WHEN: Setting custom JWT secret for token security
 * @llm-rule AVOID: Using weak secrets - minimum 32 characters required for security
 */
export declare function validateSecret(secret: string): void;
/**
 * Validates bcrypt rounds for security and performance
 * @llm-rule WHEN: Setting custom bcrypt rounds for password hashing
 * @llm-rule AVOID: Using rounds below 8 (insecure) or above 15 (too slow)
 */
export declare function validateRounds(rounds: number): void;
/**
 * Validates role.level exists in hierarchy
 * @llm-rule WHEN: Checking if a role.level is valid before using
 * @llm-rule AVOID: Using with undefined roles - will return false
 */
export declare function validateRoleLevel(roleLevel: string, roles: RoleHierarchy): boolean;
/**
 * Validates permission format (action:scope)
 * @llm-rule WHEN: Checking if a permission string is properly formatted
 * @llm-rule AVOID: Using with malformed permissions - will return false
 */
export declare function validatePermission(permission: string): boolean;
export { DEFAULT_ROLE_HIERARCHY, DEFAULT_PERMISSIONS, CORE_ACTIONS, CORE_SCOPES, };
//# sourceMappingURL=defaults.d.ts.map