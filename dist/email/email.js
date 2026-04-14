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
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/email/README.md';
/**
 * Email class with automatic strategy selection and ultra-simple API
 */
export class EmailClass {
    config;
    strategy;
    connected = false;
    constructor(config) {
        this.config = config;
        this.strategy = this.createStrategy();
    }
    /**
     * Creates appropriate strategy based on configuration
     * @llm-rule WHEN: Email initialization - selects Resend, SMTP, or Console based on environment
     * @llm-rule AVOID: Manual strategy creation - configuration handles strategy selection
     */
    createStrategy() {
        switch (this.config.strategy) {
            case 'resend':
                return new ResendStrategy(this.config);
            case 'smtp':
                return new SmtpStrategy(this.config);
            case 'console':
                return new ConsoleStrategy(this.config);
            default:
                throw new Error(`[@bloomneo/appkit/email] Unknown email strategy: "${this.config.strategy}". Must be "resend", "smtp", or "console". See: ${DOCS_URL}#environment-variables`);
        }
    }
    /**
     * Sends email with automatic strategy handling
     * @llm-rule WHEN: Sending any email - this is the main email sending method
     * @llm-rule AVOID: Manual strategy calls - this handles all email complexity
     * @llm-rule NOTE: Auto-fills FROM address from config if not provided
     */
    async send(data) {
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
        }
        catch (error) {
            const errorMessage = error.message;
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
    async sendBatch(emails, batchSize = 10) {
        const results = [];
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
                }
                else {
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
    async sendText(to, subject, text) {
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
    async sendHtml(to, subject, html, text) {
        return await this.send({
            to,
            subject,
            html,
            text: text || this.htmlToText(html),
        });
    }
    /**
     * Sends email with template (future extension point)
     * @llm-rule WHEN: Sending templated emails with data substitution
     * @llm-rule AVOID: Manual template processing - this will handle template rendering
     * @llm-rule NOTE: Basic implementation - can be extended with template engines
     */
    async sendTemplate(templateName, data) {
        // Simple template processing (can be extended)
        const template = this.loadTemplate(templateName);
        const processedHtml = this.processTemplate(template.html, data);
        const processedText = this.processTemplate(template.text, data);
        return await this.send({
            to: data.to,
            subject: this.processTemplate(template.subject, data),
            html: processedHtml,
            text: processedText,
        });
    }
    /**
     * Disconnects email strategy gracefully
     * @llm-rule WHEN: App shutdown or email cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    async disconnect() {
        if (!this.connected)
            return;
        try {
            await this.strategy.disconnect();
            this.connected = false;
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [@bloomneo/appkit/email] Email disconnected`);
            }
        }
        catch (error) {
            console.error(`⚠️ [@bloomneo/appkit/email] Email disconnect error:`, error.message);
        }
    }
    /**
     * Gets current email strategy name for debugging
     * @llm-rule WHEN: Debugging or health checks to see which strategy is active
     * @llm-rule AVOID: Using for application logic - email should be transparent
     */
    getStrategy() {
        return this.config.strategy;
    }
    /**
     * Gets email configuration summary for debugging
     * @llm-rule WHEN: Health checks or debugging email configuration
     * @llm-rule AVOID: Exposing sensitive details - this only shows safe info
     */
    getConfig() {
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
    validateEmailData(data) {
        if (!data.to) {
            throw new Error(`[@bloomneo/appkit/email] Email "to" field is required. See: ${DOCS_URL}#complete-api`);
        }
        if (!data.subject) {
            throw new Error(`[@bloomneo/appkit/email] Email "subject" field is required. See: ${DOCS_URL}#complete-api`);
        }
        if (!data.text && !data.html) {
            throw new Error(`[@bloomneo/appkit/email] Email must have either "text" or "html" content. See: ${DOCS_URL}#complete-api`);
        }
        // Validate email addresses
        const recipients = Array.isArray(data.to) ? data.to : [data.to];
        for (const recipient of recipients) {
            const email = typeof recipient === 'string' ? recipient : recipient.email;
            if (!this.isValidEmail(email)) {
                throw new Error(`[@bloomneo/appkit/email] Invalid "to" email address: "${email}". See: ${DOCS_URL}#common-mistakes`);
            }
        }
        // Validate FROM address if provided
        if (data.from) {
            const fromEmail = typeof data.from === 'string' ? data.from : data.from.email;
            if (!this.isValidEmail(fromEmail)) {
                throw new Error(`[@bloomneo/appkit/email] Invalid "from" email address: "${fromEmail}". See: ${DOCS_URL}#common-mistakes`);
            }
        }
    }
    /**
     * Prepares email data with defaults
     */
    prepareEmailData(data) {
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
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Converts HTML to plain text (basic implementation)
     */
    htmlToText(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Loads email template (basic implementation)
     */
    loadTemplate(templateName) {
        // Basic built-in templates
        const templates = {
            welcome: {
                subject: 'Welcome to {{appName}}!',
                html: `
          <h1>Welcome {{name}}!</h1>
          <p>Thanks for joining {{appName}}. We're excited to have you!</p>
          <p>Best regards,<br>The {{appName}} Team</p>
        `,
                text: `
          Welcome {{name}}!
          
          Thanks for joining {{appName}}. We're excited to have you!
          
          Best regards,
          The {{appName}} Team
        `,
            },
            reset: {
                subject: 'Reset your {{appName}} password',
                html: `
          <h1>Reset your password</h1>
          <p>Hi {{name}},</p>
          <p>Click the link below to reset your password:</p>
          <a href="{{resetUrl}}">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
        `,
                text: `
          Reset your password
          
          Hi {{name}},
          
          Click the link below to reset your password:
          {{resetUrl}}
          
          If you didn't request this, please ignore this email.
        `,
            },
        };
        const template = templates[templateName];
        if (!template) {
            throw new Error(`[@bloomneo/appkit/email] Template not found: "${templateName}". Built-in templates: "welcome", "reset". See: ${DOCS_URL}#built-in-templates`);
        }
        return template;
    }
    /**
     * Processes template with data substitution
     */
    processTemplate(template, data) {
        let processed = template;
        // Simple {{key}} substitution
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processed = processed.replace(regex, String(value));
        }
        return processed.trim();
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=email.js.map