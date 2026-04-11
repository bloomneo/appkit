/**
 * HTTP transport for external logging services with automatic format detection
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/http.ts
 *
 * @llm-rule WHEN: Need to send logs to external services like Datadog, Elasticsearch, Splunk
 * @llm-rule AVOID: Manual HTTP setup - auto-detects service format from URL
 * @llm-rule NOTE: Supports Datadog, Elasticsearch, Splunk with automatic format conversion
 */
import type { LogEntry, Transport } from '../logger.js';
import type { LoggingConfig } from '../defaults.js';
/**
 * HTTP transport with automatic service detection and format optimization
 */
export declare class HttpTransport implements Transport {
    private url;
    private batchSize;
    private timeout;
    private minimal;
    private batch;
    private flushTimer;
    private parsedUrl;
    private serviceType;
    /**
     * Creates HTTP transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization with VOILA_LOGGING_HTTP_URL environment variable
     * @llm-rule AVOID: Manual HTTP configuration - environment detection handles this
     * @llm-rule NOTE: Auto-detects service type from URL and formats payloads accordingly
     */
    constructor(config: LoggingConfig);
    /**
     * Detect external service type from URL for format optimization
     * @llm-rule WHEN: Determining payload format based on service provider
     * @llm-rule AVOID: Manual service configuration - URL detection is automatic
     */
    private detectServiceType;
    /**
     * Write log entry to HTTP endpoint via batching
     * @llm-rule WHEN: Sending logs to external monitoring services
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     */
    write(entry: LogEntry): void;
    /**
     * Optimize log entry for HTTP transmission
     * @llm-rule WHEN: Reducing payload size and optimizing for external services
     * @llm-rule AVOID: Always sending full entries - minimal scope reduces bandwidth
     */
    private optimizeEntry;
    /**
     * Optimize error object for HTTP transmission
     * @llm-rule WHEN: Sending error data to external monitoring services
     * @llm-rule AVOID: Including stack traces - security risk and bandwidth waste
     */
    private optimizeError;
    /**
     * Filter metadata for essential monitoring fields
     * @llm-rule WHEN: Keeping HTTP payload size manageable while preserving correlation
     * @llm-rule AVOID: Sending all metadata - focus on monitoring and correlation fields
     */
    private filterEssentialMeta;
    /**
     * Setup automatic batch flushing
     * @llm-rule WHEN: Transport initialization - ensures logs are sent regularly
     * @llm-rule AVOID: Manual flushing - automatic batching optimizes HTTP requests
     */
    private setupBatchFlush;
    /**
     * Flush current batch to HTTP endpoint
     * @llm-rule WHEN: Batch is full or timer triggers
     * @llm-rule AVOID: Individual HTTP requests - batching reduces overhead significantly
     */
    private flushBatch;
    /**
     * Send batch of log entries via HTTP
     * @llm-rule WHEN: Transmitting batched logs to external service
     * @llm-rule AVOID: Custom formatting - service detection handles optimal format
     */
    private sendBatch;
    /**
     * Format log entries for specific external services
     * @llm-rule WHEN: Converting logs to service-specific format for optimal ingestion
     * @llm-rule AVOID: Generic format for known services - optimized formats work better
     */
    private formatPayload;
    /**
     * Extract Datadog-specific attributes from log entry
     * @llm-rule WHEN: Formatting logs for Datadog ingestion
     * @llm-rule AVOID: Sending raw entry - Datadog expects specific attribute structure
     */
    private extractDatadogAttributes;
    /**
     * Make HTTP request with retry logic and exponential backoff
     * @llm-rule WHEN: Sending HTTP request to external service
     * @llm-rule AVOID: Single attempt - external services can be temporarily unavailable
     */
    private makeHttpRequest;
    /**
     * Execute single HTTP request with timeout
     * @llm-rule WHEN: Making actual HTTP call to external service
     * @llm-rule AVOID: Infinite timeouts - external services should respond quickly
     */
    private executeHttpRequest;
    /**
     * Sleep for specified milliseconds
     * @llm-rule WHEN: Implementing retry delays and exponential backoff
     * @llm-rule AVOID: Busy waiting - proper sleep prevents CPU waste
     */
    private sleep;
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
     */
    shouldLog(level: string, configLevel: string): boolean;
    /**
     * Flush pending logs to HTTP endpoint
     * @llm-rule WHEN: App shutdown or ensuring logs are sent
     * @llm-rule AVOID: Frequent flushing - impacts performance and external service limits
     */
    flush(): Promise<void>;
    /**
     * Close HTTP transport and cleanup resources
     * @llm-rule WHEN: App shutdown or logger cleanup
     * @llm-rule AVOID: Abrupt shutdown - graceful close ensures logs are sent
     */
    close(): Promise<void>;
}
//# sourceMappingURL=http.d.ts.map