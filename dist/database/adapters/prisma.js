/**
 * Simplified Prisma adapter with app discovery and tenant middleware
 * @module @bloomneo/appkit/database
 * @file src/database/adapters/prisma.ts
 *
 * @llm-rule WHEN: Using Prisma ORM with PostgreSQL, MySQL, or SQLite databases in Bloomneo framework
 * @llm-rule AVOID: Using with MongoDB - use mongoose adapter instead
 * @llm-rule NOTE: Auto-discovers apps from /apps directory structure, applies tenant filtering
 */
import fs from 'fs';
import path from 'path';
import { createDatabaseError } from '../defaults.js';
/**
 * Simplified Prisma adapter with Bloomneo app discovery
 */
export class PrismaAdapter {
    options;
    clients;
    discoveredApps;
    isDevelopment;
    constructor(options = {}) {
        this.options = options;
        this.clients = new Map();
        this.discoveredApps = null;
        this.isDevelopment = process.env.NODE_ENV === 'development';
        if (this.isDevelopment) {
            console.log('⚡ [AppKit] Prisma adapter initialized with app discovery');
        }
    }
    /**
     * Creates Prisma client with app discovery and automatic connection management
     */
    async createClient(config) {
        const { url, options = {} } = config;
        const appName = config.appName || await this._detectCurrentApp();
        const clientKey = `${appName}_${url}_${JSON.stringify(options)}`;
        if (!this.clients.has(clientKey)) {
            try {
                // Load app-specific Prisma client
                const PrismaClient = await this._loadPrismaClientForApp(appName);
                // Use original URL directly (don't resolve) to match working direct Prisma client
                if (this.isDevelopment) {
                    console.log('🔍 [AppKit DB Debug] Using original URL:', url);
                }
                console.log('🔍 [AppKit DB Debug] Masked URL:', url);
                // Use the exact same config as the working direct Prisma client
                const client = new PrismaClient({
                    datasources: {
                        db: { url: url },
                    },
                    log: this.isDevelopment ? ['error', 'warn'] : ['error'],
                    ...options,
                });
                await client.$connect();
                // Add metadata
                client._appKit = true;
                client._appName = appName;
                client._url = url;
                this.clients.set(clientKey, client);
                if (this.isDevelopment) {
                    console.log(`✅ [AppKit] Created Prisma client for app: ${appName}`);
                }
            }
            catch (error) {
                throw createDatabaseError(`Failed to create Prisma client for app '${appName}': ${error.message}`, 500);
            }
        }
        return this.clients.get(clientKey);
    }
    /**
     * Apply tenant filtering middleware to Prisma client
     */
    async applyTenantMiddleware(client, tenantId, options = {}) {
        const tenantField = options.fieldName || 'tenant_id';
        // Add tenant middleware for automatic filtering and insertion
        client.$use(async (params, next) => {
            // Add tenant to create operations
            if (params.action === 'create' && params.args?.data) {
                if (!params.args.data[tenantField]) {
                    params.args.data[tenantField] = tenantId;
                }
            }
            // Add tenant to createMany operations
            if (params.action === 'createMany' && params.args?.data) {
                params.args.data = params.args.data.map((item) => ({
                    ...item,
                    [tenantField]: item[tenantField] || tenantId,
                }));
            }
            // Add tenant to upsert operations
            if (params.action === 'upsert') {
                if (params.args?.create && !params.args.create[tenantField]) {
                    params.args.create[tenantField] = tenantId;
                }
                if (params.args?.update && !params.args.update[tenantField]) {
                    params.args.update[tenantField] = tenantId;
                }
                if (params.args?.where && !params.args.where[tenantField]) {
                    params.args.where[tenantField] = tenantId;
                }
            }
            // Add tenant filter to read/update/delete operations
            const filterActions = [
                'findFirst',
                'findMany',
                'findUnique',
                'update',
                'updateMany',
                'delete',
                'deleteMany',
                'count',
                'aggregate',
                'groupBy',
            ];
            if (filterActions.includes(params.action)) {
                if (!params.args)
                    params.args = {};
                if (!params.args.where)
                    params.args.where = {};
                // Handle complex where clauses
                if (params.args.where.AND) {
                    // Check if tenant filter already exists
                    const hasTenantFilter = params.args.where.AND.some((condition) => typeof condition === 'object' &&
                        condition !== null &&
                        condition[tenantField] !== undefined);
                    if (!hasTenantFilter) {
                        params.args.where.AND.push({ [tenantField]: tenantId });
                    }
                }
                else if (params.args.where.OR) {
                    // Wrap OR in AND with tenant filter
                    params.args.where = {
                        AND: [{ [tenantField]: tenantId }, { OR: params.args.where.OR }],
                    };
                    delete params.args.where.OR;
                }
                else {
                    // Add tenant filter to simple where
                    if (params.args.where[tenantField] === undefined) {
                        params.args.where[tenantField] = tenantId;
                    }
                }
            }
            return next(params);
        });
        // Mark as tenant-filtered
        client._tenantId = tenantId;
        client._tenantFiltered = true;
        return client;
    }
    /**
     * Auto-discover Bloomneo apps with Prisma clients
     */
    async discoverApps() {
        if (this.discoveredApps)
            return this.discoveredApps;
        // Look for apps directory
        const appsDir = this._findAppsDirectory();
        if (!appsDir) {
            if (this.isDevelopment) {
                console.warn('⚠️  [AppKit] No /apps directory found, using single app mode');
            }
            this.discoveredApps = [];
            return [];
        }
        const apps = [];
        try {
            const appFolders = fs
                .readdirSync(appsDir, { withFileTypes: true })
                .filter((dirent) => dirent.isDirectory())
                .map((dirent) => dirent.name);
            for (const appName of appFolders) {
                // Bloomneo standard: apps/{appName}/prisma/generated/client
                const clientPath = path.join(appsDir, appName, 'prisma/generated/client/index.js');
                if (fs.existsSync(clientPath)) {
                    apps.push({
                        name: appName,
                        clientPath: path.resolve(clientPath),
                    });
                    if (this.isDevelopment) {
                        console.log(`✅ [AppKit] Found Prisma client for app: ${appName}`);
                    }
                }
                else if (this.isDevelopment) {
                    console.log(`⚠️  [AppKit] No Prisma client found for app: ${appName}`);
                    console.log(`   Expected: ${clientPath}`);
                    console.log(`   Run: cd apps/${appName} && npx prisma generate`);
                }
            }
            this.discoveredApps = apps;
        }
        catch (error) {
            console.error('❌ [AppKit] Error discovering apps:', error.message);
            this.discoveredApps = [];
            return [];
        }
        if (this.isDevelopment) {
            console.log(`🔍 [AppKit] Discovered ${apps.length} apps with Prisma clients`);
        }
        return apps;
    }
    /**
     * Check if tenant registry exists (simplified for Prisma)
     */
    async hasTenantRegistry(client) {
        try {
            // Look for a tenant registry model
            const models = Object.keys(client).filter((key) => !key.startsWith('$') &&
                !key.startsWith('_') &&
                typeof client[key] === 'object' &&
                client[key] !== null &&
                typeof client[key].findFirst === 'function');
            const registryModels = ['tenantRegistry', 'TenantRegistry', 'tenant_registry'];
            return models.some(model => registryModels.includes(model) ||
                (model.toLowerCase().includes('tenant') && model.toLowerCase().includes('registry')));
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Create tenant registry entry
     */
    async createTenantRegistryEntry(client, tenantId) {
        try {
            const registryModel = this._getTenantRegistryModel(client);
            if (registryModel) {
                await registryModel.upsert({
                    where: { tenantId },
                    create: {
                        tenantId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    update: { updatedAt: new Date() },
                });
            }
        }
        catch (error) {
            if (this.isDevelopment) {
                console.debug('Failed to create tenant registry entry:', error.message);
            }
        }
    }
    /**
     * Delete tenant registry entry
     */
    async deleteTenantRegistryEntry(client, tenantId) {
        try {
            const registryModel = this._getTenantRegistryModel(client);
            if (registryModel) {
                await registryModel.delete({
                    where: { tenantId },
                });
            }
        }
        catch (error) {
            if (this.isDevelopment) {
                console.debug('Failed to delete tenant registry entry:', error.message);
            }
        }
    }
    /**
     * Check if tenant exists in registry
     */
    async tenantExistsInRegistry(client, tenantId) {
        try {
            const registryModel = this._getTenantRegistryModel(client);
            if (registryModel) {
                const entry = await registryModel.findUnique({
                    where: { tenantId },
                });
                return !!entry;
            }
            return false;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get all tenants from registry
     */
    async getTenantsFromRegistry(client) {
        try {
            const registryModel = this._getTenantRegistryModel(client);
            if (registryModel) {
                const entries = await registryModel.findMany({
                    select: { tenantId: true },
                    orderBy: { tenantId: 'asc' },
                });
                return entries.map((entry) => entry.tenantId);
            }
            return [];
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Disconnect all cached clients
     */
    async disconnect() {
        const disconnectPromises = [];
        for (const [key, client] of this.clients) {
            disconnectPromises.push(client
                .$disconnect()
                .catch((error) => console.warn(`Error disconnecting Prisma client ${key}:`, error.message)));
        }
        await Promise.all(disconnectPromises);
        this.clients.clear();
        if (this.isDevelopment) {
            console.log('👋 [AppKit] Prisma adapter disconnected');
        }
    }
    // Private helper methods
    /**
     * Detect current app from file path (Bloomneo structure)
     */
    async _detectCurrentApp() {
        try {
            // Get the calling file from stack trace
            const stack = new Error().stack;
            if (!stack)
                return 'main';
            const stackLines = stack.split('\n');
            // Look for the first file in /apps/ directory
            for (let i = 1; i < Math.min(stackLines.length, 10); i++) {
                const line = stackLines[i];
                if (line.includes('file://') && line.includes('/apps/')) {
                    const fileMatch = line.match(/\/apps\/([^\/]+)\//);
                    if (fileMatch) {
                        return fileMatch[1]; // Return app name
                    }
                }
            }
            // Fallback: check current working directory
            const cwd = process.cwd();
            const appsMatch = cwd.match(/\/apps\/([^\/]+)/);
            if (appsMatch) {
                return appsMatch[1];
            }
            return 'main';
        }
        catch (error) {
            if (this.isDevelopment) {
                console.warn('Failed to detect current app:', error.message);
            }
            return 'main';
        }
    }
    /**
     * Find apps directory in project structure
     */
    _findAppsDirectory() {
        // Check environment variable first
        if (process.env.BLOOM_APPS_DIR && fs.existsSync(process.env.BLOOM_APPS_DIR)) {
            return process.env.BLOOM_APPS_DIR;
        }
        // Search upwards from current directory
        let currentDir = process.cwd();
        for (let i = 0; i < 5; i++) {
            const appsPath = path.join(currentDir, 'apps');
            if (fs.existsSync(appsPath)) {
                return appsPath;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir)
                break; // Reached root
            currentDir = parentDir;
        }
        return null;
    }
    /**
     * Load Prisma client for specific app
     */
    async _loadPrismaClientForApp(appName) {
        // First try discovered apps
        const apps = await this.discoverApps();
        const app = apps.find((a) => a.name === appName);
        if (app) {
            try {
                const module = await import(`file://${app.clientPath}`);
                if (module.PrismaClient) {
                    return module.PrismaClient;
                }
                if (module.default?.PrismaClient) {
                    return module.default.PrismaClient;
                }
            }
            catch (error) {
                if (this.isDevelopment) {
                    console.warn(`Failed to load client for ${appName}:`, error.message);
                }
            }
        }
        // Fallback: try standard paths
        const fallbackPaths = [
            `./apps/${appName}/prisma/generated/client/index.js`,
            `../apps/${appName}/prisma/generated/client/index.js`,
            `../../apps/${appName}/prisma/generated/client/index.js`,
            `./node_modules/@prisma/client/index.js`,
            '@prisma/client', // Global fallback
        ];
        for (const clientPath of fallbackPaths) {
            try {
                const module = await import(clientPath);
                if (module.PrismaClient) {
                    if (this.isDevelopment) {
                        console.log(`✅ [AppKit] Found Prisma client at - ${clientPath}`);
                    }
                    return module.PrismaClient;
                }
                if (module.default?.PrismaClient) {
                    return module.default.PrismaClient;
                }
            }
            catch (error) {
                console.log(`❌ [AppKit] Failed to load Prisma client at: ${clientPath}`);
                continue;
            }
        }
        throw createDatabaseError(`Prisma client not found for app '${appName}'. ` +
            `Run: cd apps/${appName} && npx prisma generate`, 500);
    }
    /**
     * Get tenant registry model (handles different naming conventions)
     */
    _getTenantRegistryModel(client) {
        const possibleNames = [
            'tenantRegistry',
            'TenantRegistry',
            'tenant_registry',
            'tenantregistry'
        ];
        for (const name of possibleNames) {
            if (client[name] && typeof client[name].findUnique === 'function') {
                return client[name];
            }
        }
        return null;
    }
    /**
     * Resolve database URL with fallback paths for SQLite files
     */
    _resolveDatabaseUrl(url) {
        // Only process file:// URLs (SQLite)
        if (!url.startsWith('file:')) {
            return url;
        }
        // Extract the file path from the URL
        const filePath = url.replace(/^file:/, '');
        // If it's an absolute path, return as-is
        if (path.isAbsolute(filePath)) {
            return url;
        }
        // For relative paths, check multiple locations
        const fallbackPaths = [
            filePath, // Original path (e.g., "dev.db")
            `prisma/${filePath}`, // Check in prisma folder
            `./prisma/${filePath}`, // Check in ./prisma folder
            `data/${filePath}`, // Check in data folder
        ];
        for (const testPath of fallbackPaths) {
            const fullPath = path.resolve(process.cwd(), testPath);
            if (fs.existsSync(fullPath)) {
                const resolvedUrl = `file:${testPath}`;
                if (this.isDevelopment) {
                    console.log(`📂 [AppKit] Database found at: ${testPath}`);
                }
                return resolvedUrl;
            }
        }
        // If no file found, return original URL (Prisma will create it)
        if (this.isDevelopment) {
            console.log(`📂 [AppKit] Database will be created at: ${filePath}`);
        }
        return url;
    }
    /**
     * Mask URL for logging (hide credentials)
     */
    _maskUrl(url) {
        if (!url)
            return '[no-url]';
        try {
            return url.replace(/:\/\/[^@]*@/, '://***:***@');
        }
        catch {
            return '[masked-url]';
        }
    }
}
//# sourceMappingURL=prisma.js.map