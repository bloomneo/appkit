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

import { EmailClass } from './email.js';
import {
  getSmartDefaults,
  validateProductionRequirements,
  validateStartupConfiguration,
  performHealthCheck,
  type EmailConfig,
} from './defaults.js';

const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/email/README.md';

// Global email instance for performance (like auth module)
let globalEmail: EmailClass | null = null;

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
function get(): Email {
  // Lazy initialization - parse environment once (like auth)
  if (!globalEmail) {
    const config = getSmartDefaults();
    globalEmail = new EmailClass(config);
  }

  return globalEmail;
}

/**
 * Clear email instance and disconnect - essential for testing
 * @llm-rule WHEN: Testing email logic with different configurations or app shutdown
 * @llm-rule AVOID: Using in production except for graceful shutdown
 */
async function clear(): Promise<void> {
  if (globalEmail) {
    await globalEmail.disconnect();
    globalEmail = null;
  }
}

/**
 * Reset email configuration (useful for testing)
 * @llm-rule WHEN: Testing email logic with different environment configurations
 * @llm-rule AVOID: Using in production - only for tests and development
 */
async function reset(newConfig?: Partial<EmailConfig>): Promise<void> {
  // Clear existing instance
  await clear();

  // Reset configuration
  if (newConfig) {
    const defaults = getSmartDefaults();
    const config = { ...defaults, ...newConfig };
    globalEmail = new EmailClass(config);
  } else {
    globalEmail = null; // Will reload from environment on next get()
  }
}

/**
 * Get active email strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Resend/SMTP/Console)
 * @llm-rule AVOID: Using for application logic - email should be transparent
 */
function getStrategy(): string {
  const email = get();
  return email.getStrategy();
}

/**
 * Get email configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging email configuration
 * @llm-rule AVOID: Exposing sensitive API keys or passwords - this only shows safe info
 */
function getConfig(): {
  strategy: string;
  fromName: string;
  fromEmail: string;
  connected: boolean;
} {
  const email = get();
  return email.getConfig();
}

/**
 * Check if Resend is available and configured
 * @llm-rule WHEN: Conditional logic based on email capabilities
 * @llm-rule AVOID: Complex email detection - just use email normally, it handles strategy
 */
function hasResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Check if SMTP is available and configured
 * @llm-rule WHEN: Conditional logic based on email capabilities
 * @llm-rule AVOID: Complex email detection - just use email normally, it handles strategy
 */
function hasSmtp(): boolean {
  return !!process.env.SMTP_HOST;
}

/**
 * Check if any email provider is configured (not just console)
 * @llm-rule WHEN: Determining if real emails can be sent
 * @llm-rule AVOID: Using for validation - email.send() will return success/error appropriately
 */
function hasProvider(): boolean {
  return hasResend() || hasSmtp();
}

/**
 * Send simple email (convenience function)
 * @llm-rule WHEN: Quick email sending without getting instance first
 * @llm-rule AVOID: For complex emails - use get() and full EmailData object instead
 */
async function send(data: EmailData): Promise<EmailResult> {
  const email = get();
  return await email.send(data);
}

/**
 * Send simple text email (ultra-convenience function)
 * @llm-rule WHEN: Sending basic notifications or alerts quickly
 * @llm-rule AVOID: For formatted emails - use send() with HTML content instead
 */
async function sendText(to: string, subject: string, text: string): Promise<EmailResult> {
  const email = get();
  return await email.sendText(to, subject, text);
}

/**
 * Validate email configuration at startup with detailed feedback
 * @llm-rule WHEN: App startup to ensure email is properly configured
 * @llm-rule AVOID: Skipping validation - missing email config causes runtime issues
 * @llm-rule NOTE: Returns validation results instead of throwing - allows graceful handling
 */
function validateConfig(): {
  valid: boolean;
  strategy: string;
  warnings: string[];
  errors: string[];
  ready: boolean;
} {
  try {
    const validation = validateStartupConfiguration();
    
    if (validation.errors.length > 0) {
      console.error('[@bloomneo/appkit/email] Email configuration errors:', validation.errors);
    }

    if (validation.warnings.length > 0) {
      console.warn('[@bloomneo/appkit/email] Email configuration warnings:', validation.warnings);
    }

    if (validation.ready) {
      console.log(`✅ [@bloomneo/appkit/email] Email configured with ${validation.strategy} strategy`);
    }
    
    return {
      valid: validation.errors.length === 0,
      strategy: validation.strategy,
      warnings: validation.warnings,
      errors: validation.errors,
      ready: validation.ready,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[@bloomneo/appkit/email] Email configuration validation failed:', errorMessage);
    
    return {
      valid: false,
      strategy: 'unknown',
      warnings: [],
      errors: [errorMessage],
      ready: false,
    };
  }
}

/**
 * Validate production requirements and throw if critical issues found
 * @llm-rule WHEN: Production deployment validation - ensures email works in production
 * @llm-rule AVOID: Skipping in production - email failures are often silent
 * @llm-rule NOTE: Throws on critical issues, warns on non-critical ones
 */
function validateProduction(): void {
  try {
    validateProductionRequirements();
    
    if (process.env.NODE_ENV === 'production' && !hasProvider()) {
      console.warn(
        `[@bloomneo/appkit/email] No email provider configured in production. Set RESEND_API_KEY or SMTP_HOST to send real emails. See: ${DOCS_URL}#production-deployment`
      );
    }

    console.log('✅ [@bloomneo/appkit/email] Production email requirements validated');
  } catch (error) {
    console.error('[@bloomneo/appkit/email] Production email validation failed:', (error as Error).message);
    throw error;
  }
}

/**
 * Get comprehensive health check status for monitoring
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Using in critical application path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed status without exposing sensitive configuration
 */
function getHealthStatus(): {
  status: 'healthy' | 'warning' | 'error';
  strategy: string;
  configured: boolean;
  issues: string[];
  ready: boolean;
  timestamp: string;
} {
  return performHealthCheck();
}

/**
 * Close email provider connections and reset internal state — the canonical
 * teardown call. Named to match cache/queue per NAMING.md §Bulk-and-Lifecycle-Ops
 * so agents see one teardown verb across every appkit module.
 *
 * @llm-rule WHEN: App shutdown, SIGTERM handler, end-of-test-suite teardown
 * @llm-rule AVOID: Abrupt process exit — graceful drain prevents partial sends
 */
async function disconnectAll(): Promise<void> {
  console.log('🔄 [@bloomneo/appkit/email] Email graceful shutdown...');

  try {
    await clear();
    console.log('✅ [@bloomneo/appkit/email] Email shutdown complete');
  } catch (error) {
    console.error('❌ [@bloomneo/appkit/email] Email shutdown error:', (error as Error).message);
  }
}

/**
 * Single email export with minimal API (like auth module)
 */
export const emailClass = {
  // Core method (like auth.get())
  get,
  
  // Utility methods
  clear,
  reset,
  getStrategy,
  getConfig,
  hasResend,
  hasSmtp,
  hasProvider,
  
  // Convenience methods
  send,
  sendText,
  
  // Validation and lifecycle
  validateConfig,
  validateProduction,
  getHealthStatus,
  disconnectAll,
} as const;

// Re-export types for consumers
export type { EmailConfig } from './defaults.js';
export { EmailClass } from './email.js';

// Default export
export default emailClass;

// Graceful shutdown is opt-in. The library does not register process signal
// handlers — the host app owns its lifecycle. Wire it up yourself:
//
//   import emailClass from '@bloomneo/appkit/email';
//   process.on('SIGTERM', () => emailClass.disconnectAll().finally(() => process.exit(0)));
//   process.on('SIGINT',  () => emailClass.disconnectAll().finally(() => process.exit(0)));