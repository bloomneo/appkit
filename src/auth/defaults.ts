/**
 * Smart defaults and environment validation for role.level authentication
 * @module @bloomneo/appkit/auth
 * @file src/auth/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to parse auth environment variables and build role hierarchy
 * @llm-rule AVOID: Calling multiple times - expensive validation, use lazy loading in get()
 * @llm-rule NOTE: Called once at startup, cached globally for performance
 */

import { AuthError } from './errors.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/auth/README.md';

export interface RoleConfig {
  level: number;
  inherits: string[];
}

export interface RoleHierarchy {
  [roleLevel: string]: RoleConfig;
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
  middleware: {
    errorMessages: {
      noToken: string;
      invalidToken: string;
      expiredToken: string;
      insufficientRole: string;
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
 * Gets smart defaults using BLOOM_AUTH_* environment variables
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
      secret: process.env.BLOOM_AUTH_SECRET!,
      expiresIn: process.env.BLOOM_AUTH_EXPIRES_IN || '7d',
      algorithm: 'HS256',
    },
    password: {
      saltRounds: parseInt(process.env.BLOOM_AUTH_BCRYPT_ROUNDS || '10'),
    },
    roles: parseRoleHierarchy(),
    middleware: {
      errorMessages: {
        noToken: 'Authentication required',
        invalidToken: 'Invalid authentication. Please sign in again.',
        expiredToken: 'Your session has expired. Please sign in again.',
        insufficientRole: 'Access denied. Insufficient role level.',
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
 * @llm-rule WHEN: App startup to build role configuration from BLOOM_AUTH_ROLES
 * @llm-rule AVOID: Using invalid role.level format - must be role.level:number
 * @llm-rule NOTE: Format: BLOOM_AUTH_ROLES=user.basic:1,admin.tenant:5,admin.system:9
 */
function parseRoleHierarchy(): RoleHierarchy {
  const envRoles = process.env.BLOOM_AUTH_ROLES;
  
  if (!envRoles) {
    return DEFAULT_ROLE_HIERARCHY;
  }

  const parsedRoles: RoleHierarchy = {};
  const rolePairs = envRoles.split(',');

  for (const rolePair of rolePairs) {
    const [roleLevel, levelStr] = rolePair.trim().split(':');
    
    if (!roleLevel || !levelStr) {
      throw new AuthError(
        `[@bloomneo/appkit/auth] Invalid BLOOM_AUTH_ROLES entry: "${rolePair}". Expected "role.level:number". See: ${DOCS_URL}#role-level-permission-architecture`,
        { code: 'AUTH_INVALID_CONFIG' }
      );
    }

    if (!validateRoleLevelFormat(roleLevel)) {
      throw new AuthError(
        `[@bloomneo/appkit/auth] Invalid role.level format: "${roleLevel}". Must be "role.level" (e.g., "admin.tenant"). See: ${DOCS_URL}#role-level-permission-architecture`,
        { code: 'AUTH_INVALID_CONFIG' }
      );
    }

    const level = parseInt(levelStr);
    if (isNaN(level) || level < 1) {
      throw new AuthError(
        `[@bloomneo/appkit/auth] Invalid level number: "${levelStr}". Must be a positive integer. See: ${DOCS_URL}#role-level-permission-architecture`,
        { code: 'AUTH_INVALID_CONFIG' }
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
 * Validates JWT secret strength and format
 * @llm-rule WHEN: Setting custom JWT secret for token security
 * @llm-rule AVOID: Using weak secrets - minimum 32 characters required for security
 */
export function validateSecret(secret: string): void {
  if (!secret || typeof secret !== 'string') {
    throw new AuthError(
      `[@bloomneo/appkit/auth] BLOOM_AUTH_SECRET is required. Set a 32+ character random string. See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_MISSING_CONFIG' }
    );
  }

  if (secret.length < 32) {
    throw new AuthError(
      `[@bloomneo/appkit/auth] BLOOM_AUTH_SECRET must be at least 32 characters (got ${secret.length}). See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_WEAK_SECRET' }
    );
  }

  if (secret === 'your-jwt-secret-key' || secret === 'secret' || secret === 'supersecret') {
    throw new AuthError(
      `[@bloomneo/appkit/auth] BLOOM_AUTH_SECRET looks like a default/example value. Use a strong random string. See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_WEAK_SECRET' }
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
    throw new AuthError(`[@bloomneo/appkit/auth] bcrypt rounds must be at least 8 for security. See: ${DOCS_URL}#configuration`, { code: 'AUTH_INVALID_CONFIG' });
  }

  if (rounds > 15) {
    throw new AuthError(`[@bloomneo/appkit/auth] bcrypt rounds should not exceed 15 (too slow). See: ${DOCS_URL}#configuration`, { code: 'AUTH_INVALID_CONFIG' });
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
 * Validates env-only fields (format of BLOOM_AUTH_BCRYPT_ROUNDS / EXPIRES_IN /
 * NODE_ENV). The JWT secret is validated later by validateAuthConfig() against
 * the fully-merged config — this lets overrides supply jwt.secret when the env
 * var is absent (tests, embedded usage).
 */
function validateEnvironment(): void {
  const rounds = process.env.BLOOM_AUTH_BCRYPT_ROUNDS;
  if (rounds) {
    const roundsNum = parseInt(rounds);
    if (isNaN(roundsNum)) {
      throw new AuthError(
        `[@bloomneo/appkit/auth] Invalid BLOOM_AUTH_BCRYPT_ROUNDS: "${rounds}". Must be a number between 8 and 15. See: ${DOCS_URL}#configuration`,
        { code: 'AUTH_INVALID_CONFIG' }
      );
    }
    validateRounds(roundsNum);
  }

  const expiresIn = process.env.BLOOM_AUTH_EXPIRES_IN;
  if (expiresIn && !isValidTimespan(expiresIn)) {
    throw new AuthError(
      `[@bloomneo/appkit/auth] Invalid BLOOM_AUTH_EXPIRES_IN: "${expiresIn}". Must be a valid time span (e.g. '7d', '1h', '30m'). See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_INVALID_CONFIG' }
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    console.warn(
      `[@bloomneo/appkit/auth] Unusual NODE_ENV: "${nodeEnv}". Expected: development, production, or test.`
    );
  }
}

/**
 * Validates a fully-merged AuthConfig (defaults + overrides).
 * @llm-rule WHEN: After merging user overrides into smart defaults
 * @llm-rule AVOID: Skipping this — overrides bypass env validation otherwise
 */
export function validateAuthConfig(config: AuthConfig): void {
  if (!config?.jwt?.secret) {
    throw new AuthError(
      `[@bloomneo/appkit/auth] JWT secret required. Set BLOOM_AUTH_SECRET or pass jwt.secret in overrides. See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_MISSING_CONFIG' }
    );
  }
  validateSecret(config.jwt.secret);

  if (typeof config.password?.saltRounds !== 'number' || isNaN(config.password.saltRounds)) {
    throw new AuthError(
      `[@bloomneo/appkit/auth] password.saltRounds must be a number between 8 and 15. See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_INVALID_CONFIG' }
    );
  }
  validateRounds(config.password.saltRounds);

  if (config.jwt.expiresIn && !isValidTimespan(config.jwt.expiresIn)) {
    throw new AuthError(
      `[@bloomneo/appkit/auth] Invalid jwt.expiresIn: "${config.jwt.expiresIn}". Must be a valid time span (e.g. '7d', '1h', '30m'). See: ${DOCS_URL}#configuration`,
      { code: 'AUTH_INVALID_CONFIG' }
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
};