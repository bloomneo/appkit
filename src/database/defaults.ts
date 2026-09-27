/**
 * Simplified defaults and validation for AppKit Database
 * Environment-driven configuration with smart detection
 *
 * Required Environment Variables:
 * - DATABASE_URL: Database connection string
 *
 * Optional Environment Variables:
 * - BLOOM_DB_TENANT: Enable tenant mode (auto/true/false)
 *
 * @module @bloomneo/appkit/database
 * @file src/database/defaults.ts
 *
 * @llm-rule WHEN: App startup - need to validate database environment configuration
 * @llm-rule AVOID: Calling multiple times - expensive validation, use once at startup
 * @llm-rule NOTE: All tenant tables MUST have tenant_id text field (nullable)
 */

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/database/README.md';

function validateDatabaseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('<') || url.includes('>')) return false;

  // SQLite through Prisma is `file:./dev.db` — a local path, not a network URL.
  // It has no `://` authority, and `..` is a legitimate relative segment here
  // (`file:../../app.db`), so the traversal guard below must not apply to it.
  if (url.startsWith('file:')) return url.length > 'file:'.length;

  if (!url.includes('://')) return false;
  if (url.includes('..')) return false;
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
  if (url.includes('sqlite://') || url.startsWith('file:')) return 'sqlite';
  return 'unknown';
}

// Prisma is the only adapter (the Mongoose adapter was removed in 6.0).
function detectAdapter(_url: string): string {
  return 'prisma';
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

  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    warnings.push('NODE_ENV not set. Defaulting to development mode');
  } else if (!['development', 'production', 'test'].includes(nodeEnv)) {
    warnings.push(`Unusual NODE_ENV value: ${nodeEnv}`);
  }

  if (config.hasTenants && !config.hasDatabase) {
    errors.push('Tenant mode enabled but no valid DATABASE_URL found');
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
    environment: {
      isDevelopment,
      isProduction,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    validation,
  };
}
