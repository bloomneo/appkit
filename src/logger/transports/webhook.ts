/**
 * Webhook transport for real-time alerts with Slack and generic webhook support
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/webhook.ts
 * 
 * @llm-rule WHEN: Need real-time error alerts or notifications to Slack/Discord/Teams
 * @llm-rule AVOID: High-frequency logging - webhooks are for alerts, not all logs
 * @llm-rule NOTE: Only sends errors by default, auto-detects Slack format, includes rate limiting
 */

import https from 'https';
import http from 'http';
import type { LogEntry, Transport } from '../logger.js';
import type { LoggingConfig } from '../defaults.js';

/**
 * Webhook transport for real-time alerts with automatic service detection
 */
export class WebhookTransport implements Transport {
  private url: string;
  private level: 'debug' | 'info' | 'warn' | 'error';
  private rateLimit: number;
  private minimal: boolean;
  
  // Webhook state
  private parsedUrl: URL;
  private serviceType: 'slack' | 'generic';
  private rateLimitQueue: number[] = [];
  private rateLimitWindow = 60000; // 1 minute

  /**
   * Creates webhook transport with direct environment access (like auth pattern)
   * @llm-rule WHEN: Logger initialization with VOILA_LOGGING_WEBHOOK_URL environment variable
   * @llm-rule AVOID: Manual webhook configuration - environment detection handles this
   * @llm-rule NOTE: Auto-detects Slack URLs and formats messages appropriately
   */
  constructor(config: LoggingConfig) {
    // Direct access to config (like auth module pattern)
    this.url = config.webhook.url!;
    this.level = config.webhook.level;
    this.rateLimit = config.webhook.rateLimit;
    this.minimal = config.minimal;
    
    this.parsedUrl = new URL(this.url);
    this.serviceType = this.detectServiceType();
    
    // Adjust rate limiting for minimal mode (fewer alerts)
    if (this.minimal) {
      this.rateLimit = Math.min(this.rateLimit, 5);
    }
    
    // Initialize cleanup for rate limiting
    this.setupRateLimitCleanup();
  }

  /**
   * Detect webhook service type from URL
   * @llm-rule WHEN: Determining message format based on webhook provider
   * @llm-rule AVOID: Manual service configuration - URL detection is automatic
   */
  private detectServiceType(): 'slack' | 'generic' {
    const hostname = this.parsedUrl.hostname.toLowerCase();
    
    if (hostname.includes('slack.com')) return 'slack';
    
    return 'generic';
  }

  /**
   * Write log entry to webhook (immediate, level-filtered)
   * @llm-rule WHEN: Sending critical alerts and errors to notification services
   * @llm-rule AVOID: Calling directly - logger routes entries automatically
   */
  async write(entry: LogEntry): Promise<void> {
    try {
      // Check if this level should be sent
      if (!this.shouldSendLevel(entry.level)) {
        return;
      }

      // Check rate limiting to prevent spam
      if (!this.checkRateLimit()) {
        console.warn('Webhook rate limit exceeded, dropping alert');
        return;
      }

      // Optimize entry for webhook transmission
      const optimizedEntry = this.optimizeEntry(entry);

      // Send immediately (webhooks are for real-time alerts)
      await this.sendWebhook(optimizedEntry);

      // Track for rate limiting
      this.rateLimitQueue.push(Date.now());
    } catch (error) {
      console.error('Webhook transport write error:', (error as Error).message);
    }
  }

  /**
   * Check if log level should be sent to webhook
   * @llm-rule WHEN: Filtering logs to only send important alerts
   * @llm-rule AVOID: Sending all logs - webhooks are for errors and critical events
   */
  private shouldSendLevel(level: string): boolean {
    const levels: Record<string, number> = { 
      error: 0, warn: 1, info: 2, debug: 3 
    };
    const configLevel = levels[this.level];
    const entryLevel = levels[level];

    return entryLevel <= configLevel;
  }

  /**
   * Check rate limiting to prevent webhook spam
   * @llm-rule WHEN: Preventing too many webhook calls in short time
   * @llm-rule AVOID: Unlimited webhook sending - can get you banned from services
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const recentWebhooks = this.rateLimitQueue.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    );

    return recentWebhooks.length < this.rateLimit;
  }

  /**
   * Optimize log entry for webhook alerts
   * @llm-rule WHEN: Creating focused alert messages with essential information
   * @llm-rule AVOID: Sending full log entries - webhooks need concise, actionable alerts
   */
  private optimizeEntry(entry: LogEntry): any {
    const {
      timestamp,
      level,
      message,
      component,
      requestId,
      userId,
      method,
      url,
      statusCode,
      error,
      service,
      environment,
      ...rest
    } = entry;

    const optimized: any = {
      timestamp,
      level,
      message,
    };

    // Add essential context for alerts
    if (component) optimized.component = component;
    if (requestId) optimized.requestId = requestId;
    if (userId) optimized.userId = userId;
    if (service) optimized.service = service;
    if (environment) optimized.environment = environment;

    // Add HTTP context for API errors
    if (level === 'error') {
      if (method) optimized.method = method;
      if (url) optimized.url = url;
      if (statusCode) optimized.statusCode = statusCode;
    }

    // Optimize error information for alerts
    if (error) {
      optimized.error = this.optimizeError(error);
    }

    // Add only critical metadata for alerts
    if (!this.minimal) {
      const criticalMeta = this.filterCriticalMeta(rest);
      if (Object.keys(criticalMeta).length > 0) {
        optimized.meta = criticalMeta;
      }
    }

    return optimized;
  }

  /**
   * Optimize error object for webhook alerts
   * @llm-rule WHEN: Including error details in alerts without sensitive information
   * @llm-rule AVOID: Including stack traces - security risk and too verbose for alerts
   */
  private optimizeError(error: any): any {
    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const optimized: any = {
        message: error.message,
      };

      // Add important error fields for debugging
      if (error.name && error.name !== 'Error') {
        optimized.name = error.name;
      }
      if (error.code) {
        optimized.code = error.code;
      }
      if (error.statusCode) {
        optimized.statusCode = error.statusCode;
      }

      // Never include stack traces in webhooks (security + brevity)
      return optimized;
    }

    return error;
  }

  /**
   * Filter metadata for critical alert information only
   * @llm-rule WHEN: Including only the most important context in alerts
   * @llm-rule AVOID: Including all metadata - alerts should be concise and actionable
   */
  private filterCriticalMeta(meta: any): any {
    const critical: any = {};

    // Only the most critical fields for alerts
    const criticalKeys = [
      'tenantId', 'appName', 'version'
    ];

    for (const key of criticalKeys) {
      if (meta[key] !== undefined) {
        critical[key] = meta[key];
      }
    }

    return critical;
  }

  /**
   * Send log entry via webhook with service-specific formatting
   * @llm-rule WHEN: Transmitting alert to webhook service
   * @llm-rule AVOID: Generic format for known services - optimized formats are better
   */
  private async sendWebhook(entry: any): Promise<void> {
    const payload = this.formatWebhookPayload(entry);
    await this.makeHttpRequest(payload);
  }

  /**
   * Format log entry for specific webhook services
   * @llm-rule WHEN: Converting alerts to service-specific format for better presentation
   * @llm-rule AVOID: Always using generic format - Slack format shows much better
   */
  private formatWebhookPayload(entry: any): string {
    switch (this.serviceType) {
      case 'slack':
        return JSON.stringify(this.formatSlackPayload(entry));

      case 'generic':
      default:
        return JSON.stringify({
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          scope: this.minimal ? 'minimal' : 'full',
          data: entry,
          alert: {
            severity: this.mapLevelToSeverity(entry.level),
            service: entry.service || 'unknown',
            component: entry.component || 'unknown',
          },
        });
    }
  }

  /**
   * Format alert for Slack with rich formatting
   * @llm-rule WHEN: Sending alerts to Slack channels for team notifications
   * @llm-rule AVOID: Plain text format - Slack's rich format is much more readable
   */
  private formatSlackPayload(entry: any): any {
    const color = this.getSlackColor(entry.level);
    const emoji = this.getLevelEmoji(entry.level);
    const scopeIndicator = this.minimal ? '🔹' : '🔸';

    const fields: any[] = [
      {
        title: 'Message',
        value: entry.message,
        short: false,
      },
    ];

    // Add context fields
    if (entry.component) {
      fields.push({
        title: 'Component',
        value: entry.component,
        short: true,
      });
    }

    if (entry.service) {
      fields.push({
        title: 'Service',
        value: entry.service,
        short: true,
      });
    }

    if (entry.environment) {
      fields.push({
        title: 'Environment',
        value: entry.environment,
        short: true,
      });
    }

    // Add error details if present
    if (entry.error) {
      const errorText = typeof entry.error === 'object' 
        ? entry.error.message 
        : entry.error;
      
      fields.push({
        title: 'Error Details',
        value: errorText,
        short: false,
      });
    }

    // Add HTTP context for API errors
    if (entry.level === 'error' && (entry.method || entry.url || entry.statusCode)) {
      let httpInfo = '';
      if (entry.method && entry.url) {
        httpInfo += `${entry.method} ${entry.url}`;
      }
      if (entry.statusCode) {
        httpInfo += ` (${entry.statusCode})`;
      }

      if (httpInfo) {
        fields.push({
          title: 'HTTP Context',
          value: httpInfo,
          short: true,
        });
      }
    }

    // Add user context if available
    if (entry.userId) {
      fields.push({
        title: 'User ID',
        value: entry.userId,
        short: true,
      });
    }

    if (entry.requestId) {
      fields.push({
        title: 'Request ID',
        value: entry.requestId,
        short: true,
      });
    }

    return {
      text: `${scopeIndicator} ${emoji} *${entry.level.toUpperCase()}* Alert`,
      attachments: [
        {
          color: color,
          fields: fields,
          footer: 'Bloomneo AppKit Logging',
          ts: Math.floor(new Date(entry.timestamp).getTime() / 1000),
        },
      ],
    };
  }

  /**
   * Get Slack color for different log levels
   * @llm-rule WHEN: Styling Slack messages for visual priority
   * @llm-rule AVOID: Same color for all levels - visual distinction helps prioritization
   */
  private getSlackColor(level: string): string {
    const colors: Record<string, string> = {
      error: 'danger',    // Red
      warn: 'warning',    // Yellow  
      info: 'good',       // Green
      debug: '#36a64f',   // Light green
    };
    return colors[level] || 'good';
  }

  /**
   * Get emoji for different log levels
   * @llm-rule WHEN: Adding visual indicators to alerts for quick recognition
   * @llm-rule AVOID: No visual indicators - emojis help with quick alert scanning
   */
  private getLevelEmoji(level: string): string {
    const emojis: Record<string, string> = {
      error: '🚨',  // Siren
      warn: '⚠️',   // Warning
      info: 'ℹ️',   // Information
      debug: '🐛',  // Bug
    };
    return emojis[level] || 'ℹ️';
  }

  /**
   * Map log level to alert severity
   * @llm-rule WHEN: Converting log levels to standard alert severity levels
   * @llm-rule AVOID: Using log levels directly - severity is more standardized
   */
  private mapLevelToSeverity(level: string): string {
    const severityMap: Record<string, string> = {
      error: 'critical',
      warn: 'warning', 
      info: 'info',
      debug: 'low',
    };
    return severityMap[level] || 'info';
  }

  /**
   * Make HTTP request with retry logic
   * @llm-rule WHEN: Sending webhook with reliability for important alerts
   * @llm-rule AVOID: Single attempt - webhooks can fail due to network issues
   */
  private async makeHttpRequest(payload: string): Promise<void> {
    const maxRetries = 2; // Limited retries for webhooks
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.executeHttpRequest(payload);
        return; // Success
      } catch (error: any) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = 1000 * attempt; // Linear backoff for webhooks
          console.warn(
            `Webhook attempt ${attempt} failed, retrying in ${delay}ms:`,
            error.message
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute single HTTP request with timeout
   * @llm-rule WHEN: Making actual webhook call
   * @llm-rule AVOID: Long timeouts - webhooks should respond quickly
   */
  private executeHttpRequest(payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const isHttps = this.parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: this.parsedUrl.hostname,
        port: this.parsedUrl.port || (isHttps ? 443 : 80),
        path: this.parsedUrl.pathname + this.parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'Bloomneo-AppKit-Logging/1.0.0',
        },
        timeout: 10000, // 10 second timeout for webhooks
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Webhook HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook timeout after 10000ms'));
      });

      req.on('error', (error) => {
        reject(new Error(`Webhook request failed: ${error.message}`));
      });

      // Write payload and end request
      req.write(payload);
      req.end();
    });
  }

  /**
   * Setup rate limit cleanup
   * @llm-rule WHEN: Preventing memory leaks from rate limit tracking
   * @llm-rule AVOID: Infinite memory growth - periodic cleanup is essential
   */
  private setupRateLimitCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      this.rateLimitQueue = this.rateLimitQueue.filter(
        timestamp => now - timestamp < this.rateLimitWindow
      );
    }, this.rateLimitWindow);
  }

  /**
   * Sleep for specified milliseconds
   * @llm-rule WHEN: Implementing retry delays
   * @llm-rule AVOID: Busy waiting - proper sleep prevents CPU waste
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if this transport should log the given level
   * @llm-rule WHEN: Logger asks if transport handles this level
   * @llm-rule AVOID: Complex level logic - webhook uses own level filtering
   */
  shouldLog(level: string, configLevel: string): boolean {
    // Webhook uses its own level filtering via shouldSendLevel
    return this.shouldSendLevel(level);
  }

  /**
   * Flush pending logs (no-op for webhook - immediate sending)
   * @llm-rule WHEN: Logger cleanup - webhooks send immediately
   * @llm-rule AVOID: Expecting batching behavior - webhooks are immediate
   */
  async flush(): Promise<void> {
    // Webhooks send immediately, no batching needed
    return Promise.resolve();
  }

  /**
   * Close webhook transport
   * @llm-rule WHEN: Logger shutdown or cleanup
   * @llm-rule AVOID: Expecting cleanup behavior - webhooks have no persistent resources
   */
  async close(): Promise<void> {
    // Webhook transport has no persistent resources to clean up
    return Promise.resolve();
  }
}