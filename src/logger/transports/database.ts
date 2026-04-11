/**
 * Database transport with automatic connection management and batch processing
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/database.ts
 * 
 * @llm-rule WHEN: Need centralized log storage with database persistence
 * @llm-rule AVOID: Manual database setup - auto-detects from DATABASE_URL and creates tables
 * @llm-rule NOTE: Supports PostgreSQL, MySQL, SQLite with automatic batching and retry logic
 */

import type { LogEntry, Transport } from '../logger.js';
import type { LoggingConfig } from '../defaults.js';

/**
 * Database transport with automatic connection and table management
 */
export class DatabaseTransport implements Transport {
  private url: string;
  private table: string;
  private batchSize: number;
  private minimal: boolean;
  
  // Database state
  private client: any = null;
  private connected = false;
  private batch: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private dbType: 'postgres' | 'mysql' | 'sqlite' = 'postgres';

  /**
   * Creates database transport with direct environment access (like auth pattern)
   * @llm-rule WHEN: Logger initialization with DATABASE_URL environment variable
   * @llm-rule AVOID: Manual database configuration - environment detection handles this
   * @llm-rule NOTE: Auto-detects database type from URL and creates appropriate connection
   */
  constructor(config: LoggingConfig) {
    // Direct access to config (like auth module pattern)
    this.url = config.database.url!;
    this.table = config.database.table;
    this.batchSize = config.database.batchSize;
    this.minimal = config.minimal;
    
    // Detect database type from URL
    this.dbType = this.detectDatabaseType(this.url);
    
    // Initialize database connection
    this.initialize();
  }

  /**
   * Detect database type from connection URL
   * @llm-rule WHEN: Determining which database client to use
   * @llm-rule AVOID: Manual database type configuration - URL detection is automatic
   */
  private detectDatabaseType(url: string): 'postgres' | 'mysql' | 'sqlite' {
    const parsed = new URL(url);
    
    if (parsed.protocol.startsWith('postgres')) return 'postgres';
    if (parsed.protocol.startsWith('mysql')) return 'mysql';
    if (parsed.protocol.startsWith('sqlite')) return 'sqlite';
    
    return 'postgres'; // Default fallback
  }

  /**
   * Initialize database transport with connection and table setup
   * @llm-rule WHEN: Transport creation - establishes connection and ensures table exists
   * @llm-rule AVOID: Calling manually - constructor handles initialization
   */
  private async initialize(): Promise<void> {
    try {
      await this.connect();
      await this.ensureTableExists();
      this.setupBatchFlush();
    } catch (error) {
      console.error('Database transport initialization failed:', (error as Error).message);
    }
  }

  /**
   * Write log entry to database via batching
   * @llm-rule WHEN: Storing logs to database for centralized logging
   * @llm-rule AVOID: Calling directly - logger routes entries automatically
   */
  write(entry: LogEntry): void {
    try {
      // Optimize entry based on scope
      const optimizedEntry = this.optimizeEntry(entry);
      
      // Add to batch
      this.batch.push(optimizedEntry);

      // Flush if batch is full
      if (this.batch.length >= this.batchSize) {
        this.flushBatch();
      }
    } catch (error) {
      console.error('Database transport write error:', (error as Error).message);
    }
  }

  /**
   * Optimize log entry for database storage
   * @llm-rule WHEN: Reducing database storage size and improving query performance
   * @llm-rule AVOID: Always using full entries - minimal scope reduces storage significantly
   */
  private optimizeEntry(entry: LogEntry): any {
    if (!this.minimal) {
      return entry; // Full scope - keep everything
    }

    // Minimal scope optimization for database
    const {
      timestamp,
      level,
      message,
      component,
      requestId,
      userId,
      method,
      url,
      statusCode,
      durationMs,
      error,
      service,
      version,
      environment,
      ...rest
    } = entry;

    const minimal: any = {
      timestamp,
      level,
      message,
    };

    // Add essential fields for correlation (with database-friendly names)
    if (component) minimal.component = component;
    if (requestId) minimal.request_id = requestId;
    if (userId) minimal.user_id = userId;

    // Add HTTP context for API monitoring
    if (method) minimal.method = method;
    if (url) minimal.url = url;
    if (statusCode) minimal.status_code = statusCode;
    if (durationMs) minimal.duration_ms = durationMs;

    // Add service identification
    if (service) minimal.service = service;
    if (version) minimal.version = version;
    if (environment) minimal.environment = environment;

    // Optimize error information
    if (error) {
      if (typeof error === 'object') {
        minimal.error_message = error.message;
        if (error.code) minimal.error_code = error.code;
      } else {
        minimal.error_message = error;
      }
    }

    // Add only essential metadata as JSON
    const essentialMeta = this.filterEssentialMeta(rest);
    if (Object.keys(essentialMeta).length > 0) {
      minimal.meta = essentialMeta;
    }

    return minimal;
  }

  /**
   * Filter metadata for essential correlation fields
   * @llm-rule WHEN: Keeping database size manageable while preserving correlation data
   * @llm-rule AVOID: Storing all metadata - focus on correlation and debugging fields
   */
  private filterEssentialMeta(meta: any): any {
    const essential: any = {};

    // Essential correlation fields for database queries
    const essentialKeys = [
      'traceId', 'spanId', 'sessionId', 'tenantId', 'appName', 'ip'
    ];

    for (const key of essentialKeys) {
      if (meta[key] !== undefined) {
        essential[key] = meta[key];
      }
    }

    // Include correlation IDs (fields ending with 'Id')
    for (const [key, value] of Object.entries(meta)) {
      if (key.endsWith('Id') && !essential[key]) {
        essential[key] = value;
      }
    }

    return essential;
  }

  /**
   * Connect to database with appropriate client
   * @llm-rule WHEN: Establishing database connection based on detected type
   * @llm-rule AVOID: Manual connection setup - auto-detection handles client selection
   */
  private async connect(): Promise<void> {
    try {
      switch (this.dbType) {
        case 'postgres':
          await this.connectPostgres();
          break;
        case 'mysql':
          await this.connectMySQL();
          break;
        case 'sqlite':
          await this.connectSQLite();
          break;
      }
      
      this.connected = true;
      console.log(`Database transport connected successfully (${this.dbType})`);
    } catch (error) {
      console.error('Database connection failed:', (error as Error).message);
      this.connected = false;
    }
  }

  /**
   * Connect to PostgreSQL database
   * @llm-rule WHEN: DATABASE_URL starts with postgres:// or postgresql://
   * @llm-rule AVOID: Manual PostgreSQL setup - uses standard pg client
   */
  private async connectPostgres(): Promise<void> {
    try {
      const { Client } = await import('pg');
      this.client = new Client({
        connectionString: this.url,
        connectionTimeoutMillis: 10000,
      });
      await this.client.connect();
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Connect to MySQL database
   * @llm-rule WHEN: DATABASE_URL starts with mysql://
   * @llm-rule AVOID: Manual MySQL setup - uses standard mysql2 client
   */
  private async connectMySQL(): Promise<void> {
    try {
      const mysql = await import('mysql2/promise');
      this.client = await mysql.createConnection(this.url);
    } catch (error) {
      throw new Error(`MySQL connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Connect to SQLite database
   * @llm-rule WHEN: DATABASE_URL starts with sqlite://
   * @llm-rule AVOID: Manual SQLite setup - uses standard sqlite3 client
   */
  private async connectSQLite(): Promise<void> {
    try {
      const sqlite3 = await import('sqlite3');
      const { open } = await import('sqlite');

      const url = new URL(this.url);
      const dbPath = url.pathname || ':memory:';

      this.client = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });
    } catch (error) {
      throw new Error(`SQLite connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure logs table exists with optimized schema
   * @llm-rule WHEN: Database connection established - creates table if needed
   * @llm-rule AVOID: Manual table creation - automatic schema handles different databases
   */
  private async ensureTableExists(): Promise<void> {
    if (!this.connected) return;

    try {
      const createTableSQL = this.getCreateTableSQL();
      await this.executeQuery(createTableSQL);
    } catch (error) {
      console.error('Error creating logs table:', (error as Error).message);
    }
  }

  /**
   * Get CREATE TABLE SQL for current database type
   * @llm-rule WHEN: Creating logs table with database-specific optimizations
   * @llm-rule AVOID: Generic SQL - each database has optimal data types and indexes
   */
  private getCreateTableSQL(): string {
    switch (this.dbType) {
      case 'postgres':
        return `
          CREATE TABLE IF NOT EXISTS ${this.table} (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ NOT NULL,
            level VARCHAR(10) NOT NULL,
            message TEXT,
            component VARCHAR(100),
            request_id VARCHAR(100),
            user_id VARCHAR(100),
            method VARCHAR(10),
            url TEXT,
            status_code INTEGER,
            duration_ms INTEGER,
            error_message TEXT,
            error_code VARCHAR(50),
            service VARCHAR(100),
            version VARCHAR(50),
            environment VARCHAR(50),
            meta JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_${this.table}_timestamp ON ${this.table}(timestamp);
          CREATE INDEX IF NOT EXISTS idx_${this.table}_level ON ${this.table}(level);
          CREATE INDEX IF NOT EXISTS idx_${this.table}_component ON ${this.table}(component);
          CREATE INDEX IF NOT EXISTS idx_${this.table}_request_id ON ${this.table}(request_id);
        `;

      case 'mysql':
        return `
          CREATE TABLE IF NOT EXISTS ${this.table} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            timestamp DATETIME NOT NULL,
            level VARCHAR(10) NOT NULL,
            message TEXT,
            component VARCHAR(100),
            request_id VARCHAR(100),
            user_id VARCHAR(100),
            method VARCHAR(10),
            url TEXT,
            status_code INT,
            duration_ms INT,
            error_message TEXT,
            error_code VARCHAR(50),
            service VARCHAR(100),
            version VARCHAR(50),
            environment VARCHAR(50),
            meta JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_timestamp (timestamp),
            INDEX idx_level (level),
            INDEX idx_component (component),
            INDEX idx_request_id (request_id)
          );
        `;

      case 'sqlite':
        return `
          CREATE TABLE IF NOT EXISTS ${this.table} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT,
            component TEXT,
            request_id TEXT,
            user_id TEXT,
            method TEXT,
            url TEXT,
            status_code INTEGER,
            duration_ms INTEGER,
            error_message TEXT,
            error_code TEXT,
            service TEXT,
            version TEXT,
            environment TEXT,
            meta TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_${this.table}_timestamp ON ${this.table}(timestamp);
          CREATE INDEX IF NOT EXISTS idx_${this.table}_level ON ${this.table}(level);
        `;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * Execute database query with error handling
   * @llm-rule WHEN: Running SQL queries against the database
   * @llm-rule AVOID: Direct client usage - this handles database-specific differences
   */
  private async executeQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.connected || !this.client) {
      throw new Error('Database not connected');
    }

    try {
      switch (this.dbType) {
        case 'postgres':
          return await this.client.query(sql, params);
        case 'mysql':
          return await this.client.execute(sql, params);
        case 'sqlite':
          if (params.length > 0) {
            return await this.client.run(sql, params);
          } else {
            return await this.client.exec(sql);
          }
        default:
          throw new Error(`Unsupported database type: ${this.dbType}`);
      }
    } catch (error) {
      throw new Error(`Database query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Setup automatic batch flushing
   * @llm-rule WHEN: Transport initialization - ensures logs are written regularly
   * @llm-rule AVOID: Manual flushing - automatic batching improves performance
   */
  private setupBatchFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.batch.length > 0) {
        this.flushBatch();
      }
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Flush current batch to database
   * @llm-rule WHEN: Batch is full or timer triggers
   * @llm-rule AVOID: Individual inserts - batching significantly improves performance
   */
  private async flushBatch(): Promise<void> {
    if (this.batch.length === 0 || !this.connected) {
      return;
    }

    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      await this.insertBatch(currentBatch);
    } catch (error) {
      console.error('Database batch flush failed:', (error as Error).message);
      // Re-add failed entries for retry (up to batch size limit)
      const retryEntries = currentBatch.slice(0, this.batchSize);
      this.batch.unshift(...retryEntries);
    }
  }

  /**
   * Insert batch of log entries efficiently
   * @llm-rule WHEN: Batch flush with multiple log entries
   * @llm-rule AVOID: Individual inserts - batch inserts are much faster
   */
  private async insertBatch(entries: any[]): Promise<void> {
    if (entries.length === 0) return;

    const fields = [
      'timestamp', 'level', 'message', 'component', 'request_id', 'user_id',
      'method', 'url', 'status_code', 'duration_ms', 'error_message', 'error_code',
      'service', 'version', 'environment', 'meta'
    ];

    switch (this.dbType) {
      case 'postgres':
        await this.insertBatchPostgres(entries, fields);
        break;
      case 'mysql':
        await this.insertBatchMySQL(entries, fields);
        break;
      case 'sqlite':
        await this.insertBatchSQLite(entries, fields);
        break;
    }
  }

  /**
   * Insert batch for PostgreSQL with parameter placeholders
   */
  private async insertBatchPostgres(entries: any[], fields: string[]): Promise<void> {
    const placeholders = entries
      .map((_, index) => {
        const startIndex = index * fields.length;
        return `(${fields.map((_, fieldIndex) => `$${startIndex + fieldIndex + 1}`).join(', ')})`;
      })
      .join(', ');

    const params = entries.flatMap(entry => fields.map(field => {
      const value = entry[field];
      return field === 'meta' && value ? JSON.stringify(value) : (value || null);
    }));

    const sql = `INSERT INTO ${this.table} (${fields.join(', ')}) VALUES ${placeholders}`;
    await this.executeQuery(sql, params);
  }

  /**
   * Insert batch for MySQL with question mark placeholders
   */
  private async insertBatchMySQL(entries: any[], fields: string[]): Promise<void> {
    const placeholders = entries.map(() => `(${fields.map(() => '?').join(', ')})`).join(', ');
    
    const params = entries.flatMap(entry => fields.map(field => {
      const value = entry[field];
      return field === 'meta' && value ? JSON.stringify(value) : (value || null);
    }));

    const sql = `INSERT INTO ${this.table} (${fields.join(', ')}) VALUES ${placeholders}`;
    await this.executeQuery(sql, params);
  }

  /**
   * Insert batch for SQLite with individual statements
   */
  private async insertBatchSQLite(entries: any[], fields: string[]): Promise<void> {
    const sql = `INSERT INTO ${this.table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
    
    for (const entry of entries) {
      const params = fields.map(field => {
        const value = entry[field];
        return field === 'meta' && value ? JSON.stringify(value) : (value || null);
      });
      
      await this.executeQuery(sql, params);
    }
  }

  /**
   * Check if this transport should log the given level
   * @llm-rule WHEN: Logger asks if transport handles this level
   * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
   */
  shouldLog(level: string, configLevel: string): boolean {
    const levels: Record<string, number> = { 
      error: 0, warn: 1, info: 2, debug: 3 
    };
    return levels[level] <= levels[configLevel];
  }

  /**
   * Flush pending logs to database
   * @llm-rule WHEN: App shutdown or ensuring logs are persisted
   * @llm-rule AVOID: Frequent flushing - impacts performance
   */
  async flush(): Promise<void> {
    await this.flushBatch();
  }

  /**
   * Close database transport and cleanup resources
   * @llm-rule WHEN: App shutdown or logger cleanup
   * @llm-rule AVOID: Abrupt shutdown - graceful close prevents data loss
   */
  async close(): Promise<void> {
    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining logs
    await this.flushBatch();

    // Close database connection
    if (this.client && this.connected) {
      try {
        switch (this.dbType) {
          case 'postgres':
          case 'mysql':
            await this.client.end();
            break;
          case 'sqlite':
            await this.client.close();
            break;
        }
      } catch (error) {
        console.error('Error closing database connection:', (error as Error).message);
      }
    }

    this.connected = false;
    this.client = null;
  }
}