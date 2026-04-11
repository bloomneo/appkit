/**
 * Console email strategy for development with beautiful formatting and email preview
 * @module @bloomneo/appkit/email
 * @file src/email/strategies/console.ts
 *
 * @llm-rule WHEN: No email provider configured - perfect for development and testing
 * @llm-rule AVOID: Using in production - emails are only logged, not sent
 * @llm-rule NOTE: Beautiful console output with colors, formatting, and email preview for development
 */
import type { EmailStrategy, EmailData, EmailResult } from '../email.js';
import type { EmailConfig } from '../defaults.js';
/**
 * Console email strategy with beautiful development output
 */
export declare class ConsoleStrategy implements EmailStrategy {
    private config;
    private colorize;
    private showPreview;
    private format;
    /**
     * Creates console strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: No email provider configured - automatic fallback for development
     * @llm-rule AVOID: Manual console configuration - environment detection handles this
     */
    constructor(config: EmailConfig);
    /**
     * Logs email to console with beautiful formatting
     * @llm-rule WHEN: Development email sending - provides visual feedback without actual sending
     * @llm-rule AVOID: Using for production - emails are only displayed, not delivered
     * @llm-rule NOTE: Shows email content, recipients, and preview for development workflow
     */
    send(data: EmailData): Promise<EmailResult>;
    /**
     * Disconnects console strategy (no-op)
     * @llm-rule WHEN: App shutdown - console has no resources to cleanup
     * @llm-rule AVOID: Expecting cleanup behavior - console strategy is stateless
     */
    disconnect(): Promise<void>;
    /**
     * Logs email in simple format
     */
    private logSimpleEmail;
    /**
     * Logs email in detailed format
     */
    private logDetailedEmail;
    /**
     * Shows email content preview
     */
    private showEmailPreview;
    /**
     * Formats email recipients for display
     */
    private formatRecipients;
    /**
     * Formats single email address for display
     */
    private formatEmailAddress;
    /**
     * Gets attachment size for display
     */
    private getAttachmentSize;
    /**
     * Converts HTML to plain text for preview
     */
    private htmlToText;
    /**
     * Truncates text for preview
     */
    private truncateText;
    /**
     * Generates unique message ID
     */
    private generateMessageId;
    /**
     * Gets color codes for console output
     */
    private getColors;
    /**
     * Gets console strategy statistics
     */
    getStats(): {
        emailsLogged: number;
        strategy: string;
        colorEnabled: boolean;
        previewEnabled: boolean;
        format: string;
    };
}
//# sourceMappingURL=console.d.ts.map