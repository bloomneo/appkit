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
import { getSmartDefaults, validateProductionRequirements, validateStartupConfiguration, performHealthCheck, } from './defaults.js';
const DOCS_URL = 'https://github.com/bloomneo/appkit/blob/main/src/email/README.md';
// Global email instance for performance (like auth module)
let globalEmail = null;
/**
 * Get email instance - the only function you need to learn
 * Strategy auto-detected from environment (RESEND_API_KEY → Resend, SMTP_HOST → SMTP, default → Console)
 * @llm-rule WHEN: Need email sending in any part of your app - this is your main entry point
 * @llm-rule AVOID: Creating EmailClass directly - always use this function
 * @llm-rule NOTE: Typical flow - get() → email.send() → email delivered/logged
 */
function get() {
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
async function clear() {
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
async function reset(newConfig) {
    // Clear existing instance
    await clear();
    // Reset configuration
    if (newConfig) {
        const defaults = getSmartDefaults();
        const config = { ...defaults, ...newConfig };
        globalEmail = new EmailClass(config);
    }
    else {
        globalEmail = null; // Will reload from environment on next get()
    }
}
/**
 * Get active email strategy for debugging
 * @llm-rule WHEN: Debugging or health checks to see which strategy is active (Resend/SMTP/Console)
 * @llm-rule AVOID: Using for application logic - email should be transparent
 */
function getStrategy() {
    const email = get();
    return email.getStrategy();
}
/**
 * Get email configuration summary for debugging
 * @llm-rule WHEN: Health checks or debugging email configuration
 * @llm-rule AVOID: Exposing sensitive API keys or passwords - this only shows safe info
 */
function getConfig() {
    const email = get();
    return email.getConfig();
}
/**
 * Check if Resend is available and configured
 * @llm-rule WHEN: Conditional logic based on email capabilities
 * @llm-rule AVOID: Complex email detection - just use email normally, it handles strategy
 */
function hasResend() {
    return !!process.env.RESEND_API_KEY;
}
/**
 * Check if SMTP is available and configured
 * @llm-rule WHEN: Conditional logic based on email capabilities
 * @llm-rule AVOID: Complex email detection - just use email normally, it handles strategy
 */
function hasSmtp() {
    return !!process.env.SMTP_HOST;
}
/**
 * Check if any email provider is configured (not just console)
 * @llm-rule WHEN: Determining if real emails can be sent
 * @llm-rule AVOID: Using for validation - email.send() will return success/error appropriately
 */
function hasProvider() {
    return hasResend() || hasSmtp();
}
/**
 * Send simple email (convenience function)
 * @llm-rule WHEN: Quick email sending without getting instance first
 * @llm-rule AVOID: For complex emails - use get() and full EmailData object instead
 */
async function send(data) {
    const email = get();
    return await email.send(data);
}
/**
 * Send simple text email (ultra-convenience function)
 * @llm-rule WHEN: Sending basic notifications or alerts quickly
 * @llm-rule AVOID: For formatted emails - use send() with HTML content instead
 */
async function sendText(to, subject, text) {
    const email = get();
    return await email.sendText(to, subject, text);
}
/**
 * Validate email configuration at startup with detailed feedback
 * @llm-rule WHEN: App startup to ensure email is properly configured
 * @llm-rule AVOID: Skipping validation - missing email config causes runtime issues
 * @llm-rule NOTE: Returns validation results instead of throwing - allows graceful handling
 */
function validateConfig() {
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
    }
    catch (error) {
        const errorMessage = error.message;
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
function validateProduction() {
    try {
        validateProductionRequirements();
        if (process.env.NODE_ENV === 'production' && !hasProvider()) {
            console.warn(`[@bloomneo/appkit/email] No email provider configured in production. Set RESEND_API_KEY or SMTP_HOST to send real emails. See: ${DOCS_URL}#production-deployment`);
        }
        console.log('✅ [@bloomneo/appkit/email] Production email requirements validated');
    }
    catch (error) {
        console.error('[@bloomneo/appkit/email] Production email validation failed:', error.message);
        throw error;
    }
}
/**
 * Get comprehensive health check status for monitoring
 * @llm-rule WHEN: Health check endpoints or monitoring systems
 * @llm-rule AVOID: Using in critical application path - this is for monitoring only
 * @llm-rule NOTE: Returns detailed status without exposing sensitive configuration
 */
function getHealthStatus() {
    return performHealthCheck();
}
/**
 * Graceful shutdown for email instance
 * @llm-rule WHEN: App shutdown or process termination
 * @llm-rule AVOID: Abrupt process exit - graceful shutdown prevents connection issues
 */
async function shutdown() {
    console.log('🔄 [@bloomneo/appkit/email] Email graceful shutdown...');
    try {
        await clear();
        console.log('✅ [@bloomneo/appkit/email] Email shutdown complete');
    }
    catch (error) {
        console.error('❌ [@bloomneo/appkit/email] Email shutdown error:', error.message);
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
    shutdown,
};
export { EmailClass } from './email.js';
// Default export
export default emailClass;
// Auto-setup graceful shutdown handlers
if (typeof process !== 'undefined') {
    // Handle graceful shutdown
    const shutdownHandler = () => {
        shutdown().finally(() => {
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('[@bloomneo/appkit/email] Uncaught exception during email operation:', error);
        shutdown().finally(() => {
            process.exit(1);
        });
    });
    process.on('unhandledRejection', (reason) => {
        console.error('[@bloomneo/appkit/email] Unhandled rejection during email operation:', reason);
        shutdown().finally(() => {
            process.exit(1);
        });
    });
}
//# sourceMappingURL=index.js.map