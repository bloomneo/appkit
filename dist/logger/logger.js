/**
 * Core logger class with visual error display and simplified transport management
 * @module @bloomneo/appkit/logger
 * @file src/logger/logger.ts
 *
 * @llm-rule WHEN: Building logger instances - called via loggerClass.get(), not directly
 * @llm-rule AVOID: Creating LoggerClass directly - always use loggerClass.get() for proper setup
 * @llm-rule NOTE: Enhanced error() method provides automatic visual formatting for better DX
 */
import { ConsoleTransport } from './transports/console.js';
import { FileTransport } from './transports/file.js';
import { DatabaseTransport } from './transports/database.js';
import { HttpTransport } from './transports/http.js';
import { WebhookTransport } from './transports/webhook.js';
import { existsSync } from 'fs';
import { join } from 'path';
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
/**
 * Logger class with automatic transport management and enhanced error() method
 */
export class LoggerClass {
    level;
    levelValue;
    defaultMeta;
    config;
    transports = new Map();
    pendingWrites = [];
    constructor(config) {
        this.config = config;
        this.level = config.level;
        this.levelValue = LOG_LEVELS[this.level];
        this.defaultMeta = {
            service: config.service.name,
            version: config.service.version,
            environment: config.service.environment,
        };
        this.initializeTransports();
    }
    initializeTransports() {
        const { transports } = this.config;
        if (transports.console) {
            this.transports.set('console', new ConsoleTransport(this.config));
        }
        if (transports.file) {
            try {
                this.transports.set('file', new FileTransport(this.config));
            }
            catch (error) {
                console.error('File transport initialization failed:', error.message);
            }
        }
        if (transports.database && this.config.database.url) {
            try {
                this.transports.set('database', new DatabaseTransport(this.config));
            }
            catch (error) {
                console.error('Database transport initialization failed:', error.message);
            }
        }
        if (transports.http && this.config.http.url) {
            try {
                this.transports.set('http', new HttpTransport(this.config));
            }
            catch (error) {
                console.error('HTTP transport initialization failed:', error.message);
            }
        }
        if (transports.webhook && this.config.webhook.url) {
            try {
                this.transports.set('webhook', new WebhookTransport(this.config));
            }
            catch (error) {
                console.error('Webhook transport initialization failed:', error.message);
            }
        }
        if (this.transports.size === 0) {
            console.warn('No transports initialized, falling back to console');
            this.transports.set('console', new ConsoleTransport(this.config));
        }
    }
    /**
     * Log informational message
     * @llm-rule WHEN: Normal application events, user actions, business logic flow
     * @llm-rule AVOID: Sensitive data in meta - passwords, tokens, full card numbers
     */
    info(message, meta = {}) {
        this.log('info', message, meta);
    }
    /**
     * Enhanced error logging with automatic visual formatting
     * @llm-rule WHEN: Exceptions, failures, critical issues requiring attention
     * @llm-rule AVOID: Using for warnings - errors should indicate actual problems
     * @llm-rule NOTE: Automatically provides visual formatting in development with smart diagnostics
     */
    error(message, meta = {}) {
        const enhancedMeta = {
            ...meta,
            _location: this.getCaller()
        };
        // Detect error type and provide visual formatting if appropriate
        if (this.shouldShowVisual()) {
            this.renderVisualError(message, enhancedMeta);
        }
        // Always log structured data for production/debugging
        this.log('error', message, enhancedMeta);
    }
    /**
     * Log warning message
     * @llm-rule WHEN: Potential issues, deprecated usage, performance concerns
     * @llm-rule AVOID: Using for normal recoverable errors - use error() for those
     */
    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }
    /**
     * Log debug message
     * @llm-rule WHEN: Development debugging, detailed flow information
     * @llm-rule AVOID: Production debug spam - automatically filtered in production
     */
    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }
    /**
     * Log fatal message — process is about to exit or is in an unrecoverable state.
     * Delegates to error() so it goes through the same visual formatting and transports.
     * @llm-rule WHEN: Unrecoverable failures (OOM, missing required config, corrupted state)
     * @llm-rule AVOID: Using for normal errors — fatal implies the process cannot continue
     * @llm-rule NOTE: PATTERN: logger.fatal('OOM', { rss }); process.exit(1);
     */
    fatal(message, meta = {}) {
        this.error(message, { ...meta, fatal: true });
    }
    /**
     * Create child logger with additional context
     * @llm-rule WHEN: Adding component context or request-specific data
     * @llm-rule AVOID: Creating many child loggers - reuse component loggers
     */
    child(bindings) {
        const child = Object.create(this);
        child.defaultMeta = { ...this.defaultMeta, ...bindings };
        return child;
    }
    // ============================================================================
    // VISUAL ERROR FORMATTING METHODS
    // ============================================================================
    shouldShowVisual() {
        // Show visual output in development or when explicitly enabled
        return this.config.service.environment === 'development' ||
            this.config.minimal === false ||
            process.env.BLOOM_VISUAL_ERRORS === 'true';
    }
    renderVisualError(message, meta) {
        const errorType = this.detectErrorType(message, meta);
        const title = this.getErrorTitle(errorType);
        const diagnostics = this.generateDiagnostics(message, meta, errorType);
        const colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            cyan: '\x1b[36m',
            gray: '\x1b[90m'
        };
        console.log();
        console.log(`${colors.red}╭─ ${title}${colors.reset}`);
        if (meta.feature) {
            console.log(`${colors.red}│${colors.reset} Feature: ${colors.cyan}${meta.feature}${colors.reset}`);
        }
        if (meta.file) {
            console.log(`${colors.red}│${colors.reset} File:    ${colors.yellow}${meta.file}${colors.reset}`);
        }
        console.log(`${colors.red}│${colors.reset}`);
        // ✅ Enhanced error message with wrapping
        const errorPrefix = `${colors.red}❌ ERROR:${colors.reset}`;
        const wrappedMessage = this.wrapErrorMessage(message, errorPrefix);
        wrappedMessage.forEach((line, index) => {
            if (index === 0) {
                console.log(`${colors.red}│${colors.reset} ${line}`);
            }
            else {
                console.log(`${colors.red}│${colors.reset}${line}`); // Continuation lines
            }
        });
        // Show location/position if available
        if (meta._location) {
            console.log(`${colors.red}│${colors.reset} ${colors.cyan}📍 FROM:${colors.reset}  ${meta._location}`);
        }
        // Extract and show line/position for syntax errors with wrapping
        const lineMatch = message.match(/at line (\d+):(\d+)/i) || message.match(/line (\d+)/i);
        if (lineMatch) {
            console.log(`${colors.red}│${colors.reset} ${colors.cyan}📍 LINE:${colors.reset}  ${lineMatch[1]}${lineMatch[2] ? `:${lineMatch[2]}` : ''}`);
        }
        // Show code context for syntax errors if available
        if (message.includes('Unexpected token') || message.includes('SyntaxError')) {
            const tokenMatch = message.match(/'([^']+)'/);
            if (tokenMatch) {
                console.log(`${colors.red}│${colors.reset} ${colors.cyan}📍 NEAR:${colors.reset}  ...${tokenMatch[1]}...`);
                console.log(`${colors.red}│${colors.reset}                    ${colors.red}^${colors.reset}`);
            }
        }
        console.log(`${colors.red}│${colors.reset}`);
        // Show smart diagnostics
        diagnostics.forEach(diagnostic => {
            const icon = diagnostic.type === 'error' ? '✗' :
                diagnostic.type === 'warning' ? '⚠' :
                    diagnostic.type === 'success' ? '✓' : 'ℹ';
            const color = diagnostic.type === 'error' ? colors.red :
                diagnostic.type === 'warning' ? colors.yellow :
                    diagnostic.type === 'success' ? colors.green : colors.cyan;
            // Wrap diagnostic messages too
            const diagnosticPrefix = `${color}${icon}${colors.reset}`;
            const wrappedDiagnostic = this.wrapErrorMessage(diagnostic.message, diagnosticPrefix);
            wrappedDiagnostic.forEach((line, index) => {
                if (index === 0) {
                    console.log(`${colors.red}│${colors.reset} ${line}`);
                }
                else {
                    console.log(`${colors.red}│${colors.reset}${line}`);
                }
            });
            if (diagnostic.fix) {
                const fixPrefix = `${colors.green}✓${colors.reset}`;
                const wrappedFix = this.wrapErrorMessage(diagnostic.fix, fixPrefix);
                wrappedFix.forEach((line, index) => {
                    if (index === 0) {
                        console.log(`${colors.red}│${colors.reset} ${line}`);
                    }
                    else {
                        console.log(`${colors.red}│${colors.reset}${line}`);
                    }
                });
            }
        });
        const solutions = this.getSolutions(errorType, message);
        if (solutions.length > 0) {
            console.log(`${colors.red}│${colors.reset}`);
            solutions.forEach(solution => {
                const solutionPrefix = `${colors.green}✓${colors.reset}`;
                const wrappedSolution = this.wrapErrorMessage(solution, solutionPrefix);
                wrappedSolution.forEach((line, index) => {
                    if (index === 0) {
                        console.log(`${colors.red}│${colors.reset} ${line}`);
                    }
                    else {
                        console.log(`${colors.red}│${colors.reset}${line}`);
                    }
                });
            });
        }
        // Enhanced fix message based on error type
        const fixMessage = this.getFixMessage(errorType, message);
        console.log(`${colors.red}╰─ FIX: ${colors.green}${fixMessage}${colors.reset}`);
        console.log();
    }
    /**
     * Wrap long error messages with proper indentation and path handling
     * @param message - The message to wrap
     * @param prefix - The prefix (like "❌ ERROR:" or "✗") to account for in width
     */
    wrapErrorMessage(message, prefix = '') {
        const maxWidth = 85; // Terminal width accounting for borders
        const indent = '         '; // 9 spaces for continuation lines
        const prefixLength = this.stripAnsiCodes(prefix).length; // Account for prefix in first line
        const firstLineMaxWidth = maxWidth - prefixLength - 1; // -1 for space after prefix
        const continuationMaxWidth = maxWidth - indent.length;
        const lines = [];
        let currentLine = '';
        let isFirstLine = true;
        // Handle very long paths/URLs by splitting them intelligently
        const processedMessage = this.preprocessLongPaths(message);
        const words = processedMessage.split(' ');
        for (const word of words) {
            const currentMaxWidth = isFirstLine ? firstLineMaxWidth : continuationMaxWidth;
            const proposedLine = currentLine + (currentLine ? ' ' : '') + word;
            if (proposedLine.length > currentMaxWidth) {
                // Current line would be too long
                if (currentLine) {
                    // Save current line
                    if (isFirstLine) {
                        lines.push(`${prefix}${currentLine ? ' ' + currentLine : ''}`);
                        isFirstLine = false;
                    }
                    else {
                        lines.push(`${indent}${currentLine}`);
                    }
                    currentLine = word;
                }
                else {
                    // Single word is too long, force it on its own line
                    if (isFirstLine) {
                        lines.push(`${prefix}${word ? ' ' + word : ''}`);
                        isFirstLine = false;
                    }
                    else {
                        lines.push(`${indent}${word}`);
                    }
                    currentLine = '';
                }
            }
            else {
                currentLine = proposedLine;
            }
        }
        // Add remaining content
        if (currentLine) {
            if (isFirstLine) {
                lines.push(`${prefix}${currentLine ? ' ' + currentLine : ''}`);
            }
            else {
                lines.push(`${indent}${currentLine}`);
            }
        }
        // Handle empty prefix case
        if (lines.length === 0) {
            lines.push(prefix);
        }
        return lines;
    }
    /**
     * Preprocess message to handle very long paths and URLs intelligently
     */
    preprocessLongPaths(message) {
        // Split very long file paths at natural breakpoints
        return message.replace(/([\/\\][^\/\\:\s]{30,})/g, (match) => {
            // Break long paths at directory separators
            if (match.length > 60) {
                const parts = match.split(/([\/\\])/);
                let result = '';
                let currentSegment = '';
                for (const part of parts) {
                    if ((currentSegment + part).length > 50 && currentSegment) {
                        result += currentSegment + '\n' + part;
                        currentSegment = '';
                    }
                    else {
                        currentSegment += part;
                    }
                }
                result += currentSegment;
                return result;
            }
            return match;
        });
    }
    /**
     * Strip ANSI color codes to get actual text length
     */
    stripAnsiCodes(text) {
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }
    detectErrorType(message, meta) {
        // Check meta for explicit category first
        if (meta.category) {
            return meta.category;
        }
        // Handle only the MAJOR ones we have smart diagnostics for
        // Enhanced detection for import vs syntax errors
        if (message.includes('Cannot find module')) {
            return this.detectImportVsSyntax(message, meta);
        }
        // Direct syntax error detection
        if (message.includes('SyntaxError') ||
            message.includes('Unexpected token') ||
            message.includes('Unexpected end of input')) {
            return 'syntax';
        }
        // Startup/infrastructure errors
        if (message.includes('EADDRINUSE') ||
            message.includes('CONTRACT') ||
            message.includes('port') ||
            message.includes('startup')) {
            return 'startup';
        }
        // Route registration errors
        if (message.includes('ROUTE') || message.includes('registration')) {
            return 'route';
        }
        // For everything else - just show the raw error with general handling
        return 'general';
    }
    detectImportVsSyntax(message, meta) {
        const modulePath = message.match(/Cannot find module '([^']+)'/)?.[1];
        if (modulePath && meta.feature) {
            // Try to resolve the actual file path
            const basePath = process.cwd();
            const featurePath = join(basePath, 'src', 'features', meta.feature);
            // Build possible file paths
            const possiblePaths = [
                join(featurePath, modulePath + '.ts'),
                join(featurePath, modulePath + '.js'),
                join(featurePath, modulePath, 'index.ts'),
                join(featurePath, modulePath, 'index.js'),
                // Also try relative to the file that's importing
                modulePath + '.ts',
                modulePath + '.js'
            ];
            // Check if any of these files exist
            for (const filePath of possiblePaths) {
                try {
                    if (existsSync(filePath)) {
                        // File exists but import failed - likely syntax error preventing import
                        return 'syntax';
                    }
                }
                catch {
                    // Ignore file system errors, continue checking
                }
            }
        }
        // File doesn't exist - true import error
        return 'import';
    }
    getErrorTitle(errorType) {
        const titles = {
            import: 'IMPORT ERROR',
            syntax: 'SYNTAX ERROR',
            startup: 'STARTUP ERROR',
            contract: 'CONTRACT ERROR',
            route: 'ROUTE ERROR',
            filesystem: 'FILE SYSTEM ERROR',
            general: 'ERROR'
        };
        return titles[errorType] || 'ERROR';
    }
    generateDiagnostics(message, meta, errorType) {
        const diagnostics = [];
        // Only provide smart diagnostics for errors we understand well
        switch (errorType) {
            case 'syntax':
                if (message.includes('Unexpected token')) {
                    const tokenMatch = message.match(/Unexpected token '([^']+)'/);
                    if (tokenMatch) {
                        diagnostics.push({
                            type: 'error',
                            message: `Unexpected token: ${tokenMatch[1]}`,
                        });
                    }
                }
                if (message.includes('Unexpected end of input')) {
                    diagnostics.push({
                        type: 'error',
                        message: 'Missing closing bracket, brace, or parenthesis',
                        fix: 'Check for unclosed {}, [], or () brackets'
                    });
                }
                // Line number extraction
                const lineMatch = message.match(/line (\d+)/i);
                if (lineMatch) {
                    diagnostics.push({
                        type: 'info',
                        message: `Error location: line ${lineMatch[1]}`
                    });
                }
                break;
            case 'import':
                const missingModule = message.match(/Cannot find module '([^']+)'/)?.[1];
                if (missingModule) {
                    diagnostics.push({
                        type: 'error',
                        message: `Missing import: ${missingModule}`,
                    });
                    // Check for common typos
                    if (missingModule.includes('Service') && missingModule.endsWith('Servic')) {
                        diagnostics.push({
                            type: 'warning',
                            message: 'Looks like a typo: missing \'e\' at end?',
                            fix: `Try: ${missingModule}e`
                        });
                    }
                    if (missingModule.includes('/services/')) {
                        diagnostics.push({
                            type: 'info',
                            message: 'Check service file exists and name matches'
                        });
                    }
                }
                break;
            case 'startup':
                if (message.includes('EADDRINUSE')) {
                    diagnostics.push({
                        type: 'error',
                        message: 'Port already in use',
                        fix: 'Change PORT environment variable or stop conflicting process'
                    });
                }
                if (message.includes('CONTRACT')) {
                    diagnostics.push({
                        type: 'error',
                        message: 'Contract validation failed',
                        fix: 'Run: npm run flux:check to see detailed contract issues'
                    });
                }
                break;
            case 'route':
                if (message.includes('export')) {
                    diagnostics.push({
                        type: 'error',
                        message: 'Route file must export a function as default',
                        fix: 'Add: export default router(...)'
                    });
                }
                break;
            case 'general':
                // For general errors, don't add diagnostics - just show the raw error
                // This covers ReferenceError, TypeError, and all other JS errors
                break;
        }
        return diagnostics;
    }
    getFixMessage(errorType, message) {
        // Pattern-based error analysis - extract meaning from the error message itself
        // 1. SYNTAX ERRORS - Parse what's actually expected/unexpected
        const expectedMatch = message.match(/Expected "(.+?)" but found/i);
        if (expectedMatch) {
            return `Add missing "${expectedMatch[1]}"`;
        }
        const unexpectedTokenMatch = message.match(/Unexpected token "(.+?)"/i) || message.match(/Unexpected "(.+?)"/i);
        if (unexpectedTokenMatch) {
            return `Remove or fix unexpected "${unexpectedTokenMatch[1]}"`;
        }
        if (message.match(/Unexpected end of input/i)) {
            return 'Add missing closing bracket, brace, or parenthesis';
        }
        // 2. IMPORT/MODULE ERRORS - Extract the actual module path
        const moduleMatch = message.match(/Cannot find module ['"']([^'"]+)['"']/);
        if (moduleMatch) {
            const modulePath = moduleMatch[1];
            const fileName = modulePath.split('/').pop() || modulePath;
            return `Check if file "${fileName}" exists at path: ${modulePath}`;
        }
        // 3. REFERENCE ERRORS - Extract the undefined variable/function
        const refErrorMatch = message.match(/(\w+) is not defined/);
        if (refErrorMatch) {
            return `Define variable or import "${refErrorMatch[1]}"`;
        }
        // 4. TYPE ERRORS - Extract specific type issues
        const notFunctionMatch = message.match(/(\w+) is not a function/);
        if (notFunctionMatch) {
            return `Check that "${notFunctionMatch[1]}" is actually a function`;
        }
        const cannotReadMatch = message.match(/Cannot read propert(?:y|ies) ['"]?(\w+)['"]? of/);
        if (cannotReadMatch) {
            return `Check object exists before accessing property "${cannotReadMatch[1]}"`;
        }
        const cannotAccessMatch = message.match(/Cannot access ['"]?(\w+)['"]? before initialization/);
        if (cannotAccessMatch) {
            return `Move "${cannotAccessMatch[1]}" declaration before usage`;
        }
        // 5. NETWORK/CONNECTION ERRORS - Extract connection details
        const econnrefusedMatch = message.match(/ECONNREFUSED.*?(\d+)/);
        if (econnrefusedMatch) {
            return `Connection refused on port ${econnrefusedMatch[1]} - check if service is running`;
        }
        if (message.match(/EADDRINUSE.*?(\d+)/)) {
            const portMatch = message.match(/(\d+)/);
            return portMatch ? `Port ${portMatch[1]} already in use - choose different port` : 'Port already in use';
        }
        // 6. FILE SYSTEM ERRORS - Extract file/directory info
        const enoentMatch = message.match(/ENOENT.*?['"]([^'"]+)['"]/) || message.match(/no such file or directory.*?['"]([^'"]+)['"]/);
        if (enoentMatch) {
            return `File not found: ${enoentMatch[1]}`;
        }
        const eaccesMatch = message.match(/EACCES.*?['"]([^'"]+)['"]/) || message.match(/permission denied.*?['"]([^'"]+)['"]/);
        if (eaccesMatch) {
            return `Permission denied accessing: ${eaccesMatch[1]}`;
        }
        // 7. COMPILATION/TRANSFORM ERRORS - Extract compilation context
        if (message.match(/Transform failed|compilation failed/i)) {
            const lineMatch = message.match(/line (\d+)/i) || message.match(/:(\d+):/);
            return lineMatch ? `Fix compilation error at line ${lineMatch[1]}` : 'Fix compilation/syntax errors';
        }
        // 8. PROMISE/ASYNC ERRORS
        if (message.match(/UnhandledPromiseRejection/i)) {
            return 'Add .catch() handler or try/catch block for async operation';
        }
        // 9. EXPORT/IMPORT ERRORS - Extract export context
        if (message.match(/default.*?export/i) || message.match(/export.*?default/i)) {
            return 'Fix export default statement syntax';
        }
        // 10. LINE-SPECIFIC ERRORS - Extract line numbers when available
        const lineNumberMatch = message.match(/(?:line |:)(\d+)(?::(\d+))?/i);
        if (lineNumberMatch) {
            const line = lineNumberMatch[1];
            const column = lineNumberMatch[2];
            const location = column ? `line ${line}, column ${column}` : `line ${line}`;
            if (message.match(/syntax|unexpected|expected/i)) {
                return `Fix syntax error at ${location}`;
            }
            return `Check code at ${location}`;
        }
        // 11. GENERIC PATTERNS - Fallback pattern matching
        if (message.match(/not found|missing/i)) {
            return 'Check that required files/resources exist';
        }
        if (message.match(/timeout|timed out/i)) {
            return 'Increase timeout or check network connectivity';
        }
        if (message.match(/invalid|malformed/i)) {
            return 'Check data format and syntax';
        }
        if (message.match(/denied|forbidden/i)) {
            return 'Check permissions and access rights';
        }
        // 12. FRAMEWORK-AGNOSTIC FALLBACKS by error type
        switch (errorType) {
            case 'import':
                return 'Verify import paths and file existence';
            case 'syntax':
                return 'Fix JavaScript/TypeScript syntax errors';
            case 'startup':
                return 'Fix configuration or dependency issues';
            case 'route':
                return 'Check export statements and file structure';
            case 'general':
                return 'Review error details above';
            default:
                return 'Fix the error described above';
        }
    }
    /**
     * Get contextual solutions based on error message patterns
     */
    getSolutions(errorType, message) {
        const solutions = [];
        // Extract solutions based on actual error content
        if (message.match(/Expected "(.+?)" but found/)) {
            solutions.push('Check for missing brackets, parentheses, or braces');
            solutions.push('Verify function call syntax');
        }
        if (message.match(/Cannot find module/)) {
            solutions.push('Check if file exists at the specified path');
            solutions.push('Verify import path spelling');
            solutions.push('Check file extensions (.js, .ts)');
        }
        if (message.match(/is not defined/)) {
            solutions.push('Import the required module or variable');
            solutions.push('Check variable name spelling');
            solutions.push('Verify variable is declared before use');
        }
        if (message.match(/is not a function/)) {
            solutions.push('Check that imported item is actually a function');
            solutions.push('Verify function is exported correctly');
        }
        if (message.match(/EADDRINUSE/)) {
            solutions.push('Change to a different port number');
            solutions.push('Stop the process using this port');
            solutions.push('Check for other running servers');
        }
        if (message.match(/line \d+/i)) {
            const lineMatch = message.match(/line (\d+)/i);
            if (lineMatch) {
                solutions.push(`Check syntax around line ${lineMatch[1]}`);
                solutions.push('Look for missing commas or semicolons');
            }
        }
        // Add generic solutions if none were found
        if (solutions.length === 0) {
            const defaultSolutions = {
                import: ['Verify file paths and existence', 'Check import syntax'],
                syntax: ['Fix JavaScript/TypeScript syntax', 'Check for missing punctuation'],
                startup: ['Review configuration files', 'Check dependencies'],
                route: ['Verify export statements', 'Check file structure'],
                general: ['Review error message details', 'Check recent code changes']
            };
            solutions.push(...(defaultSolutions[errorType] || defaultSolutions.general));
        }
        return solutions;
    }
    // ============================================================================
    // EXISTING HELPER METHODS
    // ============================================================================
    getCaller() {
        const stack = new Error().stack;
        if (!stack)
            return 'unknown';
        const lines = stack.split('\n');
        const callerLine = lines[4] || '';
        const match = callerLine.match(/\((.+):(\d+):(\d+)\)/) ||
            callerLine.match(/at\s+(.+):(\d+):(\d+)/);
        if (match) {
            const [, filePath, lineNumber] = match;
            const cleanPath = filePath.replace(process.cwd() + '/', '');
            return `${cleanPath}:${lineNumber}`;
        }
        return 'unknown';
    }
    log(level, message, meta) {
        if (LOG_LEVELS[level] > this.levelValue) {
            return;
        }
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message: message || '',
            ...this.defaultMeta,
            ...meta,
        };
        this.writeToTransports(entry);
    }
    writeToTransports(entry) {
        const writePromises = [];
        for (const [name, transport] of this.transports) {
            try {
                if (transport.shouldLog && !transport.shouldLog(entry.level, this.level)) {
                    continue;
                }
                const result = transport.write(entry);
                if (result && typeof result.then === 'function') {
                    writePromises.push(result.catch((error) => {
                        console.error(`Transport ${name} write failed:`, error.message);
                    }));
                }
            }
            catch (error) {
                console.error(`Transport ${name} write error:`, error.message);
            }
        }
        this.pendingWrites = writePromises;
    }
    // ============================================================================
    // PUBLIC UTILITY METHODS
    // ============================================================================
    /**
     * Flush pending logs to all transports
     * @llm-rule WHEN: App shutdown or ensuring logs are persisted before critical operations
     * @llm-rule AVOID: Frequent flushing during normal operations - impacts performance
     */
    async flush() {
        if (this.pendingWrites.length > 0) {
            try {
                await Promise.all(this.pendingWrites);
            }
            catch {
                // Errors already handled in writeToTransports
            }
            this.pendingWrites = [];
        }
        const flushPromises = [];
        for (const [name, transport] of this.transports) {
            if (transport.flush) {
                try {
                    const result = transport.flush();
                    if (result) {
                        flushPromises.push(result.catch((error) => {
                            console.error(`Transport ${name} flush failed:`, error.message);
                        }));
                    }
                }
                catch (error) {
                    console.error(`Transport ${name} flush error:`, error.message);
                }
            }
        }
        if (flushPromises.length > 0) {
            await Promise.all(flushPromises);
        }
    }
    /**
     * Close logger and cleanup all transports
     * @llm-rule WHEN: App shutdown or logger cleanup - ensures graceful resource cleanup
     * @llm-rule AVOID: Calling during normal operations - this permanently closes the logger
     */
    async close() {
        await this.flush();
        const closePromises = [];
        for (const [name, transport] of this.transports) {
            if (transport.close) {
                try {
                    const result = transport.close();
                    if (result) {
                        closePromises.push(result.catch((error) => {
                            console.error(`Transport ${name} close failed:`, error.message);
                        }));
                    }
                }
                catch (error) {
                    console.error(`Transport ${name} close error:`, error.message);
                }
            }
        }
        if (closePromises.length > 0) {
            await Promise.all(closePromises);
        }
        this.transports.clear();
    }
    /**
     * Get list of active transport names
     * @llm-rule WHEN: Debugging logger setup or checking which transports are running
     * @llm-rule AVOID: Using for business logic - this is for debugging and monitoring only
     */
    getActiveTransports() {
        return Array.from(this.transports.keys());
    }
    /**
     * Check if specific transport is active
     * @llm-rule WHEN: Conditionally logging based on transport availability
     * @llm-rule AVOID: Complex transport detection - just log normally, transports auto-enable
     */
    hasTransport(name) {
        return this.transports.has(name);
    }
    /**
     * Set minimum log level dynamically
     * @llm-rule WHEN: Runtime log level changes, debugging, or feature flags
     * @llm-rule AVOID: Frequent level changes - impacts performance
     */
    setLevel(level) {
        this.level = level;
        this.levelValue = LOG_LEVELS[level];
    }
    /**
     * Get current minimum log level
     * @llm-rule WHEN: Debugging configuration or checking level settings
     * @llm-rule AVOID: Using for filtering logic - logger handles level filtering automatically
     */
    getLevel() {
        return this.level;
    }
    /**
     * Check if specific log level would be written
     * @llm-rule WHEN: Expensive log message preparation - check before building complex meta
     * @llm-rule AVOID: Normal logging - level filtering is automatic and fast
     */
    isLevelEnabled(level) {
        return LOG_LEVELS[level] <= this.levelValue;
    }
    /**
     * Get current logger configuration for debugging
     * @llm-rule WHEN: Debugging logger setup, checking environment detection, or monitoring
     * @llm-rule AVOID: Using for runtime business logic - configuration is set at startup
     */
    getConfig() {
        return {
            level: this.level,
            scope: this.config.scope,
            minimal: this.config.minimal,
            transports: this.getActiveTransports(),
            service: this.config.service,
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                hasDbUrl: !!process.env.DATABASE_URL,
                hasHttpUrl: !!process.env.BLOOM_LOGGER_HTTP_URL,
                hasWebhookUrl: !!process.env.BLOOM_LOGGER_WEBHOOK_URL,
            },
        };
    }
}
//# sourceMappingURL=logger.js.map