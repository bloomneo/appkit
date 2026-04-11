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
const DEFAULT_ROLE_HIERARCHY: RoleHierarchy = {
  'user.basic': {
    level: 1,
    inherits: [],
  },
  'user.pro': {
    level: 2,
    inherits: ['user.basic'],
  },
  'user.max': {
    level: 3,
    inherits: ['user.pro', 'user.basic'],
  },
  'moderator.review': {
    level: 4,
    inherits: ['user.max', 'user.pro', 'user.basic'],
  },
  'moderator.approve': {
    level: 5,
    inherits: ['moderator.review', 'user.max', 'user.pro', 'user.basic'],
  },
  'moderator.manage': {
    level: 6,
    inherits: ['moderator.approve', 'moderator.review', 'user.max', 'user.pro', 'user.basic'],
  },
  'admin.tenant': {
    level: 7,
    inherits: ['moderator.manage', 'moderator.approve', 'moderator.review', 'user.max', 'user.pro', 'user.basic'],
  },
  'admin.org': {
    level: 8,
    inherits: ['admin.tenant', 'moderator.manage', 'moderator.approve', 'moderator.review', 'user.max', 'user.pro', 'user.basic'],
  },
  'admin.system': {
    level: 9,
    inherits: ['admin.org', 'admin.tenant', 'moderator.manage', 'moderator.approve', 'moderator.review', 'user.max', 'user.pro', 'user.basic'],
  },
};

/**
 * Core permission actions
 */
const CORE_ACTIONS = ['view', 'create', 'edit', 'delete', 'manage'];

/**
 * Core permission scopes
 */
const CORE_SCOPES = ['own', 'tenant', 'org', 'system'];

/**
 * Default permissions for each role.level
 */
const DEFAULT_PERMISSIONS: PermissionDefaults = {
  'user.basic': ['manage:own'],
  'user.pro': ['manage:own'],
  'user.max': ['manage:own'],
  'moderator.review': ['view:tenant'],
  'moderator.approve': ['view:tenant', 'create:tenant', 'edit:tenant'],
  'moderator.manage': ['view:tenant', 'create:tenant', 'edit:tenant'],
  'admin.tenant': ['manage:tenant'],
  'admin.org': ['manage:tenant', 'manage:org'],
  'admin.system': ['manage:tenant', 'manage:org', 'manage:system'],
};

/**
 * Gets smart defaults using VOILA_AUTH_* environment variables
 * @llm-rule WHEN: App startup to get production-ready auth configuration
 * @llm-rule AVOID: Calling repeatedly - validates environment each time, expensive operation
 * @llm-rule AVOID: Calling in request handlers - expensive environment parsing
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */
export function getSmartDefaults(): AuthConfig {
  validateEnvironment();

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    jwt: {
      secret: process.env.VOILA_AUTH_SECRET!,
      expiresIn: process.env.VOILA_AUTH_EXPIRES_IN || '7d',
      algorithm: 'HS256',
    },
    password: {
      saltRounds: parseInt(process.env.VOILA_AUTH_BCRYPT_ROUNDS || '10'),
    },
    roles: parseRoleHierarchy(),
    permissions: {
      coreActions: CORE_ACTIONS,
      coreScopes: CORE_SCOPES,
      defaults: parseDefaultPermissions(),
    },
    user: {
      defaultRole: process.env.VOILA_AUTH_DEFAULT_ROLE || 'user',
      defaultLevel: process.env.VOILA_AUTH_DEFAULT_LEVEL || 'basic',
    },
    middleware: {
      tokenSources: ['header', 'cookie', 'query'],
      errorMessages: {
        noToken: 'Authentication required',
        invalidToken: 'Invalid authentication. Please sign in again.',
        expiredToken: 'Your session has expired. Please sign in again.',
        insufficientRole: 'Access denied. Insufficient role level.',
        insufficientPermissions: 'Access denied. Insufficient permissions.',
      },
    },
    environment: {
      isDevelopment,
      isProduction,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

/**
 * Parses role hierarchy from environment variable or uses defaults
 * @llm-rule WHEN: App startup to build role configuration from VOILA_AUTH_ROLES
 * @llm-rule AVOID: Using invalid role.level format - must be role.level:number
 * @llm-rule NOTE: Format: VOILA_AUTH_ROLES=user.basic:1,admin.tenant:5,admin.system:9
 */
function parseRoleHierarchy(): RoleHierarchy {
  const envRoles = process.env.VOILA_AUTH_ROLES;
  
  if (!envRoles) {
    return DEFAULT_ROLE_HIERARCHY;
  }

  const parsedRoles: RoleHierarchy = {};
  const rolePairs = envRoles.split(',');

  for (const rolePair of rolePairs) {
    const [roleLevel, levelStr] = rolePair.trim().split(':');
    
    if (!roleLevel || !levelStr) {
      throw new Error(
        `Invalid VOILA_AUTH_ROLES format: "${rolePair}". Expected format: "role.level:number"`
      );
    }

    if (!validateRoleLevelFormat(roleLevel)) {
      throw new Error(
        `Invalid role.level format: "${roleLevel}". Must be "role.level" (e.g., "admin.tenant")`
      );
    }

    const level = parseInt(levelStr);
    if (isNaN(level) || level < 1) {
      throw new Error(
        `Invalid level number: "${levelStr}". Must be a positive integer`
      );
    }

    parsedRoles[roleLevel] = {
      level,
      inherits: [], // Inheritance calculated based on levels
    };
  }

  // Calculate inheritance based on levels
  const sortedRoles = Object.keys(parsedRoles).sort((a, b) => 
    parsedRoles[a].level - parsedRoles[b].level
  );

  for (const roleLevel of sortedRoles) {
    const currentLevel = parsedRoles[roleLevel].level;
    parsedRoles[roleLevel].inherits = sortedRoles.filter(other => 
      parsedRoles[other].level < currentLevel
    );
  }

  return parsedRoles;
}

/**
 * Parses permission defaults from environment variable or uses defaults
 * @llm-rule WHEN: App startup to build permission configuration from VOILA_AUTH_PERMISSIONS
 * @llm-rule AVOID: Using invalid permission format - must be action:scope
 * @llm-rule NOTE: Format: VOILA_AUTH_PERMISSIONS=user.basic:view:own,admin.tenant:manage:tenant
 */
function parseDefaultPermissions(): PermissionDefaults {
  const envPermissions = process.env.VOILA_AUTH_PERMISSIONS;
  
  if (!envPermissions) {
    return DEFAULT_PERMISSIONS;
  }

  const parsedPermissions: PermissionDefaults = {};
  const permissionPairs = envPermissions.split(',');

  for (const permissionPair of permissionPairs) {
    const parts = permissionPair.trim().split(':');
    
    if (parts.length !== 3) {
      throw new Error(
        `Invalid VOILA_AUTH_PERMISSIONS format: "${permissionPair}". Expected format: "role.level:action:scope"`
      );
    }

    const [roleLevel, action, scope] = parts;
    const permission = `${action}:${scope}`;

    if (!validateRoleLevelFormat(roleLevel)) {
      throw new Error(
        `Invalid role.level format: "${roleLevel}". Must be "role.level" (e.g., "admin.tenant")`
      );
    }

    if (!validatePermissionFormat(permission)) {
      throw new Error(
        `Invalid permission format: "${permission}". Must be "action:scope" (e.g., "manage:tenant")`
      );
    }

    if (!parsedPermissions[roleLevel]) {
      parsedPermissions[roleLevel] = [];
    }

    if (!parsedPermissions[roleLevel].includes(permission)) {
      parsedPermissions[roleLevel].push(permission);
    }
  }

  return parsedPermissions;
}

/**
 * Validates JWT secret strength and format
 * @llm-rule WHEN: Setting custom JWT secret for token security
 * @llm-rule AVOID: Using weak secrets - minimum 32 characters required for security
 */
export function validateSecret(secret: string): void {
  if (!secret || typeof secret !== 'string') {
    console.error('\n🚨 ============================================');
    console.error('❌ CRITICAL AUTH CONFIGURATION ERROR');
    console.error('🚨 ============================================');
    console.error('🔑 MISSING REQUIRED ENVIRONMENT VARIABLE: VOILA_AUTH_SECRET');
    console.error('🚨 ============================================\n');

    throw new Error(
      'VOILA_AUTH_SECRET is required. Set environment variable: VOILA_AUTH_SECRET=your-jwt-secret-key'
    );
  }

  if (secret.length < 32) {
    console.error('\n🚨 ============================================');
    console.error('❌ AUTH SECRET TOO SHORT');
    console.error('🚨 ============================================');
    console.error(`🔑 Current length: ${secret.length} characters (minimum: 32)`);
    console.error('🚨 ============================================\n');

    throw new Error(
      `VOILA_AUTH_SECRET must be at least 32 characters for security. Current length: ${secret.length}`
    );
  }

  if (secret === 'your-jwt-secret-key' || secret === 'secret' || secret === 'supersecret') {
    console.error('\n🚨 ============================================');
    console.error('❌ INSECURE AUTH SECRET DETECTED');
    console.error('🚨 ============================================');
    console.error('🔑 VOILA_AUTH_SECRET appears to be a default/example value');
    console.error('⚠️  This is a security risk in production!');
    console.error('');
    console.error('💡 SOLUTION:');
    console.error('   Generate a strong, random secret:');
    console.error('   VOILA_AUTH_SECRET=k8s9m2n4p7q1w3e5r8t0y2u4i6o9a1s5d7f9g2h4j6l8');
    console.error('🚨 ============================================\n');

    throw new Error(
      'VOILA_AUTH_SECRET appears to be a default/example value. Use a strong, random secret'
    );
  }
}

/**
 * Validates bcrypt rounds for security and performance
 * @llm-rule WHEN: Setting custom bcrypt rounds for password hashing
 * @llm-rule AVOID: Using rounds below 8 (insecure) or above 15 (too slow)
 */
export function validateRounds(rounds: number): void {
  if (rounds < 8) {
    throw new Error('Bcrypt rounds must be at least 8 for security');
  }

  if (rounds > 15) {
    throw new Error('Bcrypt rounds should not exceed 15 for performance');
  }
}

/**
 * Validates role.level exists in hierarchy
 * @llm-rule WHEN: Checking if a role.level is valid before using
 * @llm-rule AVOID: Using with undefined roles - will return false
 */
export function validateRoleLevel(roleLevel: string, roles: RoleHierarchy): boolean {
  if (!roleLevel || typeof roleLevel !== 'string') {
    return false;
  }

  return roles[roleLevel] !== undefined;
}

/**
 * Validates permission format (action:scope)
 * @llm-rule WHEN: Checking if a permission string is properly formatted
 * @llm-rule AVOID: Using with malformed permissions - will return false
 */
export function validatePermission(permission: string): boolean {
  if (!permission || typeof permission !== 'string') {
    return false;
  }

  return validatePermissionFormat(permission);
}

/**
 * Validates role.level format
 */
function validateRoleLevelFormat(roleLevel: string): boolean {
  if (!roleLevel || typeof roleLevel !== 'string') {
    return false;
  }

  // Must be in format: role.level (e.g., "admin.tenant")
  const parts = roleLevel.split('.');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Validates permission format
 */
function validatePermissionFormat(permission: string): boolean {
  if (!permission || typeof permission !== 'string') {
    return false;
  }

  // Must be in format: action:scope (e.g., "manage:tenant")
  const parts = permission.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [action, scope] = parts;
  return action.length > 0 && scope.length > 0;
}

/**
 * Enhanced environment validation with better error messages
 */
function validateEnvironment(): void {
  const secret = process.env.VOILA_AUTH_SECRET;

  // Enhanced validation with clear console logging and better error messages
  if (!secret) {
    console.error('\n🚨 ============================================');
    console.error('❌ CRITICAL AUTH CONFIGURATION ERROR');
    console.error('🚨 ============================================');
    console.error('🔑 MISSING REQUIRED ENVIRONMENT VARIABLE: VOILA_AUTH_SECRET');
    console.error('');
    console.error('💡 SOLUTION:');
    console.error('   Add the following to your .env file:');
    console.error('   VOILA_AUTH_SECRET=your-secure-32-character-secret-key-here');
    console.error('');
    console.error('📋 REQUIREMENTS:');
    console.error('   - Must be at least 32 characters long');
    console.error('   - Should be a strong, random string');
    console.error('   - Do not use default values like "secret" or "supersecret"');
    console.error('');
    console.error('🔧 EXAMPLE:');
    console.error('   VOILA_AUTH_SECRET=k8s9m2n4p7q1w3e5r8t0y2u4i6o9a1s5d7f9g2h4j6l8');
    console.error('');
    console.error('⚠️  Without this variable, authentication features will not work');
    console.error('🚨 ============================================\n');

    throw new Error(
      'VOILA_AUTH_SECRET is required. Set environment variable: VOILA_AUTH_SECRET=your-jwt-secret-key'
    );
  }

  if (secret.length < 32) {
    console.error('\n🚨 ============================================');
    console.error('❌ AUTH SECRET TOO SHORT');
    console.error('🚨 ============================================');
    console.error(`🔑 Current VOILA_AUTH_SECRET length: ${secret.length} characters`);
    console.error('⚠️  Minimum required: 32 characters');
    console.error('');
    console.error('💡 SOLUTION:');
    console.error('   Generate a stronger secret with at least 32 characters');
    console.error('');
    console.error('🔧 EXAMPLE:');
    console.error('   VOILA_AUTH_SECRET=k8s9m2n4p7q1w3e5r8t0y2u4i6o9a1s5d7f9g2h4j6l8');
    console.error('🚨 ============================================\n');

    throw new Error(
      `VOILA_AUTH_SECRET must be at least 32 characters for security. Current length: ${secret.length}`
    );
  }
  
  validateSecret(secret);

  const rounds = process.env.VOILA_AUTH_BCRYPT_ROUNDS;
  if (rounds) {
    const roundsNum = parseInt(rounds);
    if (isNaN(roundsNum)) {
      throw new Error(
        `Invalid VOILA_AUTH_BCRYPT_ROUNDS: "${rounds}". Must be a number between 8 and 15`
      );
    }
    validateRounds(roundsNum);
  }

  const expiresIn = process.env.VOILA_AUTH_EXPIRES_IN;
  if (expiresIn && !isValidTimespan(expiresIn)) {
    throw new Error(
      `Invalid VOILA_AUTH_EXPIRES_IN: "${expiresIn}". Must be a valid time span (e.g., '7d', '1h', '30m')`
    );
  }

  const defaultRole = process.env.VOILA_AUTH_DEFAULT_ROLE;
  const defaultLevel = process.env.VOILA_AUTH_DEFAULT_LEVEL;
  if (defaultRole && defaultLevel) {
    const roleLevel = `${defaultRole}.${defaultLevel}`;
    const roles = parseRoleHierarchy();
    if (!validateRoleLevel(roleLevel, roles)) {
      const validRoles = Object.keys(roles).join(', ');
      throw new Error(
        `Invalid VOILA_AUTH_DEFAULT_ROLE.LEVEL: "${roleLevel}". Must be one of: ${validRoles}`
      );
    }
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    console.warn(
      `Unusual NODE_ENV: "${nodeEnv}". Expected: development, production, or test`
    );
  }
}

/**
 * Validates if a string is a valid JWT timespan
 */
function isValidTimespan(timespan: string | number): boolean {
  if (typeof timespan === 'number') {
    return timespan > 0;
  }

  if (typeof timespan === 'string') {
    return /^\d+[smhdwy]$/.test(timespan.toLowerCase());
  }

  return false;
}

export {
  DEFAULT_ROLE_HIERARCHY,
  DEFAULT_PERMISSIONS,
  CORE_ACTIONS,
  CORE_SCOPES,
};