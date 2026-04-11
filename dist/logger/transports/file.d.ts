/**
 * File transport with automatic rotation, retention and scope optimization
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/file.ts
 *
 * @llm-rule WHEN: Need persistent log storage with automatic file management
 * @llm-rule AVOID: Manual file handling - this manages rotation and cleanup automatically
 * @llm-rule NOTE: Auto-rotates daily and by size, cleans old files, optimizes for minimal/full scope
 */
import type { LogEntry, Transport } from '../logger.js';
import type { LoggingConfig } from '../defaults.js';
/**
 * File transport with built-in rotation, retention and scope optimization
 */
export declare class FileTransport implements Transport {
    private dir;
    private filename;
    private maxSize;
    private retentionDays;
    private minimal;
    private currentSize;
    private currentDate;
    private stream;
    private cleanupInterval;
    /**
     * Creates file transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization - gets config from environment defaults
     * @llm-rule AVOID: Manual file configuration - environment detection handles this
     */
    constructor(config: LoggingConfig);
    /**
     * Initialize file transport with directory and stream setup
     * @llm-rule WHEN: Transport creation - sets up directory and initial file
     * @llm-rule AVOID: Calling manually - constructor handles initialization
     */
    private initialize;
    /**
     * Write log entry to file with automatic rotation
     * @llm-rule WHEN: Storing logs to persistent file storage
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     */
    write(entry: LogEntry): Promise<void>;
    /**
     * Optimize log entry based on scope settings
     * @llm-rule WHEN: Reducing file size and focusing on essential data
     * @llm-rule AVOID: Always using full entries - minimal scope saves significant space
     */
    private optimizeEntry;
    /**
     * Optimize error object for file storage
     * @llm-rule WHEN: Storing error information efficiently in minimal mode
     * @llm-rule AVOID: Including full stack traces in production - security and size concerns
     */
    private optimizeError;
    /**
     * Filter metadata to keep only essential fields
     * @llm-rule WHEN: Minimizing file size while preserving correlation data
     * @llm-rule AVOID: Storing all metadata - focus on correlation and debugging fields
     */
    private filterEssentialMeta;
    /**
     * Write line to stream with timeout protection
     * @llm-rule WHEN: Writing to file stream safely
     * @llm-rule AVOID: Blocking writes - uses timeout to prevent hanging
     */
    private writeToStream;
    /**
     * Check if rotation is needed and perform it
     * @llm-rule WHEN: Before each write to manage file size and date rotation
     * @llm-rule AVOID: Manual rotation - automatic rotation prevents large files
     */
    private checkRotation;
    /**
     * Perform date-based rotation
     * @llm-rule WHEN: Date changes - creates new file for new day
     * @llm-rule AVOID: Manual date rotation - automatic daily rotation is better
     */
    private rotateDateBased;
    /**
     * Perform size-based rotation
     * @llm-rule WHEN: File exceeds max size - prevents huge log files
     * @llm-rule AVOID: Letting files grow infinitely - rotation maintains manageable sizes
     */
    private rotateSizeBased;
    /**
     * Create write stream for current log file
     * @llm-rule WHEN: Starting new file or after rotation
     * @llm-rule AVOID: Creating multiple streams - one stream per file
     */
    private createStream;
    /**
     * Close current stream safely
     * @llm-rule WHEN: Rotation, shutdown, or error recovery
     * @llm-rule AVOID: Abrupt stream closure - graceful close prevents data loss
     */
    private closeStream;
    /**
     * Get current date string for file naming
     * @llm-rule WHEN: Creating date-based file names
     * @llm-rule AVOID: Custom date formats - YYYY-MM-DD is standard and sortable
     */
    private getCurrentDate;
    /**
     * Get current log file path with date suffix
     * @llm-rule WHEN: Determining where to write current logs
     * @llm-rule AVOID: Hardcoded paths - use configurable directory and filename
     */
    private getCurrentFilepath;
    /**
     * Ensure log directory exists
     * @llm-rule WHEN: Transport initialization - creates directory if needed
     * @llm-rule AVOID: Assuming directory exists - auto-creation prevents errors
     */
    private ensureDirectoryExists;
    /**
     * Setup automatic cleanup of old log files
     * @llm-rule WHEN: Transport initialization - prevents disk space issues
     * @llm-rule AVOID: Manual cleanup - automatic retention prevents disk overflow
     */
    private setupRetentionCleanup;
    /**
     * Clean old log files based on retention policy
     * @llm-rule WHEN: Daily cleanup or transport initialization
     * @llm-rule AVOID: Keeping logs forever - retention policy prevents disk issues
     */
    private cleanOldLogs;
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
     */
    shouldLog(level: string, configLevel: string): boolean;
    /**
     * Flush pending logs to disk
     * @llm-rule WHEN: App shutdown or ensuring logs are persisted
     * @llm-rule AVOID: Frequent flushing - impacts performance
     */
    flush(): Promise<void>;
    /**
     * Close file transport and cleanup resources
     * @llm-rule WHEN: App shutdown or logger cleanup
     * @llm-rule AVOID: Abrupt shutdown - graceful close prevents data loss
     */
    close(): Promise<void>;
}
//# sourceMappingURL=file.d.ts.map