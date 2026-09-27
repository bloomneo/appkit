/**
 * Simplified Prisma adapter with app discovery and tenant middleware
 * @module @bloomneo/appkit/database
 * @file src/database/adapters/prisma.ts
 * 
 * @llm-rule WHEN: Using Prisma ORM with PostgreSQL, MySQL, or SQLite databases in Bloomneo framework
 * @llm-rule NOTE: The only adapter since 6.0 (Mongoose was removed); MongoDB goes through Prisma's mongodb provider
 * @llm-rule NOTE: Auto-discovers apps from /apps directory structure, applies tenant filtering
 */

import fs from 'fs';
import path from 'path';
import { createDatabaseError } from '../defaults.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/database/README.md';

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
}

/**
 * The tenant for one operation. `bypass` skips the filter (a deliberate,
 * reported cross-tenant read); neither set means no tenant, which fails
 * closed.
 */
export interface TenantResolution {
  tenantId?: string;
  bypass?: boolean;
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

type PrismaClientConstructor = new (config: any) => PrismaClient;

/**
 * Simplified Prisma adapter with Bloomneo app discovery
 */
export class PrismaAdapter {
  private options: Record<string, any>;
  private clients: Map<string, PrismaClient>;
  private discoveredApps: DiscoveredApp[] | null;
  private isDevelopment: boolean;

  constructor(options: Record<string, any> = {}) {
    this.options = options;
    this.clients = new Map();
    this.discoveredApps = null;
    this.isDevelopment = process.env.NODE_ENV === 'development';

    if (this.isDevelopment) {
      console.log('⚡ [@bloomneo/appkit/database] Prisma adapter initialized with app discovery');
    }
  }

  /**
   * Creates Prisma client with app discovery and automatic connection management
   */
  async createClient(config: PrismaClientConfig): Promise<PrismaClient> {
    const { url, options = {} } = config;
    const appName = config.appName || await this._detectCurrentApp();
    const clientKey = `${appName}_${url}_${JSON.stringify(options)}`;

    if (!this.clients.has(clientKey)) {
      try {
        // Load app-specific Prisma client
        const PrismaClient = await this._loadPrismaClientForApp(appName);

        // Use original URL directly (don't resolve) to match working direct Prisma client
        if (this.isDevelopment) {
            console.log(`[@bloomneo/appkit/database] Using URL: ${this._maskUrl(url)}`);
        }
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
          console.log(`✅ [@bloomneo/appkit/database] Created Prisma client for app: ${appName}`);
        }
      } catch (error: any) {
        throw createDatabaseError(
          `Failed to create Prisma client for app '${appName}': ${error.message}`,
          500,
          null,
          'troubleshooting'
        );
      }
    }

    return this.clients.get(clientKey)!;
  }

  /**
   * Scope a Prisma client to one tenant.
   *
   * Returns a NEW client built with `$extends({ query })`; the base client is
   * untouched and stays shared. (5.1.3 and earlier called `client.$use`, which
   * Prisma removed in 6.14 — tenant mode threw on the first query. It also
   * mutated the shared client, so each tenant's middleware stacked on the last.)
   *
   * Rules, for models that have the tenant field:
   * - reads, updates, deletes and counts are filtered to the tenant;
   * - creates and upserts always write this tenant, whatever the caller passed,
   *   so a request cannot write into another tenant by setting the field;
   * - an update cannot move a row to another tenant.
   * Models without the field pass through unchanged. Raw SQL ($queryRaw,
   * $executeRaw) is not filtered — use Postgres row-level security for that.
   */
  async applyTenantMiddleware(
    client: PrismaClient,
    tenant: string | (() => TenantResolution),
    options: TenantMiddlewareOptions = {}
  ): Promise<PrismaClient> {
    const field = options.fieldName || 'tenant_id';
    // A fixed tenant (a per-tenant client) or a resolver read on every
    // operation (one client shared by all tenants, tenant from the request
    // context).
    const resolve: () => TenantResolution = typeof tenant === 'function' ? tenant : () => ({ tenantId: tenant });

    // Which models carry the tenant field. Prisma exposes its data model at
    // runtime; if it ever stops doing so, scope every model (fail closed).
    const runtimeModels: Record<string, { fields: Array<{ name: string; type?: string }> }> | undefined =
      (client as any)._runtimeDataModel?.models;
    const hasField = (model: string | undefined): boolean => {
      if (!model) return false;
      const def = runtimeModels?.[model];
      return def ? def.fields.some((f) => f.name === field) : true;
    };

    /*
     * The tenant id travels as a string (token claim, set_config), but the
     * column may be an Int or BigInt — bloomneo-cloud's customerId. Prisma
     * rejects `customerId: "1"`, so convert to the column's type, and refuse
     * an id that isn't one rather than let it match by accident.
     */
    const typed = (model: string, tenantId: string): string | number | bigint => {
      const type = runtimeModels?.[model]?.fields.find((f) => f.name === field)?.type;
      if (type !== 'Int' && type !== 'BigInt') return tenantId;
      if (!/^-?\d+$/.test(tenantId)) {
        throw createDatabaseError(
          `${model}.${field} is ${type}, but the tenant id "${tenantId}" is not an integer`,
          500,
          { code: 'DATABASE_TENANT_ID_TYPE' },
          'multi-tenant-mode',
        );
      }
      return type === 'BigInt' ? BigInt(tenantId) : Number(tenantId);
    };

    const force = (data: any, tenantId: unknown) =>
      data && typeof data === 'object' ? { ...data, [field]: tenantId } : data;
    const scopeUnique = (where: any, tenantId: unknown) => ({ ...(where || {}), [field]: tenantId });
    const scopeMany = (where: any, tenantId: unknown) =>
      where && Object.keys(where).length ? { AND: [{ [field]: tenantId }, where] } : { [field]: tenantId };

    const UNIQUE = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);
    const MANY = new Set([
      'findFirst', 'findFirstOrThrow', 'findMany', 'updateMany', 'updateManyAndReturn',
      'deleteMany', 'count', 'aggregate', 'groupBy',
    ]);

    const scoped = (client as any).$extends({
      name: 'appkit-tenant',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            if (!hasField(model)) return query(args);
            const { tenantId: rawTenantId, bypass } = resolve();
            if (bypass) return query(args);
            if (!rawTenantId) {
              // A shared client used outside database.tenant() / the request
              // context. Refusing is the only safe answer: there is no tenant
              // to filter by, and unfiltered is every tenant.
              throw createDatabaseError(
                `${model}.${operation} ran with no tenant in context. Run it inside ` +
                  `database.tenant(req, fn), behind database.context(), or in database.bypass('reason', fn)`,
                500,
                { code: 'DATABASE_NO_TENANT_CONTEXT' },
                'multi-tenant-mode',
              );
            }
            const tenantId = typed(model, String(rawTenantId));
            const a = { ...(args || {}) };

            if (UNIQUE.has(operation)) a.where = scopeUnique(a.where, tenantId);
            if (MANY.has(operation)) a.where = scopeMany(a.where, tenantId);

            if (operation === 'create') a.data = force(a.data, tenantId);
            if (operation === 'createMany' || operation === 'createManyAndReturn') {
              a.data = Array.isArray(a.data) ? a.data.map((d: any) => force(d, tenantId)) : force(a.data, tenantId);
            }
            if (operation === 'upsert') {
              a.where = scopeUnique(a.where, tenantId);
              a.create = force(a.create, tenantId);
              if (a.update && field in a.update) a.update = force(a.update, tenantId);
            }
            if ((operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn')
              && a.data && field in a.data) {
              a.data = force(a.data, tenantId);
            }

            return query(a);
          },
        },
      },
    });

    return scoped as PrismaClient;
  }

  /**
   * Auto-discover Bloomneo apps with Prisma clients
   */
  async discoverApps(): Promise<DiscoveredApp[]> {
    if (this.discoveredApps) return this.discoveredApps;

    // Look for apps directory
    const appsDir = this._findAppsDirectory();
    if (!appsDir) {
      if (this.isDevelopment) {
        console.warn('⚠️  [@bloomneo/appkit/database] No /apps directory found, using single app mode');
      }
      this.discoveredApps = [];
      return [];
    }

    const apps: DiscoveredApp[] = [];
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
            console.log(`✅ [@bloomneo/appkit/database] Found Prisma client for app: ${appName}`);
          }
        } else if (this.isDevelopment) {
          console.log(`⚠️  [@bloomneo/appkit/database] No Prisma client found for app: ${appName}`);
          console.log(`   Expected: ${clientPath}`);
          console.log(`   Run: cd apps/${appName} && npx prisma generate`);
        }
      }

      this.discoveredApps = apps;
    } catch (error: any) {
      console.error(
        `[@bloomneo/appkit/database] Error discovering apps: ${error.message}. See: ${DOCS_URL}#troubleshooting`
      );
      this.discoveredApps = [];
      return [];
    }

    if (this.isDevelopment) {
      console.log(`🔍 [@bloomneo/appkit/database] Discovered ${apps.length} apps with Prisma clients`);
    }

    return apps;
  }

  /**
   * Disconnect all cached clients
   */
  async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const [key, client] of this.clients) {
      disconnectPromises.push(
        client
          .$disconnect()
          .catch((error: any) =>
            console.warn(
              `[@bloomneo/appkit/database] Error disconnecting Prisma client "${key}": ${error.message}`
            )
          )
      );
    }

    await Promise.all(disconnectPromises);
    this.clients.clear();

    if (this.isDevelopment) {
      console.log('👋 [@bloomneo/appkit/database] Prisma adapter disconnected');
    }
  }

  // Private helper methods

  /**
   * Detect current app from file path (Bloomneo structure)
   */
  private async _detectCurrentApp(): Promise<string> {
    try {
      // Get the calling file from stack trace
      const stack = new Error().stack;
      if (!stack) return 'main';

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
    } catch (error: any) {
      if (this.isDevelopment) {
        console.warn(
          `[@bloomneo/appkit/database] Failed to detect current app: ${error.message}`
        );
      }
      return 'main';
    }
  }

  /**
   * Find apps directory in project structure
   */
  private _findAppsDirectory(): string | null {
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
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Load Prisma client for specific app
   */
  private async _loadPrismaClientForApp(appName: string): Promise<PrismaClientConstructor> {
    // An explicit client wins: apps whose schema sets a custom generator
    // `output` point BLOOM_PRISMA_CLIENT at it (a path or module specifier).
    const explicit = process.env.BLOOM_PRISMA_CLIENT;
    if (explicit) {
      const target = explicit.startsWith('.') || explicit.startsWith('/')
        ? `file://${path.resolve(explicit)}`
        : explicit;
      const mod: any = await import(target);
      const Ctor = mod.PrismaClient ?? mod.default?.PrismaClient;
      if (!Ctor) {
        throw createDatabaseError(`BLOOM_PRISMA_CLIENT (${explicit}) does not export PrismaClient`, 500, null, 'environment-variables');
      }
      return Ctor;
    }

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
      } catch (error: any) {
        if (this.isDevelopment) {
          console.warn(
            `[@bloomneo/appkit/database] Failed to load client for ${appName}: ${error.message}`
          );
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

    /*
     * This is a PROBE, not a sequence of operations that must each succeed.
     *
     * It used to print
     *     ❌ [@bloomneo/appkit/database] Failed to load Prisma client at: <path>
     * for every candidate that missed, then find the client on a later one and
     * carry on perfectly happily. A completely healthy app therefore opened
     * with three red failure lines about its database.
     *
     * For anyone reading the log to find out why something broke — and for an
     * agent especially, which cannot discount a scary line by familiarity —
     * that is worse than silence: it manufactures a false lead at the exact
     * moment someone is looking for a true one.
     *
     * A failed candidate is not news. Only failing them ALL is, and then the
     * paths tried belong in the error, where they are actionable.
     */
    const attempted: string[] = [];

    for (const clientPath of fallbackPaths) {
      try {
        const module = await import(clientPath);
        if (module.PrismaClient) {
          if (this.isDevelopment) {
            console.log(`✅ [@bloomneo/appkit/database] Found Prisma client at - ${clientPath}`);
          }
          return module.PrismaClient;
        }
        if (module.default?.PrismaClient) {
          return module.default.PrismaClient;
        }
        attempted.push(`${clientPath} (no PrismaClient export)`);
      } catch {
        attempted.push(clientPath);
        continue;
      }
    }

    throw createDatabaseError(
      `Prisma client not found for app '${appName}'. ` +
      `Run: cd apps/${appName} && npx prisma generate\n` +
      `Tried:\n  ${attempted.join('\n  ')}`,
      500,
      null,
      'troubleshooting'
    );
  }

  /**
   * Resolve database URL with fallback paths for SQLite files
   */
  private _resolveDatabaseUrl(url: string): string {
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
      filePath,                    // Original path (e.g., "dev.db")
      `prisma/${filePath}`,        // Check in prisma folder
      `./prisma/${filePath}`,      // Check in ./prisma folder
      `data/${filePath}`,          // Check in data folder
    ];

    for (const testPath of fallbackPaths) {
      const fullPath = path.resolve(process.cwd(), testPath);
      if (fs.existsSync(fullPath)) {
        const resolvedUrl = `file:${testPath}`;
        if (this.isDevelopment) {
          console.log(`📂 [@bloomneo/appkit/database] Database found at: ${testPath}`);
        }
        return resolvedUrl;
      }
    }

    // If no file found, return original URL (Prisma will create it)
    if (this.isDevelopment) {
      console.log(`📂 [@bloomneo/appkit/database] Database will be created at: ${filePath}`);
    }
    return url;
  }

  /**
   * Mask URL for logging (hide credentials)
   */
  private _maskUrl(url: string): string {
    if (!url) return '[no-url]';
    try {
      return url.replace(/:\/\/[^@]*@/, '://***:***@');
    } catch {
      return '[masked-url]';
    }
  }
}