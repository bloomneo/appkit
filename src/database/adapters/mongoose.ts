/**
 * Simplified Mongoose adapter with app discovery and tenant middleware
 * @module @bloomneo/appkit/database
 * @file src/database/adapters/mongoose.ts
 * 
 * @llm-rule WHEN: Using Mongoose ODM with MongoDB databases in VoilaJSX framework
 * @llm-rule AVOID: Using with SQL databases - use prisma adapter instead
 * @llm-rule NOTE: Auto-discovers apps from /apps directory structure, applies tenant filtering
 */

import fs from 'fs';
import path from 'path';
import { createDatabaseError } from '../defaults.js';

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
export class MongooseAdapter {
  private options: Record<string, any>;
  private connections: Map<string, MongooseConnection>;
  private discoveredApps: DiscoveredApp[] | null;
  private isDevelopment: boolean;
  private mongoose: any;

  constructor(options: Record<string, any> = {}) {
    this.options = options;
    this.connections = new Map();
    this.discoveredApps = null;
    this.mongoose = null;
    this.isDevelopment = process.env.NODE_ENV === 'development';

    if (this.isDevelopment) {
      console.log('⚡ [AppKit] Mongoose adapter initialized with app discovery');
    }
  }

  /**
   * Creates Mongoose connection with app discovery and automatic connection management
   */
  async createClient(config: MongooseClientConfig): Promise<MongooseConnection> {
    if (!this.mongoose) {
      try {
        this.mongoose = (await import('mongoose')).default;
      } catch (error: any) {
        throw createDatabaseError(
          'Mongoose not found. Install with: npm install mongoose',
          500
        );
      }
    }

    const { url, maxPoolSize = 10, timeout = 10000, connectionOptions = {} } = config;
    const appName = config.appName || await this._detectCurrentApp();
    const clientKey = `${appName}_${url}_${maxPoolSize}_${timeout}`;

    if (!this.connections.has(clientKey)) {
      try {
        const connection = await this.mongoose.createConnection(url, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize,
          serverSelectionTimeoutMS: timeout,
          bufferCommands: false,
          bufferMaxEntries: 0,
          ...connectionOptions,
        });

        // Setup connection event handlers
        this._setupConnectionEvents(connection, url);

        // Load app-specific models
        await this._loadModelsForApp(connection, appName);

        // Add metadata
        connection._appKit = true;
        connection._appName = appName;
        connection._url = url;

        this.connections.set(clientKey, connection);

        if (this.isDevelopment) {
          console.log(`✅ [AppKit] Created Mongoose connection for app: ${appName}`);
        }
      } catch (error: any) {
        throw createDatabaseError(
          `Failed to create Mongoose connection for app '${appName}': ${error.message}`,
          500
        );
      }
    }

    return this.connections.get(clientKey)!;
  }

  /**
   * Apply tenant filtering middleware to Mongoose connection
   */
  async applyTenantMiddleware(
    connection: MongooseConnection,
    tenantId: string,
    options: TenantMiddlewareOptions = {}
  ): Promise<MongooseConnection> {
    const tenantField = options.fieldName || 'tenant_id';

    // Store original model function
    const originalModel = connection.model.bind(connection);

    // Override model function to add middleware
    connection.model = function (name: string, schema?: any, collection?: string): any {
      if (schema && !schema._tenantMiddlewareApplied) {
        // Mark schema as having middleware applied
        schema._tenantMiddlewareApplied = true;

        // Add tenant field to schema if not exists
        if (!schema.paths[tenantField]) {
          schema.add({
            [tenantField]: {
              type: String,
              required: false,
              index: true,
            },
          });
        }

        // Pre-save middleware - add tenant ID
        schema.pre('save', function (this: any) {
          if (!this[tenantField]) {
            this[tenantField] = tenantId;
          }
        });

        // Pre-insertMany middleware - add tenant ID to all documents
        schema.pre('insertMany', function (next: any, docs: any[]) {
          if (Array.isArray(docs)) {
            docs.forEach((doc) => {
              if (!doc[tenantField]) {
                doc[tenantField] = tenantId;
              }
            });
          }
          next();
        });

        // Query middleware - add tenant filter
        const queryMethods = [
          'find',
          'findOne',
          'findOneAndUpdate',
          'findOneAndDelete',
          'findOneAndRemove',
          'count',
          'countDocuments',
          'distinct',
          'estimatedDocumentCount',
        ];

        queryMethods.forEach((method) => {
          schema.pre(method, function (this: any) {
            const filter = this.getFilter();
            if (!filter[tenantField]) {
              this.where({ [tenantField]: tenantId });
            }
          });
        });

        // Update middleware - add tenant filter and data
        const updateMethods = ['updateOne', 'updateMany', 'replaceOne'];

        updateMethods.forEach((method) => {
          schema.pre(method, function (this: any) {
            const filter = this.getFilter();
            if (!filter[tenantField]) {
              this.where({ [tenantField]: tenantId });
            }

            // Also add tenant ID to update data if not present
            const update = this.getUpdate();
            if (update && typeof update === 'object' && !update[tenantField]) {
              if (update.$set) {
                update.$set[tenantField] = tenantId;
              } else {
                update[tenantField] = tenantId;
              }
            }
          });
        });

        // Delete middleware - add tenant filter
        const deleteMethods = ['deleteOne', 'deleteMany', 'remove'];

        deleteMethods.forEach((method) => {
          schema.pre(method, function (this: any) {
            const filter = this.getFilter();
            if (!filter[tenantField]) {
              this.where({ [tenantField]: tenantId });
            }
          });
        });

        // Aggregate middleware - add tenant match stage
        schema.pre('aggregate', function (this: any) {
          const pipeline = this.pipeline();

          // Check if tenant filter already exists in pipeline
          const hasMatch = pipeline.some(
            (stage: any) => stage.$match && stage.$match[tenantField]
          );

          if (!hasMatch) {
            // Add tenant filter as first stage
            pipeline.unshift({ $match: { [tenantField]: tenantId } });
          }
        });
      }

      return originalModel(name, schema, collection);
    };

    // Mark connection as tenant-filtered
    connection._tenantId = tenantId;
    connection._tenantFiltered = true;

    return connection;
  }

  /**
   * Auto-discover VoilaJSX apps with Mongoose models
   */
  async discoverApps(): Promise<DiscoveredApp[]> {
    if (this.discoveredApps) return this.discoveredApps;

    // Look for apps directory
    const appsDir = this._findAppsDirectory();
    if (!appsDir) {
      if (this.isDevelopment) {
        console.warn('⚠️  [AppKit] No /apps directory found, using single app mode');
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
        // VoilaJSX standard: apps/{appName}/models or apps/{appName}/src/models
        const possibleModelPaths = [
          path.join(appsDir, appName, 'models'),
          path.join(appsDir, appName, 'src/models'),
          path.join(appsDir, appName, 'lib/models'),
        ];

        let modelsPath: string | null = null;
        for (const modelPath of possibleModelPaths) {
          if (fs.existsSync(modelPath)) {
            modelsPath = modelPath;
            break;
          }
        }

        if (modelsPath) {
          apps.push({
            name: appName,
            modelsPath: path.resolve(modelsPath),
          });

          if (this.isDevelopment) {
            console.log(`✅ [AppKit] Found Mongoose models for app: ${appName}`);
          }
        } else if (this.isDevelopment) {
          console.log(`⚠️  [AppKit] No Mongoose models found for app: ${appName}`);
          console.log(`   Expected: ${possibleModelPaths.join(' or ')}`);
        }
      }

      this.discoveredApps = apps;
    } catch (error: any) {
      console.error('❌ [AppKit] Error discovering apps:', error.message);
      this.discoveredApps = [];
      return [];
    }

    if (this.isDevelopment) {
      console.log(`🔍 [AppKit] Discovered ${apps.length} apps with Mongoose models`);
    }

    return apps;
  }

  /**
   * Check if tenant registry collection exists
   */
  async hasTenantRegistry(connection: MongooseConnection): Promise<boolean> {
    try {
      const collections = await connection.db
        .listCollections({
          name: 'tenant_registry',
        })
        .toArray();

      return collections.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create tenant registry entry
   */
  async createTenantRegistryEntry(connection: MongooseConnection, tenantId: string): Promise<void> {
    try {
      const collection = connection.db.collection('tenant_registry');
      await collection.updateOne(
        { tenant_id: tenantId },
        {
          $set: {
            tenant_id: tenantId,
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error: any) {
      if (this.isDevelopment) {
        console.debug('Failed to create tenant registry entry:', error.message);
      }
    }
  }

  /**
   * Delete tenant registry entry
   */
  async deleteTenantRegistryEntry(connection: MongooseConnection, tenantId: string): Promise<void> {
    try {
      const collection = connection.db.collection('tenant_registry');
      await collection.deleteOne({ tenant_id: tenantId });
    } catch (error: any) {
      if (this.isDevelopment) {
        console.debug('Failed to delete tenant registry entry:', error.message);
      }
    }
  }

  /**
   * Check if tenant exists in registry
   */
  async tenantExistsInRegistry(connection: MongooseConnection, tenantId: string): Promise<boolean> {
    try {
      const collection = connection.db.collection('tenant_registry');
      const doc = await collection.findOne({ tenant_id: tenantId });
      return !!doc;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all tenants from registry
   */
  async getTenantsFromRegistry(connection: MongooseConnection): Promise<string[]> {
    try {
      const collection = connection.db.collection('tenant_registry');
      const docs = await collection
        .find(
          {},
          {
            projection: { tenant_id: 1, _id: 0 },
          }
        )
        .sort({ tenant_id: 1 })
        .toArray();

      return docs.map((doc: any) => doc.tenant_id);
    } catch (error) {
      return [];
    }
  }

  /**
   * Disconnect all cached connections
   */
  async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const [key, connection] of this.connections) {
      disconnectPromises.push(
        connection
          .close()
          .catch((error: any) =>
            console.warn(`Error disconnecting Mongoose connection ${key}:`, error.message)
          )
      );
    }

    await Promise.all(disconnectPromises);
    this.connections.clear();

    if (this.isDevelopment) {
      console.log('👋 [AppKit] Mongoose adapter disconnected');
    }
  }

  // Private helper methods

  /**
   * Detect current app from file path (VoilaJSX structure)
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
        console.warn('Failed to detect current app:', error.message);
      }
      return 'main';
    }
  }

  /**
   * Find apps directory in project structure
   */
  private _findAppsDirectory(): string | null {
    // Check environment variable first
    if (process.env.VOILA_APPS_DIR && fs.existsSync(process.env.VOILA_APPS_DIR)) {
      return process.env.VOILA_APPS_DIR;
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
   * Load models for specific app
   */
  private async _loadModelsForApp(connection: MongooseConnection, appName: string): Promise<void> {
    // First try discovered apps
    const apps = await this.discoverApps();
    const app = apps.find((a) => a.name === appName);

    if (app) {
      try {
        // Load all model files from the models directory
        const modelFiles = fs
          .readdirSync(app.modelsPath)
          .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
          .filter((file) => !file.endsWith('.d.ts'));

        for (const modelFile of modelFiles) {
          try {
            const modelPath = path.join(app.modelsPath, modelFile);
            const module = await import(`file://${modelPath}`);
            
            // Call model registration function if it exists
            if (typeof module.default === 'function') {
              await module.default(connection);
            } else if (typeof module.registerModels === 'function') {
              await module.registerModels(connection);
            }
          } catch (error: any) {
            if (this.isDevelopment) {
              console.warn(`Failed to load model ${modelFile} for app ${appName}:`, error.message);
            }
          }
        }

        if (this.isDevelopment) {
          console.log(`✅ [AppKit] Loaded ${modelFiles.length} models for app: ${appName}`);
        }
      } catch (error: any) {
        if (this.isDevelopment) {
          console.warn(`Failed to load models for app ${appName}:`, error.message);
        }
      }
    }
  }

  /**
   * Setup connection event handlers
   */
  private _setupConnectionEvents(connection: MongooseConnection, url: string): void {
    connection.on('connected', () => {
      if (this.isDevelopment) {
        console.debug(`MongoDB connected: ${this._maskUrl(url)}`);
      }
    });

    connection.on('error', (error: any) => {
      console.error(`MongoDB connection error: ${error.message}`);
    });

    connection.on('disconnected', () => {
      if (this.isDevelopment) {
        console.debug(`MongoDB disconnected: ${this._maskUrl(url)}`);
      }
    });

    connection.on('reconnected', () => {
      if (this.isDevelopment) {
        console.debug(`MongoDB reconnected: ${this._maskUrl(url)}`);
      }
    });
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