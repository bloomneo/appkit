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
export declare class DatabaseTransport implements Transport {
    private url;
    private table;
    private batchSize;
    private minimal;
    private client;
    private connected;
    private batch;
    private flushTimer;
    private dbType;
    /**
     * Creates database transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization with DATABASE_URL environment variable
     * @llm-rule AVOID: Manual database configuration - environment detection handles this
     * @llm-rule NOTE: Auto-detects database type from URL and creates appropriate connection
     */
    constructor(config: LoggingConfig);
    /**
     * Detect database type from connection URL
     * @llm-rule WHEN: Determining which database client to use
     * @llm-rule AVOID: Manual database type configuration - URL detection is automatic
     */
    private detectDatabaseType;
    /**
     * Initialize database transport with connection and table setup
     * @llm-rule WHEN: Transport creation - establishes connection and ensures table exists
     * @llm-rule AVOID: Calling manually - constructor handles initialization
     */
    private initialize;
    /**
     * Write log entry to database via batching
     * @llm-rule WHEN: Storing logs to database for centralized logging
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     */
    write(entry: LogEntry): void;
    /**
     * Optimize log entry for database storage
     * @llm-rule WHEN: Reducing database storage size and improving query performance
     * @llm-rule AVOID: Always using full entries - minimal scope reduces storage significantly
     */
    private optimizeEntry;
    /**
     * Filter metadata for essential correlation fields
     * @llm-rule WHEN: Keeping database size manageable while preserving correlation data
     * @llm-rule AVOID: Storing all metadata - focus on correlation and debugging fields
     */
    private filterEssentialMeta;
    /**
     * Connect to database with appropriate client
     * @llm-rule WHEN: Establishing database connection based on detected type
     * @llm-rule AVOID: Manual connection setup - auto-detection handles client selection
     */
    private connect;
    /**
     * Connect to PostgreSQL database
     * @llm-rule WHEN: DATABASE_URL starts with postgres:// or postgresql://
     * @llm-rule AVOID: Manual PostgreSQL setup - uses standard pg client
     */
    private connectPostgres;
    /**
     * Connect to MySQL database
     * @llm-rule WHEN: DATABASE_URL starts with mysql://
     * @llm-rule AVOID: Manual MySQL setup - uses standard mysql2 client
     */
    private connectMySQL;
    /**
     * Connect to SQLite database
     * @llm-rule WHEN: DATABASE_URL starts with sqlite://
     * @llm-rule AVOID: Manual SQLite setup - uses standard sqlite3 client
     */
    private connectSQLite;
    /**
     * Ensure logs table exists with optimized schema
     * @llm-rule WHEN: Database connection established - creates table if needed
     * @llm-rule AVOID: Manual table creation - automatic schema handles different databases
     */
    private ensureTableExists;
    /**
     * Get CREATE TABLE SQL for current database type
     * @llm-rule WHEN: Creating logs table with database-specific optimizations
     * @llm-rule AVOID: Generic SQL - each database has optimal data types and indexes
     */
    private getCreateTableSQL;
    /**
     * Execute database query with error handling
     * @llm-rule WHEN: Running SQL queries against the database
     * @llm-rule AVOID: Direct client usage - this handles database-specific differences
     */
    private executeQuery;
    /**
     * Setup automatic batch flushing
     * @llm-rule WHEN: Transport initialization - ensures logs are written regularly
     * @llm-rule AVOID: Manual flushing - automatic batching improves performance
     */
    private setupBatchFlush;
    /**
     * Flush current batch to database
     * @llm-rule WHEN: Batch is full or timer triggers
     * @llm-rule AVOID: Individual inserts - batching significantly improves performance
     */
    private flushBatch;
    /**
     * Insert batch of log entries efficiently
     * @llm-rule WHEN: Batch flush with multiple log entries
     * @llm-rule AVOID: Individual inserts - batch inserts are much faster
     */
    private insertBatch;
    /**
     * Insert batch for PostgreSQL with parameter placeholders
     */
    private insertBatchPostgres;
    /**
     * Insert batch for MySQL with question mark placeholders
     */
    private insertBatchMySQL;
    /**
     * Insert batch for SQLite with individual statements
     */
    private insertBatchSQLite;
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
     */
    shouldLog(level: string, configLevel: string): boolean;
    /**
     * Flush pending logs to database
     * @llm-rule WHEN: App shutdown or ensuring logs are persisted
     * @llm-rule AVOID: Frequent flushing - impacts performance
     */
    flush(): Promise<void>;
    /**
     * Close database transport and cleanup resources
     * @llm-rule WHEN: App shutdown or logger cleanup
     * @llm-rule AVOID: Abrupt shutdown - graceful close prevents data loss
     */
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map