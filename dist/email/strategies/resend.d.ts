/**
 * Resend email strategy with modern API and automatic retry logic
 * @module @bloomneo/appkit/email
 * @file src/email/strategies/resend.ts
 *
 * @llm-rule WHEN: App has RESEND_API_KEY environment variable for modern email sending
 * @llm-rule AVOID: Manual Resend setup - this handles API calls, retry logic, and error handling
 * @llm-rule NOTE: Modern email provider with excellent deliverability and developer experience
 */
import type { EmailStrategy, EmailData, EmailResult } from '../email.js';
import type { EmailConfig } from '../defaults.js';
/**
 * Resend email strategy with modern API and reliability features
 */
export declare class ResendStrategy implements EmailStrategy {
    private config;
    private apiKey;
    private baseURL;
    private timeout;
    /**
     * Creates Resend strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Email initialization with RESEND_API_KEY detected
     * @llm-rule AVOID: Manual Resend configuration - environment detection handles this
     */
    constructor(config: EmailConfig);
    /**
     * Sends email via Resend API with automatic retry and error handling
     * @llm-rule WHEN: Sending emails through Resend service
     * @llm-rule AVOID: Manual API calls - this handles all Resend complexity
     * @llm-rule NOTE: Includes retry logic, proper error handling, and response parsing
     */
    send(data: EmailData): Promise<EmailResult>;
    /**
     * Disconnects Resend strategy (no-op for HTTP API)
     * @llm-rule WHEN: App shutdown or email cleanup
     * @llm-rule AVOID: Expecting cleanup behavior - Resend is stateless HTTP API
     */
    disconnect(): Promise<void>;
    /**
     * Converts EmailData to Resend API format
     */
    private convertToResendFormat;
    /**
     * Formats single email address for Resend API
     */
    private formatEmailAddress;
    /**
     * Formats multiple email addresses for Resend API
     */
    private formatEmailAddresses;
    /**
     * Formats attachments for Resend API
     */
    private formatAttachments;
    /**
     * Encodes attachment content for Resend API
     */
    private encodeAttachmentContent;
    /**
     * Guesses content type from filename
     */
    private guessContentType;
    /**
     * Sends email with retry logic and exponential backoff
     */
    private sendWithRetry;
    /**
     * Makes HTTP request to Resend API
     */
    private makeResendRequest;
    /**
     * Fetch with timeout support
     */
    private fetchWithTimeout;
    /**
     * Parses Resend API errors into user-friendly messages
     */
    private parseResendError;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
}
//# sourceMappingURL=resend.d.ts.map