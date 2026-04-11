/**
 * Core email class with automatic strategy selection and ultra-simple API
 * @module @bloomneo/appkit/email
 * @file src/email/email.ts
 *
 * @llm-rule WHEN: Building apps that need email sending with automatic provider selection
 * @llm-rule AVOID: Using directly - always get instance via emailClass.get()
 * @llm-rule NOTE: Auto-detects Resend → SMTP → Console based on environment variables
 */
import type { EmailConfig } from './defaults.js';
export interface EmailAddress {
    name?: string;
    email: string;
}
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
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
export interface EmailStrategy {
    send(data: EmailData): Promise<EmailResult>;
    disconnect(): Promise<void>;
}
export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
/**
 * Email class with automatic strategy selection and ultra-simple API
 */
export declare class EmailClass {
    config: EmailConfig;
    private strategy;
    private connected;
    constructor(config: EmailConfig);
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Email initialization - selects Resend, SMTP, or Console based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    private createStrategy;
    /**
     * Sends email with automatic strategy handling
     * @llm-rule WHEN: Sending any email - this is the main email sending method
     * @llm-rule AVOID: Manual strategy calls - this handles all email complexity
     * @llm-rule NOTE: Auto-fills FROM address from config if not provided
     */
    send(data: EmailData): Promise<EmailResult>;
    /**
     * Sends multiple emails efficiently (batch operation)
     * @llm-rule WHEN: Sending multiple emails like newsletters or notifications
     * @llm-rule AVOID: Multiple individual send() calls - this handles batching efficiently
     * @llm-rule NOTE: Processes in batches to avoid overwhelming email providers
     */
    sendBatch(emails: EmailData[], batchSize?: number): Promise<EmailResult[]>;
    /**
     * Sends simple text email (convenience method)
     * @llm-rule WHEN: Sending simple text-only emails quickly
     * @llm-rule AVOID: Complex EmailData object for simple emails - this is more convenient
     */
    sendText(to: string, subject: string, text: string): Promise<EmailResult>;
    /**
     * Sends HTML email (convenience method)
     * @llm-rule WHEN: Sending HTML emails with formatting
     * @llm-rule AVOID: Manual HTML/text preparation - this handles both formats
     */
    sendHtml(to: string, subject: string, html: string, text?: string): Promise<EmailResult>;
    /**
     * Sends email with template (future extension point)
     * @llm-rule WHEN: Sending templated emails with data substitution
     * @llm-rule AVOID: Manual template processing - this will handle template rendering
     * @llm-rule NOTE: Basic implementation - can be extended with template engines
     */
    sendTemplate(templateName: string, data: any): Promise<EmailResult>;
    /**
     * Disconnects email strategy gracefully
     * @llm-rule WHEN: App shutdown or email cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    disconnect(): Promise<void>;
    /**
     * Gets current email strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - email should be transparent
     */
    getStrategy(): string;
    /**
     * Gets email configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging email configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig(): {
        strategy: string;
        fromName: string;
        fromEmail: string;
        connected: boolean;
    };
    /**
     * Validates email data before sending
     */
    private validateEmailData;
    /**
     * Prepares email data with defaults
     */
    private prepareEmailData;
    /**
     * Validates email address format
     */
    private isValidEmail;
    /**
     * Converts HTML to plain text (basic implementation)
     */
    private htmlToText;
    /**
     * Loads email template (basic implementation)
     */
    private loadTemplate;
    /**
     * Processes template with data substitution
     */
    private processTemplate;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
}
//# sourceMappingURL=email.d.ts.map