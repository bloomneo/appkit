/**
 * Simplified Prisma adapter with app discovery and tenant middleware
 * @module @bloomneo/appkit/database
 * @file src/database/adapters/prisma.ts
 *
 * @llm-rule WHEN: Using Prisma ORM with PostgreSQL, MySQL, or SQLite databases in VoilaJSX framework
 * @llm-rule AVOID: Using with MongoDB - use mongoose adapter instead
 * @llm-rule NOTE: Auto-discovers apps from /apps directory structure, applies tenant filtering
 */
interface PrismaClientConfig {
    url: string;
    appName?: string;
    options?: Record<string, any>;
}
interface DiscoveredApp {
    name: string;
    clientPath: string;
}
interface TenantMiddlewareOptions {
    fieldName?: string;
    orgId?: string;
}
interface PrismaClient {
    $connect: () => Promise<void>;
    $disconnect: () => Promise<void>;
    $use: (middleware: any) => void;
    $queryRaw?: any;
    _appKit?: boolean;
    _appName?: string;
    _url?: string;
    _tenantId?: string;
    _tenantFiltered?: boolean;
    [key: string]: any;
}
/**
 * Simplified Prisma adapter with VoilaJSX app discovery
 */
export declare class PrismaAdapter {
    private options;
    private clients;
    private discoveredApps;
    private isDevelopment;
    constructor(options?: Record<string, any>);
    /**
     * Creates Prisma client with app discovery and automatic connection management
     */
    createClient(config: PrismaClientConfig): Promise<PrismaClient>;
    /**
     * Apply tenant filtering middleware to Prisma client
     */
    applyTenantMiddleware(client: PrismaClient, tenantId: string, options?: TenantMiddlewareOptions): Promise<PrismaClient>;
    /**
     * Auto-discover VoilaJSX apps with Prisma clients
     */
    discoverApps(): Promise<DiscoveredApp[]>;
    /**
     * Check if tenant registry exists (simplified for Prisma)
     */
    hasTenantRegistry(client: PrismaClient): Promise<boolean>;
    /**
     * Create tenant registry entry
     */
    createTenantRegistryEntry(client: PrismaClient, tenantId: string): Promise<void>;
    /**
     * Delete tenant registry entry
     */
    deleteTenantRegistryEntry(client: PrismaClient, tenantId: string): Promise<void>;
    /**
     * Check if tenant exists in registry
     */
    tenantExistsInRegistry(client: PrismaClient, tenantId: string): Promise<boolean>;
    /**
     * Get all tenants from registry
     */
    getTenantsFromRegistry(client: PrismaClient): Promise<string[]>;
    /**
     * Disconnect all cached clients
     */
    disconnect(): Promise<void>;
    /**
     * Detect current app from file path (VoilaJSX structure)
     */
    private _detectCurrentApp;
    /**
     * Find apps directory in project structure
     */
    private _findAppsDirectory;
    /**
     * Load Prisma client for specific app
     */
    private _loadPrismaClientForApp;
    /**
     * Get tenant registry model (handles different naming conventions)
     */
    private _getTenantRegistryModel;
    /**
     * Resolve database URL with fallback paths for SQLite files
     */
    private _resolveDatabaseUrl;
    /**
     * Mask URL for logging (hide credentials)
     */
    private _maskUrl;
}
export {};
//# sourceMappingURL=prisma.d.ts.map