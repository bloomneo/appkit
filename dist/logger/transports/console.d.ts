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
import type { LogEntry, Transport } from '../logger.js';
import type { LoggingConfig } from '../defaults.js';
/**
 * Console transport with automatic formatting and smart minimal mode
 */
export declare class ConsoleTransport implements Transport {
    private colorize;
    private timestamps;
    private prettyPrint;
    private minimal;
    /**
     * Creates console transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization - gets config from environment defaults
     * @llm-rule AVOID: Manual configuration - environment detection handles this
     */
    constructor(config: LoggingConfig);
    /**
     * Write log entry to console with smart formatting
     * @llm-rule WHEN: Outputting logs to console for development or production
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     * @llm-rule NOTE: Skips visual error entries since they're handled by loggerClass.error() method directly
     */
    write(entry: LogEntry): void;
    /**
     * Check if entry should be skipped because it was already visually displayed
     * @llm-rule WHEN: Enhanced error() method has already shown visual formatting
     * @llm-rule AVOID: Double-displaying errors that have visual formatting
     */
    private shouldSkipVisualEntry;
    /**
     * Format for minimal mode - clean and simple, all logs visible
     * @llm-rule WHEN: Development mode with minimal scope for clean console
     * @llm-rule AVOID: Adding JSON metadata - defeats purpose of minimal mode
     * @llm-rule NOTE: Shows all logs but with clean formatting, no filtering
     */
    private formatMinimal;
    /**
     * Format for pretty development mode - full detail with JSON structure
     * @llm-rule WHEN: Development mode with full scope for detailed debugging
     * @llm-rule AVOID: In production - too verbose for production logs
     */
    private formatPretty;
    /**
     * Format for standard/production mode - structured but compact
     * @llm-rule WHEN: Production or when structured logs needed for parsing
     * @llm-rule AVOID: For development debugging - pretty mode is better
     */
    private formatStandard;
    /**
     * Get level label with emoji for visual identification
     * @llm-rule WHEN: Pretty or minimal formatting needs visual level indicators
     * @llm-rule AVOID: In production structured logs - use level text instead
     */
    private getLevelLabel;
    /**
     * Apply ANSI color codes for terminal output
     * @llm-rule WHEN: Development mode or when terminal supports colors
     * @llm-rule AVOID: In CI/CD or when colors not supported
     */
    private applyColor;
    /**
     * Output to appropriate console method based on level
     * @llm-rule WHEN: Final console output step
     * @llm-rule AVOID: Always using console.log - different levels use different methods
     */
    private outputToConsole;
    /**
     * Get numeric value for log level comparison
     * @llm-rule WHEN: Comparing log levels for filtering
     * @llm-rule AVOID: String comparison - numeric is more reliable
     */
    private getLevelValue;
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
     */
    shouldLog(level: string, configLevel: string): boolean;
    /**
     * Flush pending logs (no-op for console - immediate output)
     * @llm-rule WHEN: Logger cleanup or app shutdown
     * @llm-rule AVOID: Expecting async behavior - console writes immediately
     */
    flush(): Promise<void>;
    /**
     * Close transport (no-op for console - no resources to cleanup)
     * @llm-rule WHEN: Logger shutdown or transport cleanup
     * @llm-rule AVOID: Expecting cleanup behavior - console has no resources
     */
    close(): Promise<void>;
}
//# sourceMappingURL=console.d.ts.map