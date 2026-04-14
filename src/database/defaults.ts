/**
 * Simplified defaults and validation for AppKit Database
 * Environment-driven configuration with smart detection
 *
 * Required Environment Variables:
 * - DATABASE_URL: Database connection string
 *
 * Optional Environment Variables:
 * - BLOOM_DB_TENANT: Enable tenant mode (auto/true/false)
 * - ORG_{NAME}: Organization-specific database URLs
 *
 * @module @bloomneo/appkit/database
 * @file src/database/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to validate database environment configuration
 * @llm-rule AVOID: Calling multiple times - expensive validation, use once at startup
 * @llm-rule NOTE: All tenant tables MUST have tenant_id text field (nullable)
 */

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/database/README.md';

function validateOrgId(orgId: string): boolean {
  return typeof orgId === 'string' && /^[a-zA-Z0-9_-]+$/.test(orgId) && orgId.length <= 63;
}

function validateDatabaseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes('://')) return false;
  if (url.includes('..') || url.includes('<') || url.includes('>')) return false;
  return [
    'postgresql://', 'postgres://', 'mysql://',
    'mongodb://', 'mongodb+srv://', 'sqlite://'
  ].some(protocol => url.startsWith(protocol));
}

class DatabaseError extends Error {
  statusCode: number;
  details: any;

  constructor(message: string, statusCode = 500, details: any = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = statusCode;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }
}

export function createDatabaseError(
  message: string,
  statusCode = 500,
  details: any = null,
  anchor = 'environment-variables'
): DatabaseError {
  const prefixed = `[@bloomneo/appkit/database] ${message}. See: ${DOCS_URL}#${anchor}`;
  return new DatabaseError(prefixed, statusCode, details);
}

function detectProvider(url: string): string {
  if (!url) return 'unknown';
  if (url.includes('postgresql://') || url.includes('postgres://')) return 'postgresql';
  if (url.includes('mysql://')) return 'mysql';
  if (url.includes('mongodb://') || url.includes('mongodb+srv://')) return 'mongodb';
  if (url.includes('sqlite://')) return 'sqlite';
  return 'unknown';
}

function detectAdapter(url: string): string {
  const provider = detectProvider(url);
  if (provider === 'mongodb') return 'mongoose';
  return 'prisma';
}

function getOrgEnvironmentVars(): Record<string, string> {
  const orgVars: Record<string, string> = {};
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('ORG_') && key !== 'ORG_') {
      const orgId = key.replace('ORG_', '').toLowerCase();
      const url = process.env[key];
      if (url && validateDatabaseUrl(url)) {
        orgVars[orgId] = url;
      } else {
        console.warn(
          `[@bloomneo/appkit/database] Invalid database URL for organization '${orgId}': ${url}. See: ${DOCS_URL}#environment-variables`
        );
      }
    }
  });
  return orgVars;
}

function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: any = {
    valid: true,
    errors,
    warnings,
    hasDatabase: false,
    hasTenants: false,
    hasOrgs: false,
    orgCount: 0,
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL environment variable is required');
  } else if (!validateDatabaseUrl(databaseUrl)) {
    errors.push(`Invalid DATABASE_URL format: ${databaseUrl}`);
  } else {
    config.hasDatabase = true;
  }

  const tenantMode = process.env.BLOOM_DB_TENANT;
  if (tenantMode) {
    const mode = tenantMode.toLowerCase();
    if (['true', 'auto'].includes(mode)) {
      config.hasTenants = true;
    } else if (mode !== 'false') {
      warnings.push(`Unknown BLOOM_DB_TENANT value: ${tenantMode}. Use 'auto', 'true', or 'false'`);
    }
  }

  const orgVars = getOrgEnvironmentVars();
  config.orgCount = Object.keys(orgVars).length;
  config.hasOrgs = config.orgCount > 0;

  Object.keys(orgVars).forEach(orgId => {
    if (!validateOrgId(orgId)) {
      warnings.push(`Invalid organization ID format: ${orgId}`);
    }
  });

  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    warnings.push('NODE_ENV not set. Defaulting to development mode');
  } else if (!['development', 'production', 'test'].includes(nodeEnv)) {
    warnings.push(`Unusual NODE_ENV value: ${nodeEnv}`);
  }

  if (config.hasTenants && !config.hasDatabase) {
    errors.push('Tenant mode enabled but no valid DATABASE_URL found');
  }

  if (config.hasOrgs && config.orgCount > 10) {
    warnings.push(`Large number of organizations configured (${config.orgCount}). Consider using dynamic URL resolution`);
  }

  config.valid = errors.length === 0;
  return config;
}

export function getSmartDefaults() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  const validation = validateEnvironment();
  if (isDevelopment && validation.warnings.length > 0) {
    console.warn(
      `[@bloomneo/appkit/database] Database configuration warnings. See: ${DOCS_URL}#environment-variables`
    );
    validation.warnings.forEach((w: string) =>
      console.warn(`[@bloomneo/appkit/database]    ${w}`)
    );
  }

  if (!validation.valid) {
    throw createDatabaseError(
      `Database configuration errors:\n${validation.errors.join('\n')}`,
      500,
      { validation } as any
    );
  }

  return {
    database: {
      url: process.env.DATABASE_URL || '',
      provider: detectProvider(process.env.DATABASE_URL || ''),
      adapter: detectAdapter(process.env.DATABASE_URL || ''),
    },
    tenant: {
      enabled: validation.hasTenants,
      mode: process.env.BLOOM_DB_TENANT?.toLowerCase() || 'false',
      fieldName: 'tenant_id',
    },
    org: {
      enabled: validation.hasOrgs,
      count: validation.orgCount,
      urls: getOrgEnvironmentVars(),
    },
    environment: {
      isDevelopment,
      isProduction,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    validation,
  };
}
