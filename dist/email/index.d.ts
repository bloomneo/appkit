/**
 * Ultra-simple email sending that just works with automatic provider detection
 * @module @bloomneo/appkit/email
 * @file src/email/index.ts
 *
 * @llm-rule WHEN: Building apps that need email sending with zero configuration
 * @llm-rule AVOID: Complex email setups - this auto-detects Resend/SMTP/Console from environment
 * @llm-rule NOTE: Uses emailClass.get() pattern like auth - get() → email.send() → done
 * @llm-rule NOTE: Common pattern - emailClass.get() → email.send({ to, subject, text }) → sent
 */
import { AppKitError } from '../util/errors.js';
import { type EmailConfig } from './defaults.js';
/**
 * Thrown by email validation/send paths. `send()` itself returns an
 * EmailResult with `{success,error}` rather than throwing — EmailError fires
 * for config/bootstrap failures that the consumer needs to see at startup.
 * `instanceof AppKitError` also true.
 */
export declare class EmailError extends AppKitError {
    readonly code: string;
    constructor(message: string, options?: {
        code?: string;
        cause?: unknown;
    });
}
export interface Email {
    send(data: EmailData): Promise<EmailResult>;
    sendBatch(emails: EmailData[], batchSize?: number): Promise<EmailResult[]>;
    sendText(to: string, subject: string, text: string): Promise<EmailResult>;
    sendHtml(to: string, subject: string, html: string, text?: string): Promise<EmailResult>;
    sendTemplate(templateName: string, data: any): Promise<EmailResult>;
    disconnect(): Promise<void>;
    getStrategy(): string;
    getConfig(): any;
}
export interface EmailData {
    to: string | EmailAddress | (string | EmailAddress)[];
    from?: string | EmailAddress;
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    replyTo?: string | EmailAddress;
    cc?: string | EmailAddress | (string | EmailAddress)[];
    bcc?: string | EmailAddress | (string | EmailAddress)[];
}
export interface EmailAddress {
    name?: string;
    email: string;
}
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}
export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
/**
 * Get email instance - the only function you need to learn
 * Strategy auto-detected from environment (RESEND_API_KEY → Resend, SMTP_HOST → SMTP, default → Console)
 * @llm-rule WHEN: Need email sending in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating EmailClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → email.send() → email delivered/logged
 */
declare function get(): Email;
/**
 * Reset email configuration (useful for testing)
 * @llm-rule WHEN: Testing email logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
declare function reset(newConfig?: Partial<EmailConfig>): Promise<void>;
/**
 * Get active email strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Resend/SMTP/Console)
 * @llm-rule AVOID: Using for application logic - email should be transparent
 */
declare function getStrategy(): string;
/**
 * Get email configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging email configuration
 * @llm-rule AVOID: Exposing sensitive API keys or passwords - this only shows safe info
 */
declare function getConfig(): {
    strategy: string;
    fromName: string;
    fromEmail: string;
    connected: boolean;
};
/**
 * Check if Resend is available and configured
 * @llm-rule WHEN: Conditional logic based on email capabilities
 * @llm-rule AVOID: Complex email detection - just use email normally, it handles strategy
 */
declare function hasResend(): boolean;
/**
 * Check if SMTP is available and configured
 * @llm-rule WHEN: Conditional logic based on email capabilities
 * @llm-rule AVOID: Complex email detection - just use email normally, it handles strategy
 */
declare function hasSmtp(): boolean;
/**
 * Check if any email provider is configured (not just console)
 * @llm-rule WHEN: Determining if real emails can be sent
 * @llm-rule AVOID: Using for validation - email.send() will return success/error appropriately
 */
declare function hasProvider(): boolean;
/**
 * Send simple email (convenience function)
 * @llm-rule WHEN: Quick email sending without getting instance first
 * @llm-rule AVOID: For complex emails - use get() and full EmailData object instead
 */
declare function send(data: EmailData): Promise<EmailResult>;
/**
 * Send simple text email (ultra-convenience function)
 * @llm-rule WHEN: Sending basic notifications or alerts quickly
 * @llm-rule AVOID: For formatted emails - use send() with HTML content instead
 */
declare function sendText(to: string, subject: string, text: string): Promise<EmailResult>;
/**
 * Validate email configuration at startup with detailed feedback
 * @llm-rule WHEN: App startup to ensure email is properly configured
 * @llm-rule AVOID: Skipping validation - missing email config causes runtime issues
 * @llm-rule NOTE: Returns validation results instead of throwing - allows graceful handling
 */
declare function validateConfig(): {
    valid: boolean;
    strategy: string;
    warnings: string[];
    errors: string[];
    ready: boolean;
};
/**
 * Validate production requirements and throw if critical issues found
 * @llm-rule WHEN: Production deployment validation - ensures email works in production
 * @llm-rule AVOID: Skipping in production - email failures are often silent
 * @llm-rule NOTE: Throws on critical issues, warns on non-critical ones
 */
declare function validateProduction(): void;
/**
 * Get comprehensive health check status for monitoring
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Using in critical application path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed status without exposing sensitive configuration
 */
declare function getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error';
    strategy: string;
    configured: boolean;
    issues: string[];
    ready: boolean;
    timestamp: string;
};
/**
 * Close email provider connections and reset internal state — the canonical
 * teardown call. Named to match cache/queue per NAMING.md §Bulk-and-Lifecycle-Ops
 * so agents see one teardown verb across every appkit module.
 *
 * @llm-rule WHEN: App shutdown, SIGTERM handler, end-of-test-suite teardown
 * @llm-rule AVOID: Abrupt process exit — graceful drain prevents partial sends
 */
declare function disconnectAll(): Promise<void>;
/**
 * Single email export with minimal API (like auth module)
 */
export declare const emailClass: {
    readonly get: typeof get;
    readonly reset: typeof reset;
    readonly getStrategy: typeof getStrategy;
    readonly getConfig: typeof getConfig;
    readonly hasResend: typeof hasResend;
    readonly hasSmtp: typeof hasSmtp;
    readonly hasProvider: typeof hasProvider;
    readonly send: typeof send;
    readonly sendText: typeof sendText;
    readonly validateConfig: typeof validateConfig;
    readonly validateProduction: typeof validateProduction;
    readonly getHealthStatus: typeof getHealthStatus;
    readonly disconnectAll: typeof disconnectAll;
};
export type { EmailConfig } from './defaults.js';
export { EmailClass } from './email.js';
export default emailClass;
//# sourceMappingURL=index.d.ts.map