# @bloomneo/appkit - Config Module ⚙️

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple, convention-driven configuration management that just works

**One function** returns a config object with automatic environment variable
parsing. Zero configuration files needed, production-ready validation by
default, with built-in type conversion and smart defaults.

## 🚀 Why Choose This?

- **⚡ One Function** - Just `configClass.get()`, everything else is automatic
- **🔩 UPPER_SNAKE_CASE Convention** - `DATABASE_HOST` becomes
  `config.get('database.host')`
- **🔧 Zero Configuration** - No config files, no setup, just environment
  variables
- **🛡️ Type-Safe** - Automatic conversion: `"true"` → `true`, `"123"` → `123`
- **🌍 Environment-First** - Perfect compatibility with Docker, Vercel, Railway,
  etc.
- **🔍 Production Validation** - Validates critical config at startup
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

### 1. Set Environment Variables

```bash
# Database settings
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret

# Feature flags
FEATURES_BETA_ENABLED=true
FEATURES_UPLOADS_MAX=100

# API settings
API_BASE_URL=https://api.example.com
API_TIMEOUT=30000
API_RATE_LIMIT=1000
```

### 2. Use in Your Code

```typescript
import { configClass } from '@bloomneo/appkit/config';

const config = configClass.get();

// Access nested values with dot notation (all properly typed!)
const dbHost = config.get('database.host'); // 'localhost'
const dbPort = config.get('database.port'); // 5432 (number!)
const dbUser = config.get('database.credentials.user'); // 'admin'
const isBeta = config.get('features.beta.enabled'); // true (boolean!)
const maxUploads = config.get('features.uploads.max'); // 100 (number!)

// Get with defaults
const timeout = config.get('redis.timeout', 5000); // 5000 if not set
const retries = config.get('api.retries', 3); // 3 if not set

// Check if config exists
if (config.has('features.beta.enabled')) {
  console.log('Beta features are configured');
}

console.log(`Connecting to ${dbUser}@${dbHost}:${dbPort}`);
```

**That's it!** All your environment variables are available in a clean,
structured, and type-safe object.

## 🧠 Mental Model

### **The UPPER_SNAKE_CASE Convention**

Single underscores create nesting:

```bash
# Environment Variable → Config Path
DATABASE_HOST=localhost                     → config.get('database.host')
DATABASE_CONNECTION_POOL_SIZE=10           → config.get('database.connection.pool.size')
STRIPE_API_KEYS_PUBLIC=pk_test_123         → config.get('stripe.api.keys.public')
FEATURES_ANALYTICS_ENABLED=true           → config.get('features.analytics.enabled')
```

### **Framework vs Application Variables**

```bash
# 🔧 Framework Configuration (BLOOM_* prefix)
BLOOM_AUTH_SECRET=jwt-secret-key           # AppKit auth module
BLOOM_ERROR_STACK=false                    # AppKit error module
BLOOM_SERVICE_NAME=my-app                  # AppKit service identification

# 🎯 Application Configuration (everything else)
DATABASE_HOST=localhost                    # Your database connection
API_TIMEOUT=5000                          # Your API client settings
FEATURES_BETA_ENABLED=true               # Your feature flags
```

### **Automatic Type Conversion**

No manual parsing needed:

```bash
# String values
API_BASE_URL=https://api.com              → "https://api.com"

# Number values
DATABASE_PORT=5432                        → 5432
API_TIMEOUT=30000                         → 30000

# Boolean values
FEATURES_ENABLE_BETA=true                 → true
DEBUG_VERBOSE=false                       → false

# Special handling
USER_ID=0123456789                        → "0123456789" (keeps leading zero)
```

## 🤖 LLM Quick Reference - Copy These Patterns

### **Environment Variable Setup (Copy Exactly)**

```bash
# ✅ CORRECT - Framework variables
BLOOM_AUTH_SECRET=your-secret-key
BLOOM_SERVICE_NAME=my-app
NODE_ENV=production

# ✅ CORRECT - Application variables
DATABASE_HOST=localhost
DATABASE_PORT=5432
REDIS_URL=redis://localhost:6379
FEATURES_ANALYTICS_ENABLED=true
API_TIMEOUT=30000
```

### **Configuration Access (Copy These Patterns)**

```typescript
// ✅ CORRECT - Basic access with defaults
const config = configClass.get();
const dbHost = config.get('database.host', 'localhost');
const dbPort = config.get<number>('database.port', 5432);
const isEnabled = config.get<boolean>('features.analytics.enabled', false);

// ✅ CORRECT - Required configuration
const apiKey = config.getRequired<string>('api.key');
const dbUrl = config.getRequired<string>('database.url');

// ✅ CORRECT - Environment checks
if (configClass.isProduction()) {
  // Production-specific code
}

// ✅ CORRECT - Module configuration
const dbConfig = configClass.getModuleConfig('database', {
  host: 'localhost',
  port: 5432,
});
```

### **Startup Validation (Copy This Pattern)**

```typescript
// ✅ CORRECT - App startup validation
try {
  const config = configClass.get();

  // Validate required configuration
  configClass.validateRequired(['database.url', 'api.key']);

  console.log('✅ Configuration validation passed');
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Wrong Environment Variable Format**

```bash
# ❌ WRONG - Mixed conventions
database-host=localhost                    # Use underscores, not dashes
DATABASE__HOST=localhost                   # Don't use double underscores
database_host=localhost                    # Must be uppercase

# ✅ CORRECT - Use UPPER_SNAKE_CASE
DATABASE_HOST=localhost
```

### **Wrong Configuration Access**

```typescript
// ❌ WRONG - Direct process.env access
const dbHost = process.env.DATABASE_HOST;
const port = parseInt(process.env.DATABASE_PORT || '5432');

// ✅ CORRECT - Use config system
const config = configClass.get();
const dbHost = config.get('database.host');
const port = config.get<number>('database.port', 5432);
```

### **Wrong Required Configuration Handling**

```typescript
// ❌ WRONG - Manual fallbacks for critical config
const apiKey = config.get('api.key') || 'fallback-key';
const dbUrl = config.get('database.url') || 'postgres://localhost/db';

// ✅ CORRECT - Use getRequired for critical config
const apiKey = config.getRequired<string>('api.key');
const dbUrl = config.getRequired<string>('database.url');
```

## 🚨 Error Handling Patterns

### **Startup Validation**

```typescript
import { configClass } from '@bloomneo/appkit/config';

// App startup validation
async function validateAppConfig() {
  try {
    const config = configClass.get();

    // Validate required configuration
    configClass.validateRequired(['database.url', 'redis.url', 'api.key']);

    // Production-specific validation
    if (configClass.isProduction()) {
      configClass.validateRequired([
        'monitoring.sentry.dsn',
        'email.smtp.host',
      ]);
    }

    console.log('✅ Configuration validation passed');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
  }
}

// Call at app startup
validateAppConfig();
```

### **Runtime Configuration Access**

```typescript
// Safe configuration access with error handling
function getDatabaseConfig() {
  const config = configClass.get();

  try {
    return {
      host: config.getRequired<string>('database.host'),
      port: config.get<number>('database.port', 5432),
      ssl: config.get<boolean>('database.ssl.enabled', false),
    };
  } catch (error) {
    throw new Error(`Database configuration error: ${error.message}`);
  }
}
```

## 🌍 Environment Variables

```bash
# Framework variables (handled by Bloomneo internally)
BLOOM_AUTH_SECRET=your-super-secure-jwt-secret-key
BLOOM_SERVICE_NAME=my-awesome-app
BLOOM_ERROR_STACK=false

# Application variables (your configuration)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL_ENABLED=true

REDIS_URL=redis://localhost:6379
REDIS_TTL=3600
REDIS_MAX_RETRIES=3

STRIPE_API_KEYS_SECRET=sk_live_...
STRIPE_API_KEYS_PUBLIC=pk_live_...

FEATURES_ANALYTICS_ENABLED=true
FEATURES_BETA_UI_ENABLED=false
FEATURES_AI_SEARCH_ENABLED=true

API_BASE_URL=https://api.example.com
API_TIMEOUT=30000
API_RATE_LIMIT=1000
```

## 📖 Complete API Reference

### **Core Function**

```typescript
const config = configClass.get(); // One function, all methods
```

### **Configuration Access Methods**

```typescript
// Get value with optional default
config.get<string>('database.host', 'localhost');
config.get<number>('database.port', 5432);
config.get<boolean>('features.beta.enabled', false);

// Get required value (throws if missing)
config.getRequired<string>('database.url');

// Check if config exists
config.has('features.beta.enabled'); // true/false

// Get multiple related values
config.getMany({
  host: 'database.host',
  port: 'database.port',
  user: 'database.credentials.user',
}); // { host: '...', port: 5432, user: '...' }

// Get entire config (for debugging)
config.getAll(); // Complete config object
```

### **Environment Helper Methods**

```typescript
// Environment detection
configClass.isDevelopment(); // NODE_ENV === 'development'
configClass.isProduction(); // NODE_ENV === 'production'
configClass.isTest(); // NODE_ENV === 'test'
configClass.getEnvironment(); // Current NODE_ENV value

// Module-specific configuration
configClass.getModuleConfig('database', {
  host: 'localhost',
  port: 5432,
}); // Gets all 'database.*' config with defaults

// Startup validation
configClass.validateRequired(['database.url', 'api.key']); // Throws with helpful errors if missing
```

### **Utility Methods**

```typescript
// Get all non-framework environment variables
configClass.getEnvVars(); // { DATABASE_HOST: 'localhost', ... }

// Reset for testing
configClass.reset(customConfig); // Reset with custom config
configClass.reset(); // Rebuild config from current process.env
```

## 🎯 Usage Examples

### **Express Server Configuration**

```typescript
import express from 'express';
import { configClass } from '@bloomneo/appkit/config';

const config = configClass.get();

const app = express();

// Get server configuration
const port = config.get('server.port', 3000);
const host = config.get('server.host', '0.0.0.0');
const cors = config.get('server.cors.enabled', true);

// Database configuration
const dbConfig = config.getMany({
  host: 'database.host',
  port: 'database.port',
  name: 'database.name',
  user: 'database.credentials.user',
  password: 'database.credentials.password',
});

console.log(`Server starting on ${host}:${port}`);
console.log(
  `Database: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`
);

app.listen(port, host);
```

**Environment Variables:**

```bash
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
SERVER_CORS_ENABLED=true
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
```

### **Module-Specific Configuration**

```typescript
// Database module
class DatabaseService {
  constructor() {
    const config = configClass.get();

    // Get all database config with defaults
    this.config = configClass.getModuleConfig('database', {
      host: 'localhost',
      port: 5432,
      pool: { min: 2, max: 10 },
      ssl: false,
    });

    // Validate required values
    configClass.validateRequired([
      'database.credentials.user',
      'database.credentials.password',
    ]);
  }

  connect() {
    const { host, port, credentials, ssl } = this.config;
    console.log(
      `Connecting to ${credentials.user}@${host}:${port} (SSL: ${ssl})`
    );
  }
}
```

**Environment Variables:**

```bash
DATABASE_HOST=db.example.com
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=app_user
DATABASE_CREDENTIALS_PASSWORD=secure_password
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true
```

## 🚀 Production Deployment

### **Environment Configuration**

```bash
# ✅ Framework variables
BLOOM_SERVICE_NAME=my-production-app
NODE_ENV=production

# ✅ Application variables
DATABASE_HOST=prod-db.example.com
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=prod_user
DATABASE_CREDENTIALS_PASSWORD=secure_prod_password
DATABASE_SSL_ENABLED=true

REDIS_URL=redis://prod-redis.example.com:6379
API_TIMEOUT=30000
FEATURES_ANALYTICS_ENABLED=true
```

### **Docker Setup**

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["npm", "start"]
```

```bash
# Docker run with environment variables
docker run -d \
  -e NODE_ENV=production \
  -e BLOOM_SERVICE_NAME=my-app \
  -e DATABASE_HOST=postgres.internal \
  -e DATABASE_PORT=5432 \
  -e DATABASE_CREDENTIALS_USER=app_user \
  -e DATABASE_CREDENTIALS_PASSWORD=secure_pass \
  -e REDIS_URL=redis://redis.internal:6379 \
  -e FEATURES_ANALYTICS_ENABLED=true \
  my-app:latest
```

## 🧪 Testing

```typescript
import { configClass } from '@bloomneo/appkit/config';

describe('Configuration Tests', () => {
  beforeEach(() => {
    // Rebuild config from the current process.env for each test
    configClass.reset();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.TEST_CONFIG_VALUE;
  });

  test('should parse environment variables correctly', () => {
    // Set test environment variables
    process.env.TEST_CONFIG_VALUE = 'test-value';
    process.env.TEST_CONFIG_NUMBER = '123';
    process.env.TEST_CONFIG_BOOLEAN = 'true';

    const config = configClass.get();

    expect(config.get('test.config.value')).toBe('test-value');
    expect(config.get('test.config.number')).toBe(123);
    expect(config.get('test.config.boolean')).toBe(true);
  });

  test('should use defaults when environment variables are missing', () => {
    const config = configClass.get();

    expect(config.get('missing.value', 'default')).toBe('default');
    expect(config.get('missing.number', 42)).toBe(42);
  });

  test('should validate required configuration', () => {
    expect(() => {
      configClass.validateRequired(['missing.required.value']);
    }).toThrow('Missing required configuration');
  });
});
```

## 📈 Performance

- **Environment Parsing**: Once per application startup (~2ms)
- **Configuration Access**: ~0.01ms per `get()` call
- **Memory Usage**: <500KB overhead
- **Type Conversion**: Cached after first access
- **Validation**: Only runs during startup

## 🔍 TypeScript Support

Full TypeScript support with comprehensive interfaces:

```typescript
import type { ConfigValue, AppConfig } from '@bloomneo/appkit/config';

// Strongly typed configuration access
const config = configClass.get();
const dbPort: number = config.get<number>('database.port', 5432);
const features: boolean = config.get<boolean>('features.enabled', false);

// Custom configuration interfaces
interface DatabaseConfig {
  host: string;
  port: number;
  credentials: {
    user: string;
    password: string;
  };
}

const dbConfig: DatabaseConfig = configClass.getModuleConfig('database');
```

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>

---

## Agent-Dev Friendliness Score

**Score: 75/100 — 🟡 Solid** *(no cap)* · **Δ +7 vs 2026-04-13 (68)**
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../AGENT_DEV_SCORING_ALGORITHM.md) v1.1*

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **9** | All 15 public methods exist on the runtime surface and match every doc reference. README, `examples/config.ts`, `llms.txt`, and `AGENTS.md` all use `configClass.*` vs instance-`.` splits correctly. `config.test.ts` drift-check enforces the `NOT_ON_INSTANCE` + `HALLUCINATED_CLASS_METHODS` contracts. Only residual: none observed. |
| 2 | Doc consistency | **8** | README, examples, llms.txt, and AGENTS.md all agree on method locations and signatures. `getMany({ [K]: string }) → object` form is uniform across llms.txt + README + examples today. Still no explicit "class helpers vs instance methods" cheat-sheet at top of README. |
| 3 | Runtime verification | **9** | `config.test.ts` drift-checks 9 class methods + 5 instance methods, asserts `NOT_ON_INSTANCE` for `isDevelopment`/`isProduction`/`isTest`/`getNumber`/`getBoolean`, and traps `clearCache` as hallucinated. `examples/config.ts` was runtime-verified today end-to-end. |
| 4 | Type safety | **7** | `get<T>(path, defaultValue): T` overload is tight; `getMany` generic `{ [K in keyof T]: string } → T` propagates keys correctly. `AppConfig` still has `[key: string]: any` and `get<T = any>(path)` defaults to `any` — callers cast at the site. |
| 5 | Discoverability | **8** | README hero is a working 30-second copy-paste. Canonical import `from '@bloomneo/appkit/config'` matches every other artifact. No pointer to AGENTS.md / llms.txt / examples from the opening section. |
| 6 | Example completeness | **8** | Fresh `examples/config.ts` (runtime-verified today) covers `get`, `getRequired`, `getMany`, `has`, `getEnvironment`, `isDevelopment`, `isProduction`, `isTest`, `validateRequired`, `getModuleConfig` — 10 of 13. Still missing: `getAll`, `getEnvVars`, `reset`. |
| 7 | Composability | **5** | None of the 5 cookbook recipes (`api-key-service`, `auth-protected-crud`, `file-upload-pipeline`, `multi-tenant-saas`, `real-time-chat`) import `configClass`. Config is assumed implicitly via `process.env`-adjacent setup; no recipe demonstrates `validateRequired` + `getModuleConfig` wiring. |
| 8 | Educational errors | **9** | `getRequired()` throws `[@bloomneo/appkit/config] Missing required configuration: "${path}". Set environment variable: ${ENV_VAR}. See: ${DOCS_URL}#startup-validation` — names module, missing thing, env var, and docs link. `validateRequired()` lists all missing paths + env vars in one message. `get()` overrides-after-first-call throws a similarly-structured error. |
| 9 | Convention enforcement | **7** | Exactly one canonical way to read config (`configClass.get()` → `config.get('path', default)`). The two-tier surface is the structural cost but there is only one path per task. Alternatives (`process.env`) are explicitly flagged as wrong in the "Common LLM Mistakes" section. |
| 10 | Drift prevention | **7** | `config.test.ts` drift-check tests both class and instance surfaces and includes a forward-looking `HALLUCINATED_CLASS_METHODS` trap (`clearCache`). Runs under `vitest` but no dedicated CI gate file is checked in. |
| 11 | Reading order | **5** | README is well-structured internally but still has no links to `AGENTS.md`, `llms.txt`, or `examples/config.ts` from its opening section. A reader landing here has to leave the file to find the rules/reference layer. |
| **12** | **Simplicity** | **5** | 15 public methods across two tiers (`configClass.*` class helpers + `config.*` value access). The two-tier surface is the core complexity tax; 80% case is the 2-call chain `configClass.get()` → `config.get('path', default)`. "Where does `isDevelopment()` live?" remains a repeated trip-wire without a header callout. |
| **13** | **Clarity** | **9** | Every public name reads as a sentence: `getRequired`, `getModuleConfig`, `validateRequired`, `isDevelopment`, `isProduction`, `isTest`, `getEnvVars`. Zero vague verbs, zero jargon. |
| **14** | **Unambiguity** | **5** | `configClass.get()` and `config.get()` share the verb `get` but return different shapes (ConfigClass instance vs a value). A fresh reader could plausibly write `configClass.get('path')` by mistake; the runtime accepts the call and caches an instance on first use, silently ignoring the argument on subsequent calls. |
| **15** | **Learning curve** | **7** | Hero snippet → working call in under 30 seconds. The single learning bump is internalizing the two-tier split; once learned it's mechanical. UPPER_SNAKE_CASE → dot.notation convention is clearly documented in the Mental Model section. |

### Weighted (v1.1)

```
(9×.12)+(8×.08)+(9×.09)+(7×.06)+(8×.06)+(8×.08)+(5×.06)+(9×.05)+(7×.05)+(7×.04)+(5×.03)
+(5×.09)+(9×.09)+(5×.05)+(7×.05) = 7.46 → 75/100
```

### Gaps to reach 🟢 85+

1. **D12 Simplicity → 8**: Add a prominent "Two-tier cheat sheet" table at the top of README — `configClass.*` (class helpers) vs `config.*` (value access) — to flatten the mental model onto one screen.
2. **D7 Composability → 8**: Wire `configClass.validateRequired(...)` + `configClass.getModuleConfig(...)` into at least one cookbook recipe (e.g. `auth-protected-crud.ts`) to demonstrate the canonical startup sequence.
3. **D11 Reading order → 8**: Add "See also" links to `AGENTS.md`, `llms.txt`, and `examples/config.ts` in the opening section of this README.
4. **D14 Unambiguity → 8**: Rename `configClass.get()` → `configClass.load()` (or `.parse()`) so the two `get` methods no longer share a verb. API-breaking; slot for v1.
5. **D6 Example completeness → 10**: Append `getAll()`, `getEnvVars()`, and `reset(customConfig)` demos to `examples/config.ts`.

**Realistic ceiling:** ~85/100 with fixes 1-3 and 5 (all non-breaking). Reaching 90+ requires fix 4, which removes the shared-name ambiguity at the cost of a major version bump.
