/**
 * Console transport with smart formatting, minimal mode support, and visual error enhancement
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/console.ts
 *
 * @llm-rule WHEN: Need console output for development or production monitoring
 * @llm-rule AVOID: Using console.log directly - this handles levels, colors, and formatting
 * @llm-rule NOTE: Auto-detects production/development mode and adjusts formatting accordingly
 * @llm-rule NOTE: Enhanced to work with visual error formatting from loggerClass.error() method
 */
/**
 * Console transport with automatic formatting and smart minimal mode
 */
export class ConsoleTransport {
    colorize;
    timestamps;
    prettyPrint;
    minimal;
    /**
     * Creates console transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization - gets config from environment defaults
     * @llm-rule AVOID: Manual configuration - environment detection handles this
     */
    constructor(config) {
        // Direct access to config (like auth module pattern)
        this.colorize = config.console.colorize;
        this.timestamps = config.console.timestamps;
        this.prettyPrint = config.console.prettyPrint;
        this.minimal = config.minimal;
    }
    /**
     * Write log entry to console with smart formatting
     * @llm-rule WHEN: Outputting logs to console for development or production
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     * @llm-rule NOTE: Skips visual error entries since they're handled by loggerClass.error() method directly
     */
    write(entry) {
        try {
            // Skip entries that have already been visually displayed by enhanced error() method
            if (this.shouldSkipVisualEntry(entry)) {
                return;
            }
            // Format based on mode
            let output;
            if (this.minimal) {
                // Minimal: clean format, no JSON metadata, all logs visible
                output = this.formatMinimal(entry);
            }
            else if (this.prettyPrint) {
                // Full scope with pretty JSON metadata for debugging
                output = this.formatPretty(entry);
            }
            else {
                // Standard format with compact JSON for production
                output = this.formatStandard(entry);
            }
            // Apply colors if enabled
            if (this.colorize) {
                output = this.applyColor(output, entry.level);
            }
            // Output to appropriate console method
            this.outputToConsole(output, entry.level);
        }
        catch (error) {
            // Never let logging break the application
            console.error('[@bloomneo/appkit/logger] Console transport error:', error.message);
        }
    }
    /**
     * Check if entry should be skipped because it was already visually displayed
     * @llm-rule WHEN: Enhanced error() method has already shown visual formatting
     * @llm-rule AVOID: Double-displaying errors that have visual formatting
     */
    shouldSkipVisualEntry(entry) {
        // Skip error entries in development that have visual formatting metadata
        const isDevelopment = process.env.NODE_ENV === 'development';
        const hasVisualFormatting = entry.level === 'error' &&
            (entry.errorType === 'DISPLAY_ERROR' ||
                entry.category ||
                entry.feature);
        // In development, if the enhanced error() method showed visual formatting,
        // we can skip the regular console output to avoid duplication
        const shouldShowVisual = isDevelopment ||
            !this.minimal ||
            process.env.BLOOM_VISUAL_ERRORS === 'true';
        return shouldShowVisual && hasVisualFormatting;
    }
    /**
     * Format for minimal mode - clean and simple, all logs visible
     * @llm-rule WHEN: Development mode with minimal scope for clean console
     * @llm-rule AVOID: Adding JSON metadata - defeats purpose of minimal mode
     * @llm-rule NOTE: Shows all logs but with clean formatting, no filtering
     */
    formatMinimal(entry) {
        const { level, message, component, error, _location, timestamp } = entry;
        // Clean timestamp - just time, no date or timezone
        const cleanTime = new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        // Special handling for Bloomneo startup messages (keep them prominent)
        if (message && (message.includes('✨') || message.includes('🚀') || message.includes('👋'))) {
            return `${cleanTime} ${message}`;
        }
        // Errors and warnings get enhanced formatting
        if (level === 'error' || level === 'warn') {
            let formatted = `${cleanTime} ${this.getLevelLabel(level)} ${message}`;
            // Show location for errors/warnings
            if (_location) {
                formatted += ` (${_location})`;
            }
            if (component) {
                formatted += ` [${component}]`;
            }
            // Add error details if present
            if (error) {
                const errorMsg = typeof error === 'object' ? error.message || error : error;
                formatted += `\n  ${errorMsg}`;
            }
            return formatted;
        }
        // For info/debug logs - clean format with essential info
        let formatted = `${cleanTime} ${message}`;
        // Add location for debugging (shows exactly where log came from)
        if (_location) {
            formatted += ` (${_location})`;
        }
        // Add component tag for filtering/context
        if (component) {
            formatted += ` [${component}]`;
        }
        return formatted;
    }
    /**
     * Format for pretty development mode - full detail with JSON structure
     * @llm-rule WHEN: Development mode with full scope for detailed debugging
     * @llm-rule AVOID: In production - too verbose for production logs
     */
    formatPretty(entry) {
        const { timestamp, level, message, ...meta } = entry;
        let formatted = '';
        if (this.timestamps) {
            formatted += `${timestamp} `;
        }
        formatted += `${this.getLevelLabel(level)} ${message}`;
        // Show location in pretty format for errors
        if (level === 'error' && entry._location) {
            formatted += `\n  📍 ${entry._location}`;
        }
        // Add pretty-printed metadata if present (excluding internal fields)
        const { _location, errorType, ...displayMeta } = meta;
        const metaKeys = Object.keys(displayMeta);
        if (metaKeys.length > 0) {
            formatted += '\n' + JSON.stringify(displayMeta, null, 2);
        }
        return formatted;
    }
    /**
     * Format for standard/production mode - structured but compact
     * @llm-rule WHEN: Production or when structured logs needed for parsing
     * @llm-rule AVOID: For development debugging - pretty mode is better
     */
    formatStandard(entry) {
        const { timestamp, level, message, ...meta } = entry;
        let formatted = '';
        if (this.timestamps) {
            formatted += `${timestamp} `;
        }
        formatted += `[${level.toUpperCase()}] ${message}`;
        // Add compact metadata if present (excluding internal fields)
        const { _location, errorType, ...displayMeta } = meta;
        const metaKeys = Object.keys(displayMeta);
        if (metaKeys.length > 0) {
            formatted += ` ${JSON.stringify(displayMeta)}`;
        }
        return formatted;
    }
    /**
     * Get level label with emoji for visual identification
     * @llm-rule WHEN: Pretty or minimal formatting needs visual level indicators
     * @llm-rule AVOID: In production structured logs - use level text instead
     */
    getLevelLabel(level) {
        const labels = {
            error: '❌ ERROR',
            warn: '⚠️  WARN',
            info: 'ℹ️  INFO',
            debug: '🐛 DEBUG',
        };
        return labels[level] || level.toUpperCase();
    }
    /**
     * Apply ANSI color codes for terminal output
     * @llm-rule WHEN: Development mode or when terminal supports colors
     * @llm-rule AVOID: In CI/CD or when colors not supported
     */
    applyColor(output, level) {
        const colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m', // Yellow
            info: '\x1b[36m', // Cyan
            debug: '\x1b[90m', // Gray
        };
        const reset = '\x1b[0m';
        const color = colors[level] || '';
        return `${color}${output}${reset}`;
    }
    /**
     * Output to appropriate console method based on level
     * @llm-rule WHEN: Final console output step
     * @llm-rule AVOID: Always using console.log - different levels use different methods
     */
    outputToConsole(output, level) {
        switch (level) {
            case 'error':
                console.error(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            case 'debug':
                if (typeof console.debug === 'function') {
                    console.debug(output);
                }
                else {
                    console.log(output);
                }
                break;
            default:
                console.log(output);
        }
    }
    /**
     * Get numeric value for log level comparison
     * @llm-rule WHEN: Comparing log levels for filtering
     * @llm-rule AVOID: String comparison - numeric is more reliable
     */
    getLevelValue(level) {
        const levels = {
            error: 0, warn: 1, info: 2, debug: 3
        };
        return levels[level] || 3;
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
     * Flush pending logs (no-op for console - immediate output)
     * @llm-rule WHEN: Logger cleanup or app shutdown
     * @llm-rule AVOID: Expecting async behavior - console writes immediately
     */
    async flush() {
        // Console transport writes immediately, no buffering
        return Promise.resolve();
    }
    /**
     * Close transport (no-op for console - no resources to cleanup)
     * @llm-rule WHEN: Logger shutdown or transport cleanup
     * @llm-rule AVOID: Expecting cleanup behavior - console has no resources
     */
    async close() {
        // Console transport has no resources to clean up
        return Promise.resolve();
    }
}
//# sourceMappingURL=console.js.map