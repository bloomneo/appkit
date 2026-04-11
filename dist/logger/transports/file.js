/**
 * File transport with automatic rotation, retention and scope optimization
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/file.ts
 *
 * @llm-rule WHEN: Need persistent log storage with automatic file management
 * @llm-rule AVOID: Manual file handling - this manages rotation and cleanup automatically
 * @llm-rule NOTE: Auto-rotates daily and by size, cleans old files, optimizes for minimal/full scope
 */
import fs from 'fs';
import path from 'path';
/**
 * File transport with built-in rotation, retention and scope optimization
 */
export class FileTransport {
    dir;
    filename;
    maxSize;
    retentionDays;
    minimal;
    // File state
    currentSize = 0;
    currentDate;
    stream = null;
    cleanupInterval = null;
    /**
     * Creates file transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization - gets config from environment defaults
     * @llm-rule AVOID: Manual file configuration - environment detection handles this
     */
    constructor(config) {
        // Direct access to config (like auth module pattern)
        this.dir = config.file.dir;
        this.filename = config.file.filename;
        this.maxSize = config.file.maxSize;
        this.retentionDays = config.file.retentionDays;
        this.minimal = config.minimal;
        this.currentDate = this.getCurrentDate();
        // Initialize file logging
        this.initialize();
    }
    /**
     * Initialize file transport with directory and stream setup
     * @llm-rule WHEN: Transport creation - sets up directory and initial file
     * @llm-rule AVOID: Calling manually - constructor handles initialization
     */
    initialize() {
        try {
            this.ensureDirectoryExists();
            this.createStream();
            this.setupRetentionCleanup();
        }
        catch (error) {
            console.error('File transport initialization failed:', error.message);
        }
    }
    /**
     * Write log entry to file with automatic rotation
     * @llm-rule WHEN: Storing logs to persistent file storage
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     */
    async write(entry) {
        try {
            await this.checkRotation();
            if (!this.stream || !this.stream.writable) {
                this.createStream();
            }
            // Optimize entry based on scope (minimal vs full)
            const optimizedEntry = this.optimizeEntry(entry);
            // Always write structured JSON to files
            const line = JSON.stringify(optimizedEntry) + '\n';
            const size = Buffer.byteLength(line);
            await this.writeToStream(line);
            this.currentSize += size;
        }
        catch (error) {
            console.error('File transport write error:', error.message);
        }
    }
    /**
     * Optimize log entry based on scope settings
     * @llm-rule WHEN: Reducing file size and focusing on essential data
     * @llm-rule AVOID: Always using full entries - minimal scope saves significant space
     */
    optimizeEntry(entry) {
        if (!this.minimal) {
            return entry; // Full scope - keep everything
        }
        // Minimal scope optimization for smaller files
        const { timestamp, level, message, component, requestId, userId, method, url, statusCode, durationMs, error, service, version, environment, ...rest } = entry;
        const minimal = {
            ts: timestamp,
            lvl: level,
            msg: message,
        };
        // Add essential context with short field names
        if (component)
            minimal.comp = component;
        if (requestId)
            minimal.req = requestId;
        if (userId)
            minimal.uid = userId;
        // Add HTTP context if present
        if (method)
            minimal.method = method;
        if (url)
            minimal.url = url;
        if (statusCode)
            minimal.status = statusCode;
        if (durationMs)
            minimal.dur = durationMs;
        // Add service context
        if (service)
            minimal.svc = service;
        if (version)
            minimal.ver = version;
        if (environment)
            minimal.env = environment;
        // Optimize error information
        if (error) {
            minimal.err = this.optimizeError(error);
        }
        // Add only essential metadata
        const essentialMeta = this.filterEssentialMeta(rest);
        if (Object.keys(essentialMeta).length > 0) {
            minimal.meta = essentialMeta;
        }
        return minimal;
    }
    /**
     * Optimize error object for file storage
     * @llm-rule WHEN: Storing error information efficiently in minimal mode
     * @llm-rule AVOID: Including full stack traces in production - security and size concerns
     */
    optimizeError(error) {
        if (typeof error === 'string') {
            return error;
        }
        if (typeof error === 'object' && error !== null) {
            const optimized = {
                message: error.message,
            };
            // Add important error fields
            if (error.name && error.name !== 'Error') {
                optimized.name = error.name;
            }
            if (error.code) {
                optimized.code = error.code;
            }
            if (error.statusCode) {
                optimized.statusCode = error.statusCode;
            }
            // Include stack trace only in development
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (isDevelopment && error.stack) {
                optimized.stack = error.stack;
            }
            return optimized;
        }
        return error;
    }
    /**
     * Filter metadata to keep only essential fields
     * @llm-rule WHEN: Minimizing file size while preserving correlation data
     * @llm-rule AVOID: Storing all metadata - focus on correlation and debugging fields
     */
    filterEssentialMeta(meta) {
        const essential = {};
        // Essential correlation fields
        const essentialKeys = [
            'traceId', 'spanId', 'sessionId', 'tenantId', 'ip'
        ];
        for (const key of essentialKeys) {
            if (meta[key] !== undefined) {
                essential[key] = meta[key];
            }
        }
        // Include any field ending with 'Id' (correlation IDs)
        for (const [key, value] of Object.entries(meta)) {
            if (key.endsWith('Id') && !essential[key]) {
                essential[key] = value;
            }
        }
        return essential;
    }
    /**
     * Write line to stream with timeout protection
     * @llm-rule WHEN: Writing to file stream safely
     * @llm-rule AVOID: Blocking writes - uses timeout to prevent hanging
     */
    writeToStream(line) {
        return new Promise((resolve) => {
            if (!this.stream || !this.stream.writable) {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                console.warn('File write timed out after 5000ms');
                resolve();
            }, 5000);
            this.stream.write(line, (error) => {
                clearTimeout(timeout);
                if (error) {
                    console.error('Error writing to log file:', error.message);
                    this.stream = null;
                }
                resolve();
            });
        });
    }
    /**
     * Check if rotation is needed and perform it
     * @llm-rule WHEN: Before each write to manage file size and date rotation
     * @llm-rule AVOID: Manual rotation - automatic rotation prevents large files
     */
    async checkRotation() {
        const currentDate = this.getCurrentDate();
        // Daily rotation
        if (currentDate !== this.currentDate) {
            await this.rotateDateBased();
            return;
        }
        // Size-based rotation
        if (this.currentSize >= this.maxSize) {
            await this.rotateSizeBased();
        }
    }
    /**
     * Perform date-based rotation
     * @llm-rule WHEN: Date changes - creates new file for new day
     * @llm-rule AVOID: Manual date rotation - automatic daily rotation is better
     */
    async rotateDateBased() {
        await this.closeStream();
        this.currentDate = this.getCurrentDate();
        this.currentSize = 0;
        this.createStream();
    }
    /**
     * Perform size-based rotation
     * @llm-rule WHEN: File exceeds max size - prevents huge log files
     * @llm-rule AVOID: Letting files grow infinitely - rotation maintains manageable sizes
     */
    async rotateSizeBased() {
        await this.closeStream();
        const currentFilepath = this.getCurrentFilepath();
        try {
            if (!fs.existsSync(currentFilepath)) {
                this.currentSize = 0;
                this.createStream();
                return;
            }
            // Find next rotation number
            let rotation = 1;
            while (fs.existsSync(`${currentFilepath}.${rotation}`)) {
                rotation++;
            }
            // Rename current file
            await fs.promises.rename(currentFilepath, `${currentFilepath}.${rotation}`);
        }
        catch (error) {
            console.error('Error during file rotation:', error.message);
        }
        this.currentSize = 0;
        this.createStream();
    }
    /**
     * Create write stream for current log file
     * @llm-rule WHEN: Starting new file or after rotation
     * @llm-rule AVOID: Creating multiple streams - one stream per file
     */
    createStream() {
        const filepath = this.getCurrentFilepath();
        try {
            // Get current file size if it exists
            if (fs.existsSync(filepath)) {
                const stats = fs.statSync(filepath);
                this.currentSize = stats.size;
            }
            else {
                this.currentSize = 0;
            }
            // Close existing stream
            if (this.stream) {
                this.stream.end();
            }
            // Create new write stream
            this.stream = fs.createWriteStream(filepath, { flags: 'a' });
            this.stream.on('error', (error) => {
                console.error('Log file write error:', error.message);
                this.stream = null;
            });
        }
        catch (error) {
            console.error('Error creating write stream:', error.message);
            this.stream = null;
        }
    }
    /**
     * Close current stream safely
     * @llm-rule WHEN: Rotation, shutdown, or error recovery
     * @llm-rule AVOID: Abrupt stream closure - graceful close prevents data loss
     */
    closeStream() {
        return new Promise((resolve) => {
            if (!this.stream) {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                console.warn('Stream close timed out after 5000ms');
                this.stream = null;
                resolve();
            }, 5000);
            this.stream.on('error', (error) => {
                console.error('Stream error during close:', error.message);
                clearTimeout(timeout);
                this.stream = null;
                resolve();
            });
            this.stream.end(() => {
                clearTimeout(timeout);
                this.stream = null;
                resolve();
            });
        });
    }
    /**
     * Get current date string for file naming
     * @llm-rule WHEN: Creating date-based file names
     * @llm-rule AVOID: Custom date formats - YYYY-MM-DD is standard and sortable
     */
    getCurrentDate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    /**
     * Get current log file path with date suffix
     * @llm-rule WHEN: Determining where to write current logs
     * @llm-rule AVOID: Hardcoded paths - use configurable directory and filename
     */
    getCurrentFilepath() {
        const base = path.basename(this.filename, path.extname(this.filename));
        const ext = path.extname(this.filename);
        const filename = `${base}-${this.currentDate}${ext}`;
        return path.join(this.dir, filename);
    }
    /**
     * Ensure log directory exists
     * @llm-rule WHEN: Transport initialization - creates directory if needed
     * @llm-rule AVOID: Assuming directory exists - auto-creation prevents errors
     */
    ensureDirectoryExists() {
        try {
            if (!fs.existsSync(this.dir)) {
                fs.mkdirSync(this.dir, { recursive: true });
            }
        }
        catch (error) {
            console.error('Error creating log directory:', error.message);
        }
    }
    /**
     * Setup automatic cleanup of old log files
     * @llm-rule WHEN: Transport initialization - prevents disk space issues
     * @llm-rule AVOID: Manual cleanup - automatic retention prevents disk overflow
     */
    setupRetentionCleanup() {
        // Clean old logs immediately
        this.cleanOldLogs();
        // Setup daily cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanOldLogs();
        }, 24 * 60 * 60 * 1000); // Daily
    }
    /**
     * Clean old log files based on retention policy
     * @llm-rule WHEN: Daily cleanup or transport initialization
     * @llm-rule AVOID: Keeping logs forever - retention policy prevents disk issues
     */
    async cleanOldLogs() {
        if (this.retentionDays <= 0)
            return;
        try {
            const files = await fs.promises.readdir(this.dir);
            const now = Date.now();
            const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
            const base = path.basename(this.filename, path.extname(this.filename));
            for (const file of files) {
                // Only clean files that match our log file pattern
                if (!file.startsWith(base)) {
                    continue;
                }
                const filepath = path.join(this.dir, file);
                try {
                    const stats = await fs.promises.stat(filepath);
                    if (now - stats.mtimeMs > maxAge) {
                        await fs.promises.unlink(filepath);
                        console.log(`Deleted old log file: ${file}`);
                    }
                }
                catch (error) {
                    console.error(`Error processing log file ${file}:`, error.message);
                }
            }
        }
        catch (error) {
            console.error('Error cleaning old logs:', error.message);
        }
    }
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
     */
    shouldLog(level, configLevel) {
        const levels = {
            error: 0, warn: 1, info: 2, debug: 3
        };
        return levels[level] <= levels[configLevel];
    }
    /**
     * Flush pending logs to disk
     * @llm-rule WHEN: App shutdown or ensuring logs are persisted
     * @llm-rule AVOID: Frequent flushing - impacts performance
     */
    async flush() {
        return new Promise((resolve) => {
            if (!this.stream || !this.stream.writable) {
                resolve();
                return;
            }
            if (this.stream.writableLength === 0) {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                console.warn('File flush timed out after 5000ms');
                resolve();
            }, 5000);
            this.stream.once('drain', () => {
                clearTimeout(timeout);
                resolve();
            });
            // Trigger drain event
            this.stream.write('');
        });
    }
    /**
     * Close file transport and cleanup resources
     * @llm-rule WHEN: App shutdown or logger cleanup
     * @llm-rule AVOID: Abrupt shutdown - graceful close prevents data loss
     */
    async close() {
        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        // Close stream gracefully
        await this.closeStream();
    }
}
//# sourceMappingURL=file.js.map