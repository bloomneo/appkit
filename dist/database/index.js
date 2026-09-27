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
import { PrismaAdapter } from './adapters/prisma.js';
import { MongooseAdapter } from './adapters/mongoose.js';
import { AppKitError } from '../util/errors.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/database/README.md';
/**
 * Thrown by database operations when connection, config, or tenant-filter
 * validation fails. `instanceof AppKitError` also true.
 */
export class DatabaseError extends AppKitError {
    code;
    constructor(message, options) {
        super(message, {
            module: 'database',
            code: options?.code ?? 'DATABASE_ERROR',
            cause: options?.cause,
        });
        this.name = 'DatabaseError';
        this.code = options?.code ?? 'DATABASE_ERROR';
    }
}
// Global instances cache for performance
const connections = new Map();
// One-shot warn flag so the tenant-filter hint only fires once per process.
let _tenantHintWarned = false;
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
    if (!process.env.BLOOM_DB_TENANT)
        return null;
    return (req.headers?.['x-tenant-id'] ||
        // The auth module puts `tenantId` in the login token (4.2.0+). `tenant_id`
        // is the pre-4.2 shape and is still read so existing apps keep working.
        req.user?.tenantId ||
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
        throw new Error(`[@bloomneo/appkit/database] Failed to create database connection: ${error.message}. See: ${DOCS_URL}#troubleshooting`);
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
            throw new Error(`[@bloomneo/appkit/database] No database URL found for organization '${this.orgId}'. See: ${DOCS_URL}#environment-variables`);
        }
        return await createClient(url, tenantId, this.orgId);
    }
    /**
     * Get all tenants in organization (admin access)
     */
    async getTenants(req = null) {
        const url = getOrgUrl(this.orgId);
        if (!url) {
            throw new Error(`[@bloomneo/appkit/database] No database URL found for organization '${this.orgId}'. See: ${DOCS_URL}#environment-variables`);
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
        // Tenant-filter safety net: if BLOOM_DB_TENANT isn't set, warn once
        // per process. If a consumer's schema has tenant_id columns and they
        // forgot the env var, every query silently returns unfiltered data —
        // the #1 prod risk pre-4.0.0. One-line nudge at boot time.
        if (!_tenantHintWarned && process.env.BLOOM_DB_TENANT === undefined) {
            _tenantHintWarned = true;
            console.warn(`[@bloomneo/appkit/database] BLOOM_DB_TENANT is not set. If your schema ` +
                `has tenant_id columns, set BLOOM_DB_TENANT=auto to enable automatic ` +
                `row-level filtering. Set BLOOM_DB_TENANT=false to silence this. ` +
                `See: ${DOCS_URL}#multi-tenant-mode`);
        }
        // Detect context
        const orgId = detectOrg(req);
        const tenantId = detectTenant(req);
        // 5.0: in tenant mode, get() may no longer hand back an unscoped client.
        //
        // Pre-5.0 this returned every row whenever a tenant failed to resolve —
        // a call site that forgot to pass `req`, or a token missing the claim,
        // leaked the whole table and looked like it worked. A production audit
        // found 4 of 44 route files in exactly that state. Failing closed turns a
        // silent leak into a loud error at the one call site responsible.
        //
        // Deliberate cross-tenant work goes through bypass(), which is greppable.
        const tenantModeOn = process.env.BLOOM_DB_TENANT && process.env.BLOOM_DB_TENANT !== 'false';
        if (tenantModeOn && !tenantId) {
            throw new DatabaseError(`[@bloomneo/appkit/database] BLOOM_DB_TENANT is enabled but no tenant resolved for this call. ` +
                `Use database.tenant(req, db => ...) for request-scoped queries, or ` +
                `database.bypass('reason', db => ...) for deliberate cross-tenant access. ` +
                `Passing no request at all is the usual cause. See: ${DOCS_URL}#multi-tenant-mode`, { code: 'DATABASE_UNSCOPED_IN_TENANT_MODE' });
        }
        // Get appropriate URL
        const url = getOrgUrl(orgId || undefined) || process.env.DATABASE_URL;
        if (!url) {
            throw new DatabaseError(`[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`, { code: 'DATABASE_MISSING_URL' });
        }
        return await createClient(url, tenantId, orgId);
    },
    /**
     * Run a callback against a tenant-scoped client.
     *
     * This is the safe path, and in tenant mode it is the ONLY ergonomic one.
     * The tenant is resolved from the request — `req.user.tenantId` (the claim
     * auth puts in the login token), `x-tenant-id`, route params, or subdomain —
     * and a caller with no resolvable tenant is refused rather than silently
     * handed every row.
     *
     * ```ts
     * const clients = await database.tenant(req, (db) => db.client.findMany());
     * ```
     *
     * @llm-rule WHEN: Any request-scoped query in a multi-tenant app
     * @llm-rule AVOID: databaseClass.get() for tenant data - it cannot prove a tenant was applied
     * @llm-rule NOTE: Throws when no tenant resolves; use bypass() for deliberate cross-tenant work
     */
    async tenant(req, fn) {
        if (typeof fn !== 'function') {
            throw new DatabaseError(`[@bloomneo/appkit/database] database.tenant(req, fn) needs a callback. See: ${DOCS_URL}#multi-tenant-mode`, { code: 'DATABASE_TENANT_NO_CALLBACK' });
        }
        const tenantModeOn = process.env.BLOOM_DB_TENANT && process.env.BLOOM_DB_TENANT !== 'false';
        // Two different mistakes, two different messages. Telling a single-tenant
        // app "no tenant resolved" sends them hunting for a missing claim when the
        // real answer is that they never needed this method.
        if (!tenantModeOn) {
            throw new DatabaseError(`[@bloomneo/appkit/database] database.tenant() requires multi-tenant mode, but BLOOM_DB_TENANT ` +
                `is not enabled. Single-tenant apps should use databaseClass.get() — it is unrestricted ` +
                `when tenant mode is off. To enable multi-tenancy set BLOOM_DB_TENANT=auto. ` +
                `See: ${DOCS_URL}#multi-tenant-mode`, { code: 'DATABASE_TENANT_MODE_OFF' });
        }
        const tenantId = detectTenant(req);
        if (!tenantId) {
            // Failing closed is the entire point. A request with no tenant that
            // silently reads every row is the leak this API exists to prevent.
            throw new DatabaseError(`[@bloomneo/appkit/database] No tenant resolved for this request. ` +
                `Expected req.user.tenantId (set it in the login token), an x-tenant-id header, ` +
                `a :tenantId route param, or a subdomain. For deliberate cross-tenant access use ` +
                `database.bypass('reason', fn). See: ${DOCS_URL}#multi-tenant-mode`, { code: 'DATABASE_NO_TENANT' });
        }
        const orgId = detectOrg(req);
        const url = getOrgUrl(orgId || undefined) || process.env.DATABASE_URL;
        if (!url) {
            throw new DatabaseError(`[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`, { code: 'DATABASE_MISSING_URL' });
        }
        const client = await createClient(url, tenantId, orgId);
        return await fn(client);
    },
    /**
     * Run a callback against an UNSCOPED client, on purpose.
     *
     * Every cross-tenant read in the codebase goes through here, so
     * `grep -rn "bypass(" src/` is the complete audit surface. The reason string
     * is required and logged for exactly that: a bypass with no stated reason is
     * indistinguishable from a forgotten scope.
     *
     * ```ts
     * const firms = await database.bypass('platform admin firm list', (db) => db.firm.findMany());
     * ```
     *
     * @llm-rule WHEN: Platform/admin routes that are cross-tenant by design, or pre-login lookups
     * @llm-rule AVOID: Using it because tenant() threw - that throw is usually a real missing claim
     * @llm-rule NOTE: The reason is mandatory and appears in logs; keep it specific
     */
    async bypass(reason, fn) {
        if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
            throw new DatabaseError(`[@bloomneo/appkit/database] database.bypass(reason, fn) needs a specific reason string — ` +
                `it is what makes cross-tenant access auditable. See: ${DOCS_URL}#multi-tenant-mode`, { code: 'DATABASE_BYPASS_NO_REASON' });
        }
        if (typeof fn !== 'function') {
            throw new DatabaseError(`[@bloomneo/appkit/database] database.bypass(reason, fn) needs a callback. See: ${DOCS_URL}#multi-tenant-mode`, { code: 'DATABASE_BYPASS_NO_CALLBACK' });
        }
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new DatabaseError(`[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`, { code: 'DATABASE_MISSING_URL' });
        }
        if (process.env.BLOOM_DB_TENANT && process.env.BLOOM_DB_TENANT !== 'false') {
            // Deliberately not the logger module — database must not depend on it.
            console.warn(`[@bloomneo/appkit/database] tenant bypass: ${reason}`);
        }
        const client = await createClient(url, null, null);
        return await fn(client);
    },
    /**
     * Get all tenants data (admin access - no tenant filtering)
     * @param {Object} [req] - Request object for org context
     * @returns {Promise<DatabaseClientUnion>} Database client with no tenant filtering
     */
    async getTenants(req = null) {
        const orgId = detectOrg(req);
        const url = getOrgUrl(orgId || undefined) || process.env.DATABASE_URL;
        if (!url) {
            throw new Error(`[@bloomneo/appkit/database] Database URL required. Set DATABASE_URL environment variable. See: ${DOCS_URL}#environment-variables`);
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
            throw new Error(`[@bloomneo/appkit/database] Organization ID is required and must be a string. See: ${DOCS_URL}#organization-support`);
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
            throw new Error(`[@bloomneo/appkit/database] Failed to list tenants: ${error.message}. See: ${DOCS_URL}#troubleshooting`);
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
            throw new Error(`[@bloomneo/appkit/database] Tenant ID is required and must be a string. See: ${DOCS_URL}#tenant-mode`);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
            throw new Error(`[@bloomneo/appkit/database] Invalid tenant ID format. Use alphanumeric characters, underscores, and hyphens only. See: ${DOCS_URL}#tenant-mode`);
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
            throw new Error(`[@bloomneo/appkit/database] Tenant ID is required. See: ${DOCS_URL}#tenant-mode`);
        }
        if (!options?.confirm) {
            throw new Error(`[@bloomneo/appkit/database] Tenant deletion requires explicit confirmation. Pass { confirm: true }. See: ${DOCS_URL}#tenant-mode`);
        }
        const db = await this.getTenants(req);
        await this._deleteAllTenantData(db, tenantId);
        // Clear cached connections for this tenant
        this._clearTenantCache(tenantId);
    },
    /**
     * Close every cached org/tenant connection and reset internal state — the
     * canonical teardown call. Named to match cache/queue/email/event/storage/logger
     * per NAMING.md §Bulk-and-Lifecycle-Ops so agents see one teardown verb
     * across every appkit module.
     *
     * @llm-rule WHEN: App shutdown, SIGTERM handler, end-of-test-suite teardown
     * @llm-rule AVOID: Abrupt process exit — graceful drain prevents dropped
     *   in-flight queries and lets the ORM flush pending writes
     */
    async disconnectAll() {
        const disconnectPromises = [];
        for (const [key, connection] of connections) {
            disconnectPromises.push(this._closeConnection(connection).catch((error) => console.warn(`[@bloomneo/appkit/database] Disconnect warning for "${key}":`, error.message)));
        }
        await Promise.all(disconnectPromises);
        connections.clear();
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
            throw new Error(`[@bloomneo/appkit/database] Failed to get tenant IDs: ${error.message}. See: ${DOCS_URL}#troubleshooting`);
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
            throw new Error(`[@bloomneo/appkit/database] Failed to delete tenant data: ${error.message}. See: ${DOCS_URL}#troubleshooting`);
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