/**
 * Core email class with automatic strategy selection and ultra-simple API
 * @module @bloomneo/appkit/email
 * @file src/email/email.ts
 * 
 * @llm-rule WHEN: Building apps that need email sending with automatic provider selection
 * @llm-rule AVOID: Using directly - always get instance via emailClass.get()
 * @llm-rule NOTE: Auto-detects Resend → SMTP → Console based on environment variables
 */

import { ResendStrategy } from './strategies/resend.js';
import { SmtpStrategy } from './strategies/smtp.js';
import { ConsoleStrategy } from './strategies/console.js';
import type { EmailConfig } from './defaults.js';
import { EmailError } from './errors.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/email/README.md';

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
export class EmailClass {
  public config: EmailConfig;
  private strategy: ResendStrategy | SmtpStrategy | ConsoleStrategy;
  private connected: boolean = false;

  constructor(config: EmailConfig) {
    this.config = config;
    this.strategy = this.createStrategy();
  }

  /**
   * Creates appropriate strategy based on configuration
   * @llm-rule WHEN: Email initialization - selects Resend, SMTP, or Console based on environment
   * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
   */
  private createStrategy(): ResendStrategy | SmtpStrategy | ConsoleStrategy {
    switch (this.config.strategy) {
      case 'resend':
        return new ResendStrategy(this.config);
      case 'smtp':
        return new SmtpStrategy(this.config);
      case 'console':
        return new ConsoleStrategy(this.config);
      default:
        throw new EmailError(
          `[@bloomneo/appkit/email] Unknown email strategy: "${this.config.strategy}". Must be "resend", "smtp", or "console". See: ${DOCS_URL}#environment-variables`,
          { code: 'EMAIL_INVALID_STRATEGY' }
        );
    }
  }

  /**
   * Sends email with automatic strategy handling
   * @llm-rule WHEN: Sending any email - this is the main email sending method
   * @llm-rule AVOID: Manual strategy calls - this handles all email complexity
   * @llm-rule NOTE: Auto-fills FROM address from config if not provided
   */
  async send(data: EmailData): Promise<EmailResult> {
    try {
      // Validate email data
      this.validateEmailData(data);

      // Auto-fill FROM address if not provided
      const emailData = this.prepareEmailData(data);

      // Send via strategy
      const result = await this.strategy.send(emailData);

      // Log success in development
      if (this.config.environment.isDevelopment && result.success) {
        console.log(`✅ [@bloomneo/appkit/email] Email sent successfully${result.messageId ? ` (ID: ${result.messageId})` : ''}`);
      }

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`❌ [@bloomneo/appkit/email] Email send failed:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sends multiple emails efficiently (batch operation)
   * @llm-rule WHEN: Sending multiple emails like newsletters or notifications
   * @llm-rule AVOID: Multiple individual send() calls - this handles batching efficiently
   * @llm-rule NOTE: Processes in batches to avoid overwhelming email providers
   */
  async sendBatch(emails: EmailData[], batchSize: number = 10): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    
    // Process in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Send batch concurrently
      const batchPromises = batch.map(email => this.send(email));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }
      
      // Small delay between batches to be respectful to email providers
      if (i + batchSize < emails.length) {
        await this.sleep(100);
      }
    }
    
    return results;
  }

  /**
   * Sends simple text email (convenience method)
   * @llm-rule WHEN: Sending simple text-only emails quickly
   * @llm-rule AVOID: Complex EmailData object for simple emails - this is more convenient
   */
  async sendText(to: string, subject: string, text: string): Promise<EmailResult> {
    return await this.send({
      to,
      subject,
      text,
    });
  }

  /**
   * Sends HTML email (convenience method)
   * @llm-rule WHEN: Sending HTML emails with formatting
   * @llm-rule AVOID: Manual HTML/text preparation - this handles both formats
   */
  async sendHtml(to: string, subject: string, html: string, text?: string): Promise<EmailResult> {
    return await this.send({
      to,
      subject,
      html,
      text: text || this.htmlToText(html),
    });
  }

  /**
   * Disconnects email strategy gracefully
   * @llm-rule WHEN: App shutdown or email cleanup
   * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.strategy.disconnect();
      this.connected = false;

      if (this.config.environment.isDevelopment) {
        console.log(`👋 [@bloomneo/appkit/email] Email disconnected`);
      }
    } catch (error) {
      console.error(`⚠️ [@bloomneo/appkit/email] Email disconnect error:`, (error as Error).message);
    }
  }

  /**
   * Gets current email strategy name for debugging
   * @llm-rule WHEN: Debugging or health checks to see which strategy is active
   * @llm-rule AVOID: Using for application logic - email should be transparent
   */
  getStrategy(): string {
    return this.config.strategy;
  }

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
  } {
    return {
      strategy: this.config.strategy,
      fromName: this.config.from.name,
      fromEmail: this.config.from.email,
      connected: this.connected,
    };
  }

  // Private helper methods

  /**
   * Validates email data before sending
   */
  private validateEmailData(data: EmailData): void {
    if (!data.to) {
      throw new EmailError(
        `[@bloomneo/appkit/email] Email "to" field is required. See: ${DOCS_URL}#complete-api`,
        { code: 'EMAIL_INVALID_MESSAGE' }
      );
    }

    if (!data.subject) {
      throw new EmailError(
        `[@bloomneo/appkit/email] Email "subject" field is required. See: ${DOCS_URL}#complete-api`,
        { code: 'EMAIL_INVALID_MESSAGE' }
      );
    }

    if (!data.text && !data.html) {
      throw new EmailError(
        `[@bloomneo/appkit/email] Email must have either "text" or "html" content. See: ${DOCS_URL}#complete-api`,
        { code: 'EMAIL_INVALID_MESSAGE' }
      );
    }

    // Validate email addresses
    const recipients = Array.isArray(data.to) ? data.to : [data.to];
    for (const recipient of recipients) {
      const email = typeof recipient === 'string' ? recipient : recipient.email;
      if (!this.isValidEmail(email)) {
        throw new EmailError(
          `[@bloomneo/appkit/email] Invalid "to" email address: "${email}". See: ${DOCS_URL}#common-mistakes`,
          { code: 'EMAIL_INVALID_ADDRESS' }
        );
      }
    }

    // Validate FROM address if provided
    if (data.from) {
      const fromEmail = typeof data.from === 'string' ? data.from : data.from.email;
      if (!this.isValidEmail(fromEmail)) {
        throw new EmailError(
          `[@bloomneo/appkit/email] Invalid "from" email address: "${fromEmail}". See: ${DOCS_URL}#common-mistakes`,
          { code: 'EMAIL_INVALID_ADDRESS' }
        );
      }
    }
  }

  /**
   * Prepares email data with defaults
   */
  private prepareEmailData(data: EmailData): EmailData {
    const prepared = { ...data };

    // Auto-fill FROM address if not provided
    if (!prepared.from) {
      prepared.from = {
        name: this.config.from.name,
        email: this.config.from.email,
      };
    }

    return prepared;
  }

  /**
   * Validates email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Converts HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}