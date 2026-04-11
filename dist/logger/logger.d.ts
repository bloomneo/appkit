/**
 * Core logger class with visual error display and simplified transport management
 * @module @bloomneo/appkit/logger
 * @file src/logger/logger.ts
 *
 * @llm-rule WHEN: Building logger instances - called via loggerClass.get(), not directly
 * @llm-rule AVOID: Creating LoggerClass directly - always use loggerClass.get() for proper setup
 * @llm-rule NOTE: Enhanced error() method provides automatic visual formatting for better DX
 */
import type { LoggingConfig } from './defaults.js';
import type { LogMeta, Logger } from './index.js';
export interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    [key: string]: any;
}
export interface Transport {
    write(entry: LogEntry): void | Promise<void>;
    shouldLog?(level: string, configLevel: string): boolean;
    flush?(): Promise<void>;
    close?(): Promise<void>;
}
export interface ErrorDiagnostic {
    type: 'warning' | 'error' | 'info' | 'success';
    message: string;
    fix?: string;
}
/**
 * Logger class with automatic transport management and enhanced error() method
 */
export declare class LoggerClass implements Logger {
    private level;
    private levelValue;
    private defaultMeta;
    private config;
    private transports;
    private pendingWrites;
    constructor(config: LoggingConfig);
    private initializeTransports;
    /**
     * Log informational message
     * @llm-rule WHEN: Normal application events, user actions, business logic flow
     * @llm-rule AVOID: Sensitive data in meta - passwords, tokens, full card numbers
     */
    info(message: string, meta?: LogMeta): void;
    /**
     * Enhanced error logging with automatic visual formatting
     * @llm-rule WHEN: Exceptions, failures, critical issues requiring attention
     * @llm-rule AVOID: Using for warnings - errors should indicate actual problems
     * @llm-rule NOTE: Automatically provides visual formatting in development with smart diagnostics
     */
    error(message: string, meta?: LogMeta): void;
    /**
     * Log warning message
     * @llm-rule WHEN: Potential issues, deprecated usage, performance concerns
     * @llm-rule AVOID: Using for normal recoverable errors - use error() for those
     */
    warn(message: string, meta?: LogMeta): void;
    /**
     * Log debug message
     * @llm-rule WHEN: Development debugging, detailed flow information
     * @llm-rule AVOID: Production debug spam - automatically filtered in production
     */
    debug(message: string, meta?: LogMeta): void;
    /**
     * Create child logger with additional context
     * @llm-rule WHEN: Adding component context or request-specific data
     * @llm-rule AVOID: Creating many child loggers - reuse component loggers
     */
    child(bindings: LogMeta): LoggerClass;
    private shouldShowVisual;
    private renderVisualError;
    /**
     * Wrap long error messages with proper indentation and path handling
     * @param message - The message to wrap
     * @param prefix - The prefix (like "❌ ERROR:" or "✗") to account for in width
     */
    private wrapErrorMessage;
    /**
     * Preprocess message to handle very long paths and URLs intelligently
     */
    private preprocessLongPaths;
    /**
     * Strip ANSI color codes to get actual text length
     */
    private stripAnsiCodes;
    private detectErrorType;
    private detectImportVsSyntax;
    private getErrorTitle;
    private generateDiagnostics;
    private getFixMessage;
    /**
     * Get contextual solutions based on error message patterns
     */
    private getSolutions;
    private getCaller;
    private log;
    private writeToTransports;
    /**
     * Flush pending logs to all transports
     * @llm-rule WHEN: App shutdown or ensuring logs are persisted before critical operations
     * @llm-rule AVOID: Frequent flushing during normal operations - impacts performance
     */
    flush(): Promise<void>;
    /**
     * Close logger and cleanup all transports
     * @llm-rule WHEN: App shutdown or logger cleanup - ensures graceful resource cleanup
     * @llm-rule AVOID: Calling during normal operations - this permanently closes the logger
     */
    close(): Promise<void>;
    /**
     * Get list of active transport names
     * @llm-rule WHEN: Debugging logger setup or checking which transports are running
     * @llm-rule AVOID: Using for business logic - this is for debugging and monitoring only
     */
    getActiveTransports(): string[];
    /**
     * Check if specific transport is active
     * @llm-rule WHEN: Conditionally logging based on transport availability
     * @llm-rule AVOID: Complex transport detection - just log normally, transports auto-enable
     */
    hasTransport(name: string): boolean;
    /**
     * Set minimum log level dynamically
     * @llm-rule WHEN: Runtime log level changes, debugging, or feature flags
     * @llm-rule AVOID: Frequent level changes - impacts performance
     */
    setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
    /**
     * Get current minimum log level
     * @llm-rule WHEN: Debugging configuration or checking level settings
     * @llm-rule AVOID: Using for filtering logic - logger handles level filtering automatically
     */
    getLevel(): string;
    /**
     * Check if specific log level would be written
     * @llm-rule WHEN: Expensive log message preparation - check before building complex meta
     * @llm-rule AVOID: Normal logging - level filtering is automatic and fast
     */
    isLevelEnabled(level: 'debug' | 'info' | 'warn' | 'error'): boolean;
    /**
     * Get current logger configuration for debugging
     * @llm-rule WHEN: Debugging logger setup, checking environment detection, or monitoring
     * @llm-rule AVOID: Using for runtime business logic - configuration is set at startup
     */
    getConfig(): {
        level: "error" | "warn" | "info" | "debug";
        scope: "minimal" | "full";
        minimal: boolean;
        transports: string[];
        service: {
            name: string;
            version: string;
            environment: string;
        };
        environment: {
            NODE_ENV: string | undefined;
            hasDbUrl: boolean;
            hasHttpUrl: boolean;
            hasWebhookUrl: boolean;
        };
    };
}
//# sourceMappingURL=logger.d.ts.map