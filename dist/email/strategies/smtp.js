/**
 * SMTP email strategy with nodemailer and connection pooling
 * @module @bloomneo/appkit/email
 * @file src/email/strategies/smtp.ts
 *
 * @llm-rule WHEN: App has SMTP_HOST environment variable for universal email sending
 * @llm-rule AVOID: Manual SMTP setup - this handles connection pooling, authentication, and reliability
 * @llm-rule NOTE: Universal email strategy that works with any SMTP server (Gmail, Outlook, etc.)
 */
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/email/README.md';
/**
 * SMTP email strategy with connection pooling and reliability features
 */
export class SmtpStrategy {
    config;
    transporter = null;
    connected = false;
    /**
     * Creates SMTP strategy with direct environment access (like auth pattern)
     * @llm-rule WHEN: Email initialization with SMTP_HOST detected
     * @llm-rule AVOID: Manual SMTP configuration - environment detection handles this
     */
    constructor(config) {
        this.config = config;
    }
    /**
     * Sends email via SMTP with automatic connection management
     * @llm-rule WHEN: Sending emails through SMTP servers
     * @llm-rule AVOID: Manual SMTP calls - this handles all connection complexity
     * @llm-rule NOTE: Includes connection pooling, authentication, and error handling
     */
    async send(data) {
        try {
            // Ensure transporter is connected
            await this.ensureConnected();
            // Convert to nodemailer format
            const mailOptions = this.convertToSmtpFormat(data);
            // Send via SMTP
            const result = await this.transporter.sendMail(mailOptions);
            return {
                success: true,
                messageId: result.messageId,
            };
        }
        catch (error) {
            const errorMessage = this.parseSmtpError(error);
            if (this.config.environment.isDevelopment) {
                console.error(`[@bloomneo/appkit/email] SMTP error:`, errorMessage);
            }
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    /**
     * Disconnects SMTP strategy gracefully
     * @llm-rule WHEN: App shutdown or email cleanup
     * @llm-rule AVOID: Abrupt disconnection - graceful shutdown prevents connection issues
     */
    async disconnect() {
        if (!this.connected || !this.transporter)
            return;
        try {
            await this.transporter.close();
            this.connected = false;
            this.transporter = null;
            if (this.config.environment.isDevelopment) {
                console.log(`👋 [@bloomneo/appkit/email] SMTP disconnected`);
            }
        }
        catch (error) {
            console.error(`⚠️ [@bloomneo/appkit/email] SMTP disconnect error:`, error.message);
        }
    }
    // Private helper methods
    /**
     * Ensures SMTP transporter is connected
     */
    async ensureConnected() {
        if (this.connected && this.transporter)
            return;
        try {
            // Dynamic import for nodemailer
            const nodemailer = await import('nodemailer');
            const smtpConfig = this.config.smtp;
            // Create transporter with connection pooling
            this.transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                auth: smtpConfig.auth.user && smtpConfig.auth.pass ? {
                    user: smtpConfig.auth.user,
                    pass: smtpConfig.auth.pass,
                } : undefined,
                pool: smtpConfig.pool,
                maxConnections: 5,
                maxMessages: 100,
                rateDelta: 1000,
                rateLimit: 10,
                connectionTimeout: smtpConfig.timeout,
                socketTimeout: smtpConfig.timeout,
                // Security options
                tls: {
                    rejectUnauthorized: this.config.environment.isProduction,
                },
            });
            // Verify connection
            await this.transporter.verify();
            this.connected = true;
            if (this.config.environment.isDevelopment) {
                console.log(`✅ [@bloomneo/appkit/email] SMTP connected to ${smtpConfig.host}:${smtpConfig.port}`);
            }
        }
        catch (error) {
            this.connected = false;
            this.transporter = null;
            throw new Error(`[@bloomneo/appkit/email] SMTP connection failed: ${error.message}. See: ${DOCS_URL}#smtp-universal`);
        }
    }
    /**
     * Converts EmailData to nodemailer format
     */
    convertToSmtpFormat(data) {
        const mailOptions = {
            from: this.formatEmailAddress(data.from),
            to: this.formatEmailAddresses(data.to),
            subject: data.subject,
        };
        // Add content
        if (data.html) {
            mailOptions.html = data.html;
        }
        if (data.text) {
            mailOptions.text = data.text;
        }
        // Add optional fields
        if (data.replyTo) {
            mailOptions.replyTo = this.formatEmailAddress(data.replyTo);
        }
        if (data.cc) {
            mailOptions.cc = this.formatEmailAddresses(data.cc);
        }
        if (data.bcc) {
            mailOptions.bcc = this.formatEmailAddresses(data.bcc);
        }
        // Add attachments
        if (data.attachments && data.attachments.length > 0) {
            mailOptions.attachments = this.formatAttachments(data.attachments);
        }
        return mailOptions;
    }
    /**
     * Formats single email address for nodemailer
     */
    formatEmailAddress(address) {
        if (typeof address === 'string') {
            return address;
        }
        if (address.name) {
            return `"${address.name}" <${address.email}>`;
        }
        return address.email;
    }
    /**
     * Formats multiple email addresses for nodemailer
     */
    formatEmailAddresses(addresses) {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];
        return addressArray.map(addr => this.formatEmailAddress(addr)).join(', ');
    }
    /**
     * Formats attachments for nodemailer
     */
    formatAttachments(attachments) {
        return attachments.map(attachment => ({
            filename: attachment.filename,
            content: attachment.content,
            contentType: attachment.contentType || this.guessContentType(attachment.filename),
        }));
    }
    /**
     * Guesses content type from filename
     */
    guessContentType(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            txt: 'text/plain',
            html: 'text/html',
            css: 'text/css',
            js: 'application/javascript',
            json: 'application/json',
            zip: 'application/zip',
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
    }
    /**
     * Parses SMTP errors into user-friendly messages
     */
    parseSmtpError(error) {
        if (error.message) {
            const message = error.message.toLowerCase();
            // Authentication errors
            if (message.includes('authentication') || message.includes('invalid credentials') ||
                message.includes('username') || message.includes('password')) {
                return 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS environment variables.';
            }
            // Connection errors
            if (message.includes('connection') || message.includes('connect') ||
                message.includes('econnrefused') || message.includes('timeout')) {
                return 'SMTP connection failed. Check SMTP_HOST and SMTP_PORT environment variables.';
            }
            // TLS/SSL errors
            if (message.includes('tls') || message.includes('ssl') || message.includes('secure')) {
                return 'SMTP TLS/SSL error. Check SMTP_SECURE environment variable or server settings.';
            }
            // Rate limiting
            if (message.includes('rate') || message.includes('limit') || message.includes('quota')) {
                return 'SMTP rate limit exceeded. Please try again later.';
            }
            // Recipient errors
            if (message.includes('recipient') || message.includes('address') ||
                message.includes('mailbox') || message.includes('does not exist')) {
                return 'Invalid recipient email address or mailbox does not exist.';
            }
            // Sender errors
            if (message.includes('sender') || message.includes('from') ||
                message.includes('not authorized') || message.includes('relay')) {
                return 'SMTP sender not authorized. Check FROM address and server relay settings.';
            }
            // Message size errors
            if (message.includes('size') || message.includes('too large') || message.includes('exceeded')) {
                return 'Email message too large. Reduce attachment size or content length.';
            }
            // DNS errors
            if (message.includes('dns') || message.includes('hostname') || message.includes('resolve')) {
                return 'DNS resolution failed. Check SMTP_HOST value.';
            }
            // Port errors
            if (message.includes('port') || message.includes('refused') || message.includes('unreachable')) {
                return 'SMTP port connection failed. Check SMTP_PORT value and firewall settings.';
            }
            return error.message;
        }
        // Check for specific error codes
        if (error.code) {
            switch (error.code) {
                case 'ECONNREFUSED':
                    return 'SMTP connection refused. Check SMTP_HOST and SMTP_PORT.';
                case 'ENOTFOUND':
                    return 'SMTP host not found. Check SMTP_HOST value.';
                case 'ETIMEDOUT':
                    return 'SMTP connection timeout. Check network connectivity.';
                case 'ECONNRESET':
                    return 'SMTP connection reset. Server may be overloaded.';
                case 'ESOCKET':
                    return 'SMTP socket error. Check network settings.';
                default:
                    return `SMTP error: ${error.code}`;
            }
        }
        return 'Unknown SMTP error occurred';
    }
    /**
     * Gets SMTP connection info for debugging
     */
    getConnectionInfo() {
        const smtpConfig = this.config.smtp;
        return {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            authenticated: !!(smtpConfig.auth.user && smtpConfig.auth.pass),
            connected: this.connected,
        };
    }
}
//# sourceMappingURL=smtp.js.map