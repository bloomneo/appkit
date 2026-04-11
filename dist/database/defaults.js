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
 * @file src/database/defaults.js
 *
 * @llm-rule WHEN: App startup - need to validate database environment configuration
 * @llm-rule AVOID: Calling multiple times - expensive validation, use once at startup
 * @llm-rule NOTE: All tenant tables MUST have tenant_id text field (nullable)
 */
export function validateTenantId(tenantId) {
    return typeof tenantId === 'string' && /^[a-zA-Z0-9_-]+$/.test(tenantId) && tenantId.length <= 63;
}
export function validateOrgId(orgId) {
    return typeof orgId === 'string' && /^[a-zA-Z0-9_-]+$/.test(orgId) && orgId.length <= 63;
}
export function validateDatabaseUrl(url) {
    if (!url || typeof url !== 'string')
        return false;
    if (!url.includes('://'))
        return false;
    if (url.includes('..') || url.includes('<') || url.includes('>'))
        return false;
    return [
        'postgresql://', 'postgres://', 'mysql://',
        'mongodb://', 'mongodb+srv://', 'sqlite://'
    ].some(protocol => url.startsWith(protocol));
}
class DatabaseError extends Error {
    statusCode;
    details; // or use a more specific type like `Record<string, any>`
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.name = 'DatabaseError';
        this.statusCode = statusCode;
        this.details = details;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DatabaseError);
        }
    }
}
export function createDatabaseError(message, statusCode = 500, details = null) {
    return new DatabaseError(message, statusCode, details);
}
export function detectProvider(url) {
    if (!url)
        return 'unknown';
    if (url.includes('postgresql://') || url.includes('postgres://'))
        return 'postgresql';
    if (url.includes('mysql://'))
        return 'mysql';
    if (url.includes('mongodb://') || url.includes('mongodb+srv://'))
        return 'mongodb';
    if (url.includes('sqlite://'))
        return 'sqlite';
    return 'unknown';
}
export function detectAdapter(url) {
    const provider = detectProvider(url);
    if (provider === 'mongodb')
        return 'mongoose';
    return 'prisma';
}
export function sanitizeDatabaseName(name) {
    if (!name || typeof name !== 'string') {
        throw createDatabaseError('Database name must be a non-empty string', 400);
    }
    return name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}
export function getOrgEnvironmentVars() {
    const orgVars = {};
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('ORG_') && key !== 'ORG_') {
            const orgId = key.replace('ORG_', '').toLowerCase();
            const url = process.env[key];
            if (url && validateDatabaseUrl(url)) {
                orgVars[orgId] = url;
            }
            else {
                console.warn(`Invalid database URL for organization '${orgId}': ${url}`);
            }
        }
    });
    return orgVars;
}
export function validateEnvironment() {
    const errors = [];
    const warnings = [];
    const config = {
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
    }
    else if (!validateDatabaseUrl(databaseUrl)) {
        errors.push(`Invalid DATABASE_URL format: ${databaseUrl}`);
    }
    else {
        config.hasDatabase = true;
    }
    const tenantMode = process.env.BLOOM_DB_TENANT;
    if (tenantMode) {
        const mode = tenantMode.toLowerCase();
        if (['true', 'auto'].includes(mode)) {
            config.hasTenants = true;
        }
        else if (mode !== 'false') {
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
    }
    else if (!['development', 'production', 'test'].includes(nodeEnv)) {
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
        console.warn('⚠️  [AppKit] Database configuration warnings:');
        validation.warnings.forEach((w) => console.warn(`   ${w}`));
    }
    if (!validation.valid) {
        throw createDatabaseError(`Database configuration errors:\n${validation.errors.join('\n')}`, 500, { validation });
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
export async function validateSchema(client, requiredField = 'tenant_id') {
    if (process.env.NODE_ENV !== 'development')
        return { valid: true, warnings: [] };
    const warnings = [];
    try {
        if (client.$queryRaw) {
            const models = Object.keys(client).filter(key => typeof client[key] === 'object' && typeof client[key].findFirst === 'function');
            for (const model of models) {
                try {
                    await client[model].findFirst({ where: { [requiredField]: null }, take: 1 });
                }
                catch (e) {
                    if (e.message.includes(requiredField)) {
                        warnings.push(`Prisma model '${model}' missing field '${requiredField}'`);
                    }
                }
            }
        }
        else if (client.models) {
            const models = Object.keys(client.models);
            for (const modelName of models) {
                const model = client.models[modelName];
                if (!model.schema.paths[requiredField]) {
                    warnings.push(`Mongoose model '${modelName}' missing field '${requiredField}'`);
                }
            }
        }
        return { valid: warnings.length === 0, warnings };
    }
    catch (error) {
        return { valid: false, warnings: [`Schema validation failed: ${error.message}`] };
    }
}
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
export function maskUrl(url) {
    if (!url || typeof url !== 'string')
        return '[invalid-url]';
    try {
        return url.replace(/:\/\/[^@]*@/, '://***:***@');
    }
    catch {
        return '[masked-url]';
    }
}
export function getConfigSummary() {
    const config = getSmartDefaults();
    return {
        database: {
            provider: config.database.provider,
            adapter: config.database.adapter,
            url: maskUrl(config.database.url || ''),
        },
        tenant: {
            enabled: config.tenant.enabled,
            mode: config.tenant.mode,
        },
        org: {
            enabled: config.org.enabled,
            count: config.org.count,
            organizations: Object.keys(config.org.urls),
        },
        environment: config.environment.nodeEnv,
        validation: {
            valid: config.validation.valid,
            warningCount: config.validation.warnings.length,
            errorCount: config.validation.errors.length,
        },
    };
}
let cachedValidation = null;
export function getCachedValidation() {
    if (!cachedValidation) {
        cachedValidation = validateEnvironment();
    }
    return cachedValidation;
}
export function clearValidationCache() {
    cachedValidation = null;
}
//# sourceMappingURL=defaults.js.map