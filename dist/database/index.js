/**
 * Ultra-simple database API with org/tenant support and smart connection management
 * @module @bloomneo/appkit/database
 * @file src/database/index.ts
 *
 * @llm-rule WHEN: ALWAYS add tenant_id text field to ALL tables (nullable for future compatibility)
 * @llm-rule NOTE: tenant_id = null (single tenant) or "team-1" (multi-tenant)
 * @llm-rule VARIABLE: const db = await databaseClass.get() - user's data (single or tenant-filtered)
 * @llm-rule VARIABLE: const dbTenants = await databaseClass.getTenants() - all tenants (admin access)
 * @llm-rule VARIABLE: const {orgName}Db = await databaseClass.org('{orgName}').get() - org-specific data
 * @llm-rule VARIABLE: const {orgName}DbTenants = await databaseClass.org('{orgName}').getTenants() - all tenants in org
 */
import fs from 'fs';
import { PrismaAdapter } from './adapters/prisma.js';
import { MongooseAdapter } from './adapters/mongoose.js';
// Global instances cache for performance
const connections = new Map();
let envWatcher = null;
/**
 * Environment file watcher for hot reload
 */
function setupEnvWatcher() {
    if (envWatcher)
        return;
    try {
        envWatcher = fs.watch('.env', (eventType) => {
            if (eventType === 'change') {
                // Clear require cache and reload
                delete require.cache[require.resolve('dotenv')];
                require('dotenv').config();
                // Clear connection cache to use new URLs
                connections.clear();
                if (process.env.NODE_ENV === 'development') {
                    console.log('🔄 [AppKit] .env file reloaded, connections reset');
                }
            }
        });
    }
    catch (error) {
        // .env file doesn't exist or can't be watched - continue without watching
    }
}
/**
 * Detect organization from request context
 */
function detectOrg(req) {
    if (!req)
        return null;
    return (req.headers?.['x-org-id'] ||
        req.user?.org_id ||
        req.params?.orgId ||
        req.query?.org ||
        extractFromSubdomain(req, 'org') ||
        null);
}
/**
 * Detect tenant from request context
 */
function detectTenant(req) {
    if (!req)
        return null;
    if (!process.env.VOILA_DB_TENANT)
        return null;
    return (req.headers?.['x-tenant-id'] ||
        req.user?.tenant_id ||
        req.params?.tenantId ||
        req.query?.tenant ||
        extractFromSubdomain(req, 'tenant') ||
        null);
}
/**
 * Extract org/tenant from subdomain
 */
function extractFromSubdomain(req, type) {
    try {
        const host = req.headers?.host || req.hostname;
        if (!host)
            return null;
        const parts = host.split('.');
        if (parts.length >= 3) {
            const subdomain = parts[0];
            // Skip common subdomains
            if (!['www', 'api', 'admin', 'app'].includes(subdomain)) {
                return subdomain;
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Auto-detect database adapter from URL
 */
function detectAdapter(url) {
    if (url.includes('postgresql') || url.includes('postgres')) {
        return 'prisma';
    }
    if (url.includes('mongodb')) {
        return 'mongoose';
    }
    return 'prisma'; // Default fallback
}
/**
 * Get database URL for organization
 */
function getOrgUrl(orgId) {
    if (!orgId)
        return process.env.DATABASE_URL || '';
    // Check for specific org URL
    const orgUrl = process.env[`ORG_${orgId.toUpperCase()}`];
    if (orgUrl)
        return orgUrl;
    // Check for pattern in base URL
    const baseUrl = process.env.DATABASE_URL;
    if (baseUrl?.includes('{org}')) {
        return baseUrl.replace('{org}', orgId);
    }
    return baseUrl || '';
}
/**
 * Create database client with caching
 */
async function createClient(url, tenantId = null, orgId = null) {
    const cacheKey = `${url}_${tenantId || 'null'}_${orgId || 'null'}`;
    if (connections.has(cacheKey)) {
        return connections.get(cacheKey);
    }
    try {
        // Detect and create adapter
        const adapterType = detectAdapter(url);
        const adapter = adapterType === 'mongoose' ? new MongooseAdapter({ url }) : new PrismaAdapter({ url });
        // Create client
        let client = await adapter.createClient({ url });
        // Apply tenant middleware if needed
        if (tenantId && adapter.applyTenantMiddleware) {
            client = await adapter.applyTenantMiddleware(client, tenantId, {
                fieldName: 'tenant_id',
                orgId
            });
        }
        // Add metadata
        client._appKit = true;
        client._orgId = orgId || undefined;
        client._tenantId = tenantId || undefined;
        client._url = url;
        // Cache connection
        connections.set(cacheKey, client);
        return client;
    }
    catch (error) {
        throw new Error(`Failed to create database connection: ${error.message}`);
    }
}
/**
 * Organization database builder
 */
class OrgDatabase {
    orgId;
    constructor(orgId) {
        this.orgId = orgId;
    }
    /**
     * Get organization database (tenant-filtered if tenant mode enabled)
     */
    async get(req = null) {
        const tenantId = detectTenant(req);
        const url = getOrgUrl(this.orgId);
        if (!url) {
            throw new Error(`No database URL found for organization '${this.orgId}'`);
        }
        return await createClient(url, tenantId, this.orgId);
    }
    /**
     * Get all tenants in organization (admin access)
     */
    async getTenants(req = null) {
        const url = getOrgUrl(this.orgId);
        if (!url) {
            throw new Error(`No database URL found for organization '${this.orgId}'`);
        }
        // No tenant filtering - admin sees all data
        return await createClient(url, null, this.orgId);
    }
}
/**
 * Main database API - ultra-simple like auth module
 */
export const databaseClass = {
    /**
     * Get database client - main function that handles all contexts
     * @param {Object} [req] - Request object for context detection
     * @returns {Promise<DatabaseClientUnion>} Database client
     */
    async get(req = null) {
        // Setup env watching on first use
        setupEnvWatcher();
        // Detect context
        const orgId = detectOrg(req);
        const tenantId = detectTenant(req);
        // Get appropriate URL
        const url = getOrgUrl(orgId || undefined) || process.env.DATABASE_URL;
        if (!url) {
            throw new Error('Database URL required. Set DATABASE_URL environment variable');
        }
        return await createClient(url, tenantId, orgId);
    },
    /**
     * Get all tenants data (admin access - no tenant filtering)
     * @param {Object} [req] - Request object for org context
     * @returns {Promise<DatabaseClientUnion>} Database client with no tenant filtering
     */
    async getTenants(req = null) {
        setupEnvWatcher();
        const orgId = detectOrg(req);
        const url = getOrgUrl(orgId || undefined) || process.env.DATABASE_URL;
        if (!url) {
            throw new Error('Database URL required. Set DATABASE_URL environment variable');
        }
        // No tenant filtering - admin sees all data
        return await createClient(url, null, orgId);
    },
    /**
     * Get organization-specific database
     * @param {string} orgId - Organization ID
     * @returns {OrgDatabase} Organization database instance
     */
    org(orgId) {
        if (!orgId || typeof orgId !== 'string') {
            throw new Error('Organization ID is required and must be a string');
        }
        return new OrgDatabase(orgId);
    },
    /**
     * Health check for database connections
     * @returns {Promise<Object>} Health status
     */
    async health() {
        try {
            const db = await this.get();
            // Simple connectivity test
            if (db.$queryRaw) {
                // Prisma client
                await db.$queryRaw `SELECT 1`;
            }
            else if (db.db) {
                // Mongoose connection
                await db.db.admin().ping();
            }
            return {
                healthy: true,
                connections: connections.size,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                healthy: false,
                error: error.message,
                connections: connections.size,
                timestamp: new Date().toISOString(),
            };
        }
    },
    /**
     * List tenants in current context
     * @param {Object} [req] - Request object for org context
     * @returns {Promise<string[]>} Array of tenant IDs
     */
    async list(req = null) {
        try {
            const db = await this.getTenants(req);
            return await this._getDistinctTenantIds(db);
        }
        catch (error) {
            throw new Error(`Failed to list tenants: ${error.message}`);
        }
    },
    /**
     * Check if tenant exists
     * @param {string} tenantId - Tenant ID
     * @param {Object} [req] - Request object for org context
     * @returns {Promise<boolean>} Whether tenant exists
     */
    async exists(tenantId, req = null) {
        if (!tenantId)
            return false;
        try {
            const db = await this.getTenants(req);
            return await this._tenantHasData(db, tenantId);
        }
        catch {
            return false;
        }
    },
    /**
     * Create tenant (registers tenant for future use)
     * @param {string} tenantId - Tenant ID
     * @param {Object} [req] - Request object for org context
     * @returns {Promise<void>}
     */
    async create(tenantId, req = null) {
        if (!tenantId || typeof tenantId !== 'string') {
            throw new Error('Tenant ID is required and must be a string');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
            throw new Error('Invalid tenant ID format. Use alphanumeric characters, underscores, and hyphens only');
        }
        // For row-level strategy, tenant creation is implicit
        // The tenant exists when first record with tenant_id is created
        // This method can be used to validate the tenant ID format
    },
    /**
     * Delete all tenant data (requires confirmation)
     * @param {string} tenantId - Tenant ID
     * @param {Object} options - Options object
     * @param {boolean} options.confirm - Confirmation flag (required)
     * @param {Object} [req] - Request object for org context
     * @returns {Promise<void>}
     */
    async delete(tenantId, options, req = null) {
        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }
        if (!options?.confirm) {
            throw new Error('Tenant deletion requires explicit confirmation. Pass { confirm: true }');
        }
        const db = await this.getTenants(req);
        await this._deleteAllTenantData(db, tenantId);
        // Clear cached connections for this tenant
        this._clearTenantCache(tenantId);
    },
    /**
     * Disconnect all connections and cleanup
     * @returns {Promise<void>}
     */
    async disconnect() {
        const disconnectPromises = [];
        for (const [key, connection] of connections) {
            disconnectPromises.push(this._closeConnection(connection).catch((error) => console.warn(`Error disconnecting ${key}:`, error.message)));
        }
        await Promise.all(disconnectPromises);
        connections.clear();
        if (envWatcher) {
            envWatcher.close();
            envWatcher = null;
        }
    },
    // Private helper methods
    /**
     * Get distinct tenant IDs from database
     * @private
     */
    async _getDistinctTenantIds(client) {
        const tenantIds = new Set();
        try {
            if (client.$queryRaw) {
                // Prisma client - find models with tenant_id field
                const models = Object.keys(client).filter((key) => !key.startsWith('$') &&
                    !key.startsWith('_') &&
                    typeof client[key] === 'object' &&
                    typeof client[key].findMany === 'function');
                for (const modelName of models) {
                    try {
                        const records = await client[modelName].findMany({
                            select: { tenant_id: true },
                            distinct: ['tenant_id'],
                            where: { tenant_id: { not: null } },
                        });
                        records.forEach((record) => {
                            if (record.tenant_id)
                                tenantIds.add(record.tenant_id);
                        });
                    }
                    catch {
                        // Model might not have tenant_id field
                        continue;
                    }
                }
            }
            return Array.from(tenantIds).sort();
        }
        catch (error) {
            throw new Error(`Failed to get tenant IDs: ${error.message}`);
        }
    },
    /**
     * Check if tenant has data
     * @private
     */
    async _tenantHasData(client, tenantId) {
        try {
            if (client.$queryRaw) {
                // Prisma client
                const models = Object.keys(client).filter((key) => !key.startsWith('$') &&
                    !key.startsWith('_') &&
                    typeof client[key] === 'object' &&
                    typeof client[key].findFirst === 'function');
                for (const modelName of models) {
                    try {
                        const record = await client[modelName].findFirst({
                            where: { tenant_id: tenantId },
                        });
                        if (record)
                            return true;
                    }
                    catch {
                        continue;
                    }
                }
            }
            return false;
        }
        catch {
            return false;
        }
    },
    /**
     * Delete all tenant data
     * @private
     */
    async _deleteAllTenantData(client, tenantId) {
        try {
            if (client.$transaction) {
                // Prisma client - use transaction for safety
                const models = Object.keys(client).filter((key) => !key.startsWith('$') &&
                    !key.startsWith('_') &&
                    typeof client[key] === 'object' &&
                    typeof client[key].deleteMany === 'function');
                const deleteOperations = [];
                for (const modelName of models) {
                    try {
                        deleteOperations.push(client[modelName].deleteMany({
                            where: { tenant_id: tenantId },
                        }));
                    }
                    catch {
                        continue;
                    }
                }
                if (deleteOperations.length > 0) {
                    await client.$transaction(deleteOperations);
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to delete tenant data: ${error.message}`);
        }
    },
    /**
     * Clear tenant-specific cached connections
     * @private
     */
    _clearTenantCache(tenantId) {
        const keysToDelete = [];
        for (const [key] of connections) {
            if (key.includes(`_${tenantId}_`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => {
            const connection = connections.get(key);
            if (connection) {
                this._closeConnection(connection);
            }
            connections.delete(key);
        });
    },
    /**
     * Close database connection
     * @private
     */
    async _closeConnection(connection) {
        try {
            if (connection.$disconnect) {
                await connection.$disconnect();
            }
            else if (connection.close) {
                await connection.close();
            }
        }
        catch {
            // Ignore disconnect errors
        }
    },
};
// Default export for convenience
export default databaseClass;
//# sourceMappingURL=index.js.map