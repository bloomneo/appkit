/**
 * Ultra-simple logging that just works with enterprise features and enhanced error display
 * @module @bloomneo/appkit/logger
 * @file src/logger/index.ts
 *
 * @llm-rule WHEN: Need logging in any app - console, files, database, external services
 * @llm-rule AVOID: Using console.log directly - this provides structured logging with levels
 * @llm-rule NOTE: Uses loggerClass.get() pattern like auth - get() → log.info() → done
 * @llm-rule NOTE: Enhanced error() method now provides automatic visual formatting in development
 */
import { AppKitError } from '../util/errors.js';
/**
 * Thrown by logger bootstrap / transport setup. Regular log emit paths do NOT
 * throw (a failed transport is swallowed and reported on console) so consumers
 * don't lose app flow over log-delivery problems. `instanceof AppKitError`
 * also true.
 */
export declare class LoggerError extends AppKitError {
    readonly code: string;
    constructor(message: string, options?: {
        code?: string;
        cause?: unknown;
    });
}
export interface LogMeta {
    [key: string]: any;
}
export interface Logger {
    info(message: string, meta?: LogMeta): void;
    error(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    debug(message: string, meta?: LogMeta): void;
    fatal(message: string, meta?: LogMeta): void;
    child(bindings: LogMeta): Logger;
    flush(): Promise<void>;
    close(): Promise<void>;
}
/**
 * Get logger instance - the only function you need to learn
 * @llm-rule WHEN: Starting any logging operation - this is your main entry point
 * @llm-rule AVOID: Creating LoggerClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → info/error/warn/debug() → automatic transport
 * @llm-rule NOTE: error() method now automatically provides visual formatting when appropriate
 */
declare function get(component?: string): Logger;
/**
 * Close every logger + transport and reset internal state — the canonical
 * teardown call. Named to match cache/queue/email/event/storage/database per
 * NAMING.md §Bulk-and-Lifecycle-Ops so agents see one teardown verb across
 * every appkit module.
 *
 * @llm-rule WHEN: App shutdown, SIGTERM handler, end-of-test-suite teardown
 * @llm-rule AVOID: Abrupt process exit — graceful drain prevents log loss
 *   for batched transports (HTTP, webhook, database)
 */
declare function disconnectAll(): Promise<void>;
/**
 * Get active transport names for debugging
 * @llm-rule WHEN: Need to see which transports are running (console, file, database, etc)
 * @llm-rule AVOID: Using for business logic - this is for debugging only
 */
declare function getActiveTransports(): string[];
/**
 * Check if specific transport is active
 * @llm-rule WHEN: Conditionally logging based on transport availability
 * @llm-rule AVOID: Complex transport detection - just log normally, transports auto-enable
 */
declare function hasTransport(name: string): boolean;
/**
 * Get current configuration for debugging
 * @llm-rule WHEN: Debugging logging setup or checking environment detection
 * @llm-rule AVOID: Using for runtime decisions - configuration is set at startup
 */
declare function getConfig(): {
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
} | null;
/**
 * Single logger export with minimal API (like auth module)
 */
export declare const loggerClass: {
    readonly get: typeof get;
    readonly disconnectAll: typeof disconnectAll;
    readonly getActiveTransports: typeof getActiveTransports;
    readonly hasTransport: typeof hasTransport;
    readonly getConfig: typeof getConfig;
};
export type { LoggingConfig } from './defaults.js';
export { LoggerClass } from './logger.js';
export default loggerClass;
//# sourceMappingURL=index.d.ts.map