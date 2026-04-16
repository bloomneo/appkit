/**
 * Ultra-simple role-level-permission authentication that just works
 * @module @bloomneo/appkit/auth
 * @file src/auth/index.ts
 * 
 * @llm-rule WHEN: Building apps that need authentication with user roles and permissions
 * @llm-rule AVOID: Complex auth setups with multiple libraries - this handles JWT + bcrypt + middleware in one API
 * @llm-rule NOTE: Uses role.level hierarchy (user.basic → admin.system) with automatic inheritance
 * @llm-rule NOTE: Common pattern - auth.requireLoginToken() → auth.requireUserRoles() → handler
 * @llm-rule NOTE: Safe user access - const user = auth.getUser(req); if (!user) return error;
 */

import { AuthenticationClass } from './auth.js';
import { getSmartDefaults, validateAuthConfig, type AuthConfig, type RoleHierarchy } from './defaults.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/auth/README.md';

// Global authentication instance for performance
let globalAuthentication: AuthenticationClass | null = null;

/**
 * Get authentication instance - the only function you need to learn
 * Environment variables parsed once for performance
 * @llm-rule WHEN: Starting any auth operation - this is your main entry point
 * @llm-rule AVOID: Calling new AuthenticationClass() directly - always use this function
 * @llm-rule AVOID: Passing overrides after first call - they THROW; use reset(newConfig) to rebuild with new config
 * @llm-rule NOTE: Typical flow - get() → generateLoginToken() → middleware → getUser(req)
 */
function get(overrides: Partial<AuthConfig> = {}): AuthenticationClass {
  if (globalAuthentication) {
    if (overrides && Object.keys(overrides).length > 0) {
      throw new Error(
        `[@bloomneo/appkit/auth] authClass.get() overrides are only applied on first call. Use authClass.reset(newConfig) to rebuild with new config. See: ${DOCS_URL}#configuration`
      );
    }
    return globalAuthentication;
  }

  const defaults = getSmartDefaults();
  const config: AuthConfig = { ...defaults, ...overrides };
  validateAuthConfig(config);
  globalAuthentication = new AuthenticationClass(config);
  return globalAuthentication;
}

/**
 * Reset global instance (useful for testing or config changes)
 * @llm-rule WHEN: Testing auth logic with different configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
function reset(newConfig: Partial<AuthConfig> = {}): AuthenticationClass {
  const defaults = getSmartDefaults();
  const config: AuthConfig = { ...defaults, ...newConfig };
  validateAuthConfig(config);
  globalAuthentication = new AuthenticationClass(config);
  return globalAuthentication;
}

/**
 * Get current role hierarchy for inspection
 * @llm-rule WHEN: Need to see available role.levels for debugging or UI
 * @llm-rule AVOID: Using for authorization logic - use hasRole() method instead
 */
function getRoles(): RoleHierarchy {
  const auth = get();
  return auth.config.roles;
}

/**
 * Get current permission configuration for inspection
 * @llm-rule WHEN: Need to see default permissions for debugging or documentation
 * @llm-rule AVOID: Using for permission checks - use auth.hasPermission(user, permission) instead
 */
function getPermissions(): { coreActions: string[]; coreScopes: string[]; defaults: Record<string, string[]> } {
  const auth = get();
  return auth.config.permissions;
}

/**
 * Check if a role.level exists in current configuration
 * @llm-rule WHEN: Validating user input or config before creating tokens
 * @llm-rule AVOID: Using for runtime authorization - this is for validation only
 */
function isValidRole(roleLevel: string): boolean {
  const auth = get();
  return auth.config.roles[roleLevel] !== undefined;
}

/**
 * Get all available role.levels in hierarchy order
 * @llm-rule WHEN: Building role selection UI or generating documentation
 * @llm-rule AVOID: Hardcoding role lists - use this to stay in sync with config
 */
function getAllRoles(): string[] {
  const auth = get();
  const roles = auth.config.roles;

  return Object.keys(roles).sort((a, b) => roles[a].level - roles[b].level);
}

/**
 * Single authentication export with minimal functionality
 */
export const authClass = {
  // Core method
  get,
  
  // Utility methods
  reset,
  getRoles,
  getPermissions,
  isValidRole,
  getAllRoles,
} as const;

// Re-export types for consumers
export type {
  AuthConfig,
  RoleConfig,
  RoleHierarchy,
  PermissionDefaults,
} from './defaults.js';

export type {
  JwtPayload,
  LoginTokenPayload,
  ApiTokenPayload,
  ExpressRequest,
  ExpressResponse,
  MiddlewareOptions,
  ExpressMiddleware,
} from './auth.js';

export { AuthenticationClass, TokenError } from './auth.js';

// Default export
export default authClass;