/**
 * Webhook transport for real-time alerts with Slack and generic webhook support
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/webhook.ts
 *
 * @llm-rule WHEN: Need real-time error alerts or notifications to Slack/Discord/Teams
 * @llm-rule AVOID: High-frequency logging - webhooks are for alerts, not all logs
 * @llm-rule NOTE: Only sends errors by default, auto-detects Slack format, includes rate limiting
 */
import type { LogEntry, Transport } from '../logger.js';
import type { LoggingConfig } from '../defaults.js';
/**
 * Webhook transport for real-time alerts with automatic service detection
 */
export declare class WebhookTransport implements Transport {
    private url;
    private level;
    private rateLimit;
    private minimal;
    private parsedUrl;
    private serviceType;
    private rateLimitQueue;
    private rateLimitWindow;
    /**
     * Creates webhook transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization with VOILA_LOGGING_WEBHOOK_URL environment variable
     * @llm-rule AVOID: Manual webhook configuration - environment detection handles this
     * @llm-rule NOTE: Auto-detects Slack URLs and formats messages appropriately
     */
    constructor(config: LoggingConfig);
    /**
     * Detect webhook service type from URL
     * @llm-rule WHEN: Determining message format based on webhook provider
     * @llm-rule AVOID: Manual service configuration - URL detection is automatic
     */
    private detectServiceType;
    /**
     * Write log entry to webhook (immediate, level-filtered)
     * @llm-rule WHEN: Sending critical alerts and errors to notification services
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     */
    write(entry: LogEntry): Promise<void>;
    /**
     * Check if log level should be sent to webhook
     * @llm-rule WHEN: Filtering logs to only send important alerts
     * @llm-rule AVOID: Sending all logs - webhooks are for errors and critical events
     */
    private shouldSendLevel;
    /**
     * Check rate limiting to prevent webhook spam
     * @llm-rule WHEN: Preventing too many webhook calls in short time
     * @llm-rule AVOID: Unlimited webhook sending - can get you banned from services
     */
    private checkRateLimit;
    /**
     * Optimize log entry for webhook alerts
     * @llm-rule WHEN: Creating focused alert messages with essential information
     * @llm-rule AVOID: Sending full log entries - webhooks need concise, actionable alerts
     */
    private optimizeEntry;
    /**
     * Optimize error object for webhook alerts
     * @llm-rule WHEN: Including error details in alerts without sensitive information
     * @llm-rule AVOID: Including stack traces - security risk and too verbose for alerts
     */
    private optimizeError;
    /**
     * Filter metadata for critical alert information only
     * @llm-rule WHEN: Including only the most important context in alerts
     * @llm-rule AVOID: Including all metadata - alerts should be concise and actionable
     */
    private filterCriticalMeta;
    /**
     * Send log entry via webhook with service-specific formatting
     * @llm-rule WHEN: Transmitting alert to webhook service
     * @llm-rule AVOID: Generic format for known services - optimized formats are better
     */
    private sendWebhook;
    /**
     * Format log entry for specific webhook services
     * @llm-rule WHEN: Converting alerts to service-specific format for better presentation
     * @llm-rule AVOID: Always using generic format - Slack format shows much better
     */
    private formatWebhookPayload;
    /**
     * Format alert for Slack with rich formatting
     * @llm-rule WHEN: Sending alerts to Slack channels for team notifications
     * @llm-rule AVOID: Plain text format - Slack's rich format is much more readable
     */
    private formatSlackPayload;
    /**
     * Get Slack color for different log levels
     * @llm-rule WHEN: Styling Slack messages for visual priority
     * @llm-rule AVOID: Same color for all levels - visual distinction helps prioritization
     */
    private getSlackColor;
    /**
     * Get emoji for different log levels
     * @llm-rule WHEN: Adding visual indicators to alerts for quick recognition
     * @llm-rule AVOID: No visual indicators - emojis help with quick alert scanning
     */
    private getLevelEmoji;
    /**
     * Map log level to alert severity
     * @llm-rule WHEN: Converting log levels to standard alert severity levels
     * @llm-rule AVOID: Using log levels directly - severity is more standardized
     */
    private mapLevelToSeverity;
    /**
     * Make HTTP request with retry logic
     * @llm-rule WHEN: Sending webhook with reliability for important alerts
     * @llm-rule AVOID: Single attempt - webhooks can fail due to network issues
     */
    private makeHttpRequest;
    /**
     * Execute single HTTP request with timeout
     * @llm-rule WHEN: Making actual webhook call
     * @llm-rule AVOID: Long timeouts - webhooks should respond quickly
     */
    private executeHttpRequest;
    /**
     * Setup rate limit cleanup
     * @llm-rule WHEN: Preventing memory leaks from rate limit tracking
     * @llm-rule AVOID: Infinite memory growth - periodic cleanup is essential
     */
    private setupRateLimitCleanup;
    /**
     * Sleep for specified milliseconds
     * @llm-rule WHEN: Implementing retry delays
     * @llm-rule AVOID: Busy waiting - proper sleep prevents CPU waste
     */
    private sleep;
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - webhook uses own level filtering
     */
    shouldLog(level: string, configLevel: string): boolean;
    /**
     * Flush pending logs (no-op for webhook - immediate sending)
     * @llm-rule WHEN: Logger cleanup - webhooks send immediately
     * @llm-rule AVOID: Expecting batching behavior - webhooks are immediate
     */
    flush(): Promise<void>;
    /**
     * Close webhook transport
     * @llm-rule WHEN: Logger shutdown or cleanup
     * @llm-rule AVOID: Expecting cleanup behavior - webhooks have no persistent resources
     */
    close(): Promise<void>;
}
//# sourceMappingURL=webhook.d.ts.map