/**
 * HTTP transport for external logging services with automatic format detection
 * @module @bloomneo/appkit/logger
 * @file src/logger/transports/http.ts
 *
 * @llm-rule WHEN: Need to send logs to external services like Datadog, Elasticsearch, Splunk
 * @llm-rule AVOID: Manual HTTP setup - auto-detects service format from URL
 * @llm-rule NOTE: Supports Datadog, Elasticsearch, Splunk with automatic format conversion
 */
import https from 'https';
import http from 'http';
/**
 * HTTP transport with automatic service detection and format optimization
 */
export class HttpTransport {
    url;
    batchSize;
    timeout;
    minimal;
    // HTTP state
    batch = [];
    flushTimer = null;
    parsedUrl;
    serviceType;
    /**
     * Creates HTTP transport with direct environment access (like auth pattern)
     * @llm-rule WHEN: Logger initialization with VOILA_LOGGING_HTTP_URL environment variable
     * @llm-rule AVOID: Manual HTTP configuration - environment detection handles this
     * @llm-rule NOTE: Auto-detects service type from URL and formats payloads accordingly
     */
    constructor(config) {
        // Direct access to config (like auth module pattern)
        this.url = config.http.url;
        this.batchSize = config.http.batchSize;
        this.timeout = config.http.timeout;
        this.minimal = config.minimal;
        this.parsedUrl = new URL(this.url);
        this.serviceType = this.detectServiceType();
        // Initialize HTTP transport
        this.setupBatchFlush();
    }
    /**
     * Detect external service type from URL for format optimization
     * @llm-rule WHEN: Determining payload format based on service provider
     * @llm-rule AVOID: Manual service configuration - URL detection is automatic
     */
    detectServiceType() {
        const hostname = this.parsedUrl.hostname.toLowerCase();
        const pathname = this.parsedUrl.pathname;
        if (hostname.includes('datadog'))
            return 'datadog';
        if (hostname.includes('elastic') || pathname.includes('_bulk'))
            return 'elasticsearch';
        if (hostname.includes('splunk'))
            return 'splunk';
        return 'generic';
    }
    /**
     * Write log entry to HTTP endpoint via batching
     * @llm-rule WHEN: Sending logs to external monitoring services
     * @llm-rule AVOID: Calling directly - logger routes entries automatically
     */
    write(entry) {
        try {
            // Optimize entry based on scope and service type
            const optimizedEntry = this.optimizeEntry(entry);
            // Add to batch
            this.batch.push(optimizedEntry);
            // Flush if batch is full
            if (this.batch.length >= this.batchSize) {
                this.flushBatch();
            }
        }
        catch (error) {
            console.error('HTTP transport write error:', error.message);
        }
    }
    /**
     * Optimize log entry for HTTP transmission
     * @llm-rule WHEN: Reducing payload size and optimizing for external services
     * @llm-rule AVOID: Always sending full entries - minimal scope reduces bandwidth
     */
    optimizeEntry(entry) {
        if (!this.minimal) {
            return entry; // Full scope - keep everything
        }
        // Minimal scope optimization for HTTP transmission
        const { timestamp, level, message, component, requestId, userId, method, url, statusCode, durationMs, error, service, version, environment, ...rest } = entry;
        const minimal = {
            timestamp,
            level,
            message,
        };
        // Add essential context for external monitoring
        if (component)
            minimal.component = component;
        if (requestId)
            minimal.requestId = requestId;
        if (userId)
            minimal.userId = userId;
        // Add HTTP context (important for APM)
        if (method)
            minimal.method = method;
        if (url)
            minimal.url = url;
        if (statusCode)
            minimal.statusCode = statusCode;
        if (durationMs)
            minimal.durationMs = durationMs;
        // Add service identification
        if (service)
            minimal.service = service;
        if (version)
            minimal.version = version;
        if (environment)
            minimal.environment = environment;
        // Optimize error information for monitoring
        if (error) {
            minimal.error = this.optimizeError(error);
        }
        // Add essential metadata for correlation
        const essentialMeta = this.filterEssentialMeta(rest);
        if (Object.keys(essentialMeta).length > 0) {
            minimal.meta = essentialMeta;
        }
        return minimal;
    }
    /**
     * Optimize error object for HTTP transmission
     * @llm-rule WHEN: Sending error data to external monitoring services
     * @llm-rule AVOID: Including stack traces - security risk and bandwidth waste
     */
    optimizeError(error) {
        if (typeof error === 'string') {
            return error;
        }
        if (typeof error === 'object' && error !== null) {
            const optimized = {
                message: error.message,
            };
            // Add important error fields for monitoring
            if (error.name && error.name !== 'Error') {
                optimized.name = error.name;
            }
            if (error.code) {
                optimized.code = error.code;
            }
            if (error.statusCode) {
                optimized.statusCode = error.statusCode;
            }
            // Never include stack traces in HTTP transmissions (security)
            return optimized;
        }
        return error;
    }
    /**
     * Filter metadata for essential monitoring fields
     * @llm-rule WHEN: Keeping HTTP payload size manageable while preserving correlation
     * @llm-rule AVOID: Sending all metadata - focus on monitoring and correlation fields
     */
    filterEssentialMeta(meta) {
        const essential = {};
        // Essential monitoring and correlation fields
        const essentialKeys = [
            'traceId', 'spanId', 'sessionId', 'tenantId', 'appName', 'ip'
        ];
        for (const key of essentialKeys) {
            if (meta[key] !== undefined) {
                essential[key] = meta[key];
            }
        }
        // Include correlation IDs
        for (const [key, value] of Object.entries(meta)) {
            if (key.endsWith('Id') && !essential[key]) {
                essential[key] = value;
            }
        }
        return essential;
    }
    /**
     * Setup automatic batch flushing
     * @llm-rule WHEN: Transport initialization - ensures logs are sent regularly
     * @llm-rule AVOID: Manual flushing - automatic batching optimizes HTTP requests
     */
    setupBatchFlush() {
        this.flushTimer = setInterval(() => {
            if (this.batch.length > 0) {
                this.flushBatch();
            }
        }, 10000); // Flush every 10 seconds
    }
    /**
     * Flush current batch to HTTP endpoint
     * @llm-rule WHEN: Batch is full or timer triggers
     * @llm-rule AVOID: Individual HTTP requests - batching reduces overhead significantly
     */
    async flushBatch() {
        if (this.batch.length === 0) {
            return;
        }
        const currentBatch = [...this.batch];
        this.batch = [];
        try {
            await this.sendBatch(currentBatch);
        }
        catch (error) {
            console.error('HTTP batch flush failed:', error.message);
            // Re-add failed entries for retry (up to batch size limit)
            const retryEntries = currentBatch.slice(0, this.batchSize);
            this.batch.unshift(...retryEntries);
        }
    }
    /**
     * Send batch of log entries via HTTP
     * @llm-rule WHEN: Transmitting batched logs to external service
     * @llm-rule AVOID: Custom formatting - service detection handles optimal format
     */
    async sendBatch(entries) {
        if (entries.length === 0)
            return;
        const payload = this.formatPayload(entries);
        await this.makeHttpRequest(payload);
    }
    /**
     * Format log entries for specific external services
     * @llm-rule WHEN: Converting logs to service-specific format for optimal ingestion
     * @llm-rule AVOID: Generic format for known services - optimized formats work better
     */
    formatPayload(entries) {
        switch (this.serviceType) {
            case 'datadog':
                return JSON.stringify({
                    logs: entries.map(entry => ({
                        timestamp: entry.timestamp,
                        level: entry.level,
                        message: entry.message,
                        attributes: this.extractDatadogAttributes(entry),
                    })),
                });
            case 'elasticsearch':
                // Elasticsearch bulk format
                return entries
                    .map(entry => {
                    const indexMeta = JSON.stringify({ index: {} });
                    const logData = JSON.stringify(entry);
                    return indexMeta + '\n' + logData;
                })
                    .join('\n') + '\n';
            case 'splunk':
                return entries
                    .map(entry => JSON.stringify({
                    time: new Date(entry.timestamp).getTime() / 1000,
                    event: entry,
                }))
                    .join('\n');
            case 'generic':
            default:
                // Generic format with metadata
                return JSON.stringify({
                    logs: entries,
                    scope: this.minimal ? 'minimal' : 'full',
                    count: entries.length,
                    service: entries[0]?.service || 'unknown',
                });
        }
    }
    /**
     * Extract Datadog-specific attributes from log entry
     * @llm-rule WHEN: Formatting logs for Datadog ingestion
     * @llm-rule AVOID: Sending raw entry - Datadog expects specific attribute structure
     */
    extractDatadogAttributes(entry) {
        const { timestamp, level, message, ...attributes } = entry;
        return {
            service: attributes.service || 'unknown',
            component: attributes.component,
            requestId: attributes.requestId,
            userId: attributes.userId,
            method: attributes.method,
            url: attributes.url,
            statusCode: attributes.statusCode,
            durationMs: attributes.durationMs,
            environment: attributes.environment,
            version: attributes.version,
            ...attributes.meta,
        };
    }
    /**
     * Make HTTP request with retry logic and exponential backoff
     * @llm-rule WHEN: Sending HTTP request to external service
     * @llm-rule AVOID: Single attempt - external services can be temporarily unavailable
     */
    async makeHttpRequest(payload) {
        const maxRetries = 3;
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.executeHttpRequest(payload);
                return; // Success
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
                    console.warn(`HTTP request attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
                    await this.sleep(delay);
                }
            }
        }
        throw lastError;
    }
    /**
     * Execute single HTTP request with timeout
     * @llm-rule WHEN: Making actual HTTP call to external service
     * @llm-rule AVOID: Infinite timeouts - external services should respond quickly
     */
    executeHttpRequest(payload) {
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
                timeout: this.timeout,
            };
            const req = httpModule.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    }
                    else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`HTTP request timeout after ${this.timeout}ms`));
            });
            req.on('error', (error) => {
                reject(new Error(`HTTP request failed: ${error.message}`));
            });
            // Write payload and end request
            req.write(payload);
            req.end();
        });
    }
    /**
     * Sleep for specified milliseconds
     * @llm-rule WHEN: Implementing retry delays and exponential backoff
     * @llm-rule AVOID: Busy waiting - proper sleep prevents CPU waste
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Check if this transport should log the given level
     * @llm-rule WHEN: Logger asks if transport handles this level
     * @llm-rule AVOID: Complex level logic - simple comparison is sufficient
     */
    shouldLog(level, configLevel) {
        const levels = {
            error: 0, warn: 1, info: 2, debug: 3
        };
        return levels[level] <= levels[configLevel];
    }
    /**
     * Flush pending logs to HTTP endpoint
     * @llm-rule WHEN: App shutdown or ensuring logs are sent
     * @llm-rule AVOID: Frequent flushing - impacts performance and external service limits
     */
    async flush() {
        await this.flushBatch();
    }
    /**
     * Close HTTP transport and cleanup resources
     * @llm-rule WHEN: App shutdown or logger cleanup
     * @llm-rule AVOID: Abrupt shutdown - graceful close ensures logs are sent
     */
    async close() {
        // Clear flush timer
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        // Flush remaining logs
        await this.flushBatch();
    }
}
//# sourceMappingURL=http.js.map