/**
 * Simplified Mongoose adapter with app discovery and tenant middleware
 * @module @bloomneo/appkit/database
 * @file src/database/adapters/mongoose.ts
 *
 * @llm-rule WHEN: Using Mongoose ODM with MongoDB databases in VoilaJSX framework
 * @llm-rule AVOID: Using with SQL databases - use prisma adapter instead
 * @llm-rule NOTE: Auto-discovers apps from /apps directory structure, applies tenant filtering
 */
interface MongooseClientConfig {
    url: string;
    appName?: string;
    maxPoolSize?: number;
    timeout?: number;
    connectionOptions?: Record<string, any>;
}
interface DiscoveredApp {
    name: string;
    modelsPath: string;
}
interface TenantMiddlewareOptions {
    fieldName?: string;
    orgId?: string;
}
interface MongooseConnection {
    db: any;
    close: () => Promise<void>;
    model: (name: string, schema?: any, collection?: string) => any;
    models: Record<string, any>;
    on: (event: string, callback: (...args: any[]) => void) => void;
    _appKit?: boolean;
    _appName?: string;
    _url?: string;
    _tenantId?: string;
    _tenantFiltered?: boolean;
    [key: string]: any;
}
/**
 * Simplified Mongoose adapter with VoilaJSX app discovery
 */
export declare class MongooseAdapter {
    private options;
    private connections;
    private discoveredApps;
    private isDevelopment;
    private mongoose;
    constructor(options?: Record<string, any>);
    /**
     * Creates Mongoose connection with app discovery and automatic connection management
     */
    createClient(config: MongooseClientConfig): Promise<MongooseConnection>;
    /**
     * Apply tenant filtering middleware to Mongoose connection
     */
    applyTenantMiddleware(connection: MongooseConnection, tenantId: string, options?: TenantMiddlewareOptions): Promise<MongooseConnection>;
    /**
     * Auto-discover VoilaJSX apps with Mongoose models
     */
    discoverApps(): Promise<DiscoveredApp[]>;
    /**
     * Check if tenant registry collection exists
     */
    hasTenantRegistry(connection: MongooseConnection): Promise<boolean>;
    /**
     * Create tenant registry entry
     */
    createTenantRegistryEntry(connection: MongooseConnection, tenantId: string): Promise<void>;
    /**
     * Delete tenant registry entry
     */
    deleteTenantRegistryEntry(connection: MongooseConnection, tenantId: string): Promise<void>;
    /**
     * Check if tenant exists in registry
     */
    tenantExistsInRegistry(connection: MongooseConnection, tenantId: string): Promise<boolean>;
    /**
     * Get all tenants from registry
     */
    getTenantsFromRegistry(connection: MongooseConnection): Promise<string[]>;
    /**
     * Disconnect all cached connections
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
     * Load models for specific app
     */
    private _loadModelsForApp;
    /**
     * Setup connection event handlers
     */
    private _setupConnectionEvents;
    /**
     * Mask URL for logging (hide credentials)
     */
    private _maskUrl;
}
export {};
//# sourceMappingURL=mongoose.d.ts.map