/**
 * Console email strategy for development with beautiful formatting and email preview
 * @module @bloomneo/appkit/email
 * @file src/email/strategies/console.ts
 * 
 * @llm-rule WHEN: No email provider configured - perfect for development and testing
 * @llm-rule AVOID: Using in production - emails are only logged, not sent
 * @llm-rule NOTE: Beautiful console output with colors, formatting, and email preview for development
 */

import type { EmailStrategy, EmailData, EmailResult, EmailAddress } from '../email.js';
import type { EmailConfig } from '../defaults.js';

/**
 * Console email strategy with beautiful development output
 */
export class ConsoleStrategy implements EmailStrategy {
  private config: EmailConfig;
  private colorize: boolean;
  private showPreview: boolean;
  private format: 'simple' | 'detailed';

  /**
   * Creates console strategy with direct environment access (like auth pattern)
   * @llm-rule WHEN: No email provider configured - automatic fallback for development
   * @llm-rule AVOID: Manual console configuration - environment detection handles this
   */
  constructor(config: EmailConfig) {
    this.config = config;
    this.colorize = config.console!.colorize;
    this.showPreview = config.console!.showPreview;
    this.format = config.console!.format;
  }

  /**
   * Logs email to console with beautiful formatting
   * @llm-rule WHEN: Development email sending - provides visual feedback without actual sending
   * @llm-rule AVOID: Using for production - emails are only displayed, not delivered
   * @llm-rule NOTE: Shows email content, recipients, and preview for development workflow
   */
  async send(data: EmailData): Promise<EmailResult> {
    try {
      // Generate unique message ID for tracking
      const messageId = this.generateMessageId();

      // Log email based on format preference
      if (this.format === 'detailed') {
        this.logDetailedEmail(data, messageId);
      } else {
        this.logSimpleEmail(data, messageId);
      }

      // Show email preview if enabled
      if (this.showPreview && (data.html || data.text)) {
        this.showEmailPreview(data);
      }

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error(`❌ [AppKit] Console email error:`, (error as Error).message);
      
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Disconnects console strategy (no-op)
   * @llm-rule WHEN: App shutdown - console has no resources to cleanup
   * @llm-rule AVOID: Expecting cleanup behavior - console strategy is stateless
   */
  async disconnect(): Promise<void> {
    // Console strategy has no resources to clean up
    return Promise.resolve();
  }

  // Private helper methods

  /**
   * Logs email in simple format
   */
  private logSimpleEmail(data: EmailData, messageId: string): void {
    const colors = this.getColors();
    
    console.log();
    console.log(`${colors.cyan}📧 EMAIL SENT${colors.reset} ${colors.gray}(console)${colors.reset}`);
    console.log(`${colors.gray}Message ID: ${messageId}${colors.reset}`);
    console.log(`${colors.bold}To:${colors.reset} ${this.formatRecipients(data.to)}`);
    console.log(`${colors.bold}Subject:${colors.reset} ${data.subject}`);
    
    if (data.from) {
      console.log(`${colors.bold}From:${colors.reset} ${this.formatEmailAddress(data.from)}`);
    }
    
    if (data.attachments && data.attachments.length > 0) {
      console.log(`${colors.bold}Attachments:${colors.reset} ${data.attachments.length} file(s)`);
    }
    
    console.log();
  }

  /**
   * Logs email in detailed format
   */
  private logDetailedEmail(data: EmailData, messageId: string): void {
    const colors = this.getColors();
    
    console.log();
    console.log(`${colors.cyan}╭─ 📧 EMAIL SENT ${colors.gray}(console)${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} ${colors.bold}Message ID:${colors.reset} ${messageId}`);
    console.log(`${colors.cyan}│${colors.reset}`);
    
    // Headers
    console.log(`${colors.cyan}│${colors.reset} ${colors.bold}To:${colors.reset} ${this.formatRecipients(data.to)}`);
    
    if (data.from) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.bold}From:${colors.reset} ${this.formatEmailAddress(data.from)}`);
    }
    
    if (data.cc) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.bold}CC:${colors.reset} ${this.formatRecipients(data.cc)}`);
    }
    
    if (data.bcc) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.bold}BCC:${colors.reset} ${this.formatRecipients(data.bcc)}`);
    }
    
    if (data.replyTo) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.bold}Reply-To:${colors.reset} ${this.formatEmailAddress(data.replyTo)}`);
    }
    
    console.log(`${colors.cyan}│${colors.reset} ${colors.bold}Subject:${colors.reset} ${data.subject}`);
    
    // Content info
    const contentTypes = [];
    if (data.text) contentTypes.push('text');
    if (data.html) contentTypes.push('html');
    console.log(`${colors.cyan}│${colors.reset} ${colors.bold}Content:${colors.reset} ${contentTypes.join(', ')}`);
    
    // Attachments
    if (data.attachments && data.attachments.length > 0) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.bold}Attachments:${colors.reset}`);
      data.attachments.forEach((attachment, index) => {
        const size = this.getAttachmentSize(attachment.content);
        console.log(`${colors.cyan}│${colors.reset}   ${index + 1}. ${attachment.filename} (${size})`);
      });
    }
    
    console.log(`${colors.cyan}╰─ ${colors.green}✅ Logged successfully${colors.reset}`);
    console.log();
  }

  /**
   * Shows email content preview
   */
  private showEmailPreview(data: EmailData): void {
    const colors = this.getColors();
    
    console.log(`${colors.yellow}📋 EMAIL PREVIEW${colors.reset}`);
    console.log(`${colors.gray}─────────────────${colors.reset}`);
    
    // Show text content
    if (data.text) {
      console.log(`${colors.bold}TEXT VERSION:${colors.reset}`);
      const previewText = this.truncateText(data.text, 300);
      console.log(previewText);
      
      if (data.html) {
        console.log();
      }
    }
    
    // Show HTML content (converted to text)
    if (data.html) {
      console.log(`${colors.bold}HTML VERSION:${colors.reset}`);
      const htmlAsText = this.htmlToText(data.html);
      const previewHtml = this.truncateText(htmlAsText, 300);
      console.log(previewHtml);
    }
    
    console.log(`${colors.gray}─────────────────${colors.reset}`);
    console.log();
  }

  /**
   * Formats email recipients for display
   */
  private formatRecipients(recipients: string | EmailAddress | (string | EmailAddress)[]): string {
    const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
    return recipientArray.map(recipient => this.formatEmailAddress(recipient)).join(', ');
  }

  /**
   * Formats single email address for display
   */
  private formatEmailAddress(address: string | EmailAddress): string {
    if (typeof address === 'string') {
      return address;
    }

    if (address.name) {
      return `${address.name} <${address.email}>`;
    }

    return address.email;
  }

  /**
   * Gets attachment size for display
   */
  private getAttachmentSize(content: Buffer | string): string {
    const bytes = Buffer.isBuffer(content) ? content.length : Buffer.from(content).length;
    
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Converts HTML to plain text for preview
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Truncates text for preview
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Generates unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `console-${timestamp}-${random}`;
  }

  /**
   * Gets color codes for console output
   */
  private getColors(): Record<string, string> {
    if (!this.colorize) {
      return {
        reset: '',
        bold: '',
        cyan: '',
        green: '',
        yellow: '',
        gray: '',
        red: '',
      };
    }

    return {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      gray: '\x1b[90m',
      red: '\x1b[31m',
    };
  }

  /**
   * Gets console strategy statistics
   */
  getStats(): {
    emailsLogged: number;
    strategy: string;
    colorEnabled: boolean;
    previewEnabled: boolean;
    format: string;
  } {
    // Simple stats - could be enhanced with actual tracking
    return {
      emailsLogged: 0, // Could track this if needed
      strategy: 'console',
      colorEnabled: this.colorize,
      previewEnabled: this.showPreview,
      format: this.format,
    };
  }
}