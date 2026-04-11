/**
 * SMTP email strategy with nodemailer and connection pooling
 * @module @bloomneo/appkit/email
 * @file src/email/strategies/smtp.ts
 *
 * @llm-rule WHEN: App has SMTP_HOST environment variable for universal email sending
 * @llm-rule AVOID: Manual SMTP setup - this handles connection pooling, authentication, and reliability
 * @llm-rule NOTE: Universal email strategy that works with any SMTP server (Gmail, Outlook, etc.)
 */
import type { EmailStrategy, EmailData, EmailResult } from '../email.js';
import type { EmailConfig } from '../defaults.js';
/**
 * SMTP email strategy with connection pooling and reliability features
 */
export declare class SmtpStrategy implements EmailStrategy {
    private config;
    private transporter;
    private connected;
    /**
     * Creates SMTP strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Email initialization with SMTP_HOST detected
     * @llm-rule AVOID: Manual SMTP configuration - environment detection handles this
     */
    constructor(config: EmailConfig);
    /**
     * Sends email via SMTP with automatic connection management
     * @llm-rule WHEN: Sending emails through SMTP servers
     * @llm-rule AVOID: Manual SMTP calls - this handles all connection complexity
     * @llm-rule NOTE: Includes connection pooling, authentication, and error handling
     */
    send(data: EmailData): Promise<EmailResult>;
    /**
     * Disconnects SMTP strategy gracefully
     * @llm-rule WHEN: App shutdown or email cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    disconnect(): Promise<void>;
    /**
     * Ensures SMTP transporter is connected
     */
    private ensureConnected;
    /**
     * Converts EmailData to nodemailer format
     */
    private convertToSmtpFormat;
    /**
     * Formats single email address for nodemailer
     */
    private formatEmailAddress;
    /**
     * Formats multiple email addresses for nodemailer
     */
    private formatEmailAddresses;
    /**
     * Formats attachments for nodemailer
     */
    private formatAttachments;
    /**
     * Guesses content type from filename
     */
    private guessContentType;
    /**
     * Parses SMTP errors into user-friendly messages
     */
    private parseSmtpError;
    /**
     * Gets SMTP connection info for debugging
     */
    getConnectionInfo(): {
        host: string;
        port: number;
        secure: boolean;
        authenticated: boolean;
        connected: boolean;
    };
}
//# sourceMappingURL=smtp.d.ts.map