# @bloomneo/appkit - Email Module 📧

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple email sending that just works - One function, automatic provider
> detection, zero configuration

**One function** returns an email object with automatic strategy selection. Zero
configuration needed, production-ready sending by default, with built-in
template system and development preview.

## 🚀 Why Choose This?

- **⚡ One Function** - Just `emailClass.get()`, everything else is automatic
- **🎯 Auto-Strategy** - RESEND_API_KEY = Resend, SMTP_HOST = SMTP, default =
  Console
- **🔧 Zero Configuration** - Smart defaults for everything
- **📄 Built-in Templates** - Welcome, reset password templates included
- **🎨 Development Preview** - See emails in console with beautiful formatting
- **🛡️ Production Ready** - Retry logic, error handling, graceful shutdown
- **🤖 AI-Ready** - Optimized for LLM code generation

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

### 1. Basic Setup (Console Preview)

```typescript
import { emailClass } from '@bloomneo/appkit/email';

const email = emailClass.get();

// Send email (shows in console during development)
await email.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  text: 'Hello world!',
});

// Even simpler
await emailClass.sendText('user@example.com', 'Hi', 'Hello!');
```

### 2. Production Setup (Resend)

```bash
# Just set API key - automatic Resend strategy
export RESEND_API_KEY=re_your_api_key_here
```

```typescript
import { emailClass } from '@bloomneo/appkit/email';

// Same code, now sends real emails!
await emailClass.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello!</h1><p>Welcome to our app!</p>',
});
```

**That's it!** No configuration, no setup, just works everywhere.

## 🧠 Mental Model

### **Automatic Strategy Selection**

The email module **automatically detects** what you need:

| Environment Variable       | Strategy | Use Case                           |
| -------------------------- | -------- | ---------------------------------- |
| `RESEND_API_KEY=re_...`    | Resend   | Modern production (recommended)    |
| `SMTP_HOST=smtp.gmail.com` | SMTP     | Universal (Gmail, Outlook, custom) |
| _No email env vars_        | Console  | Development (shows in terminal)    |

### **Development → Production**

```typescript
// Same code works everywhere
await emailClass.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  text: 'Hello!',
});

// Development: Beautiful console preview
// Production: Real email via Resend/SMTP
```

## 📖 Complete API

### Core Function

```typescript
const email = emailClass.get(); // One function, everything you need
```

### Email Operations

```typescript
// Full email
await email.send({
  to: 'user@example.com',
  subject: 'Subject',
  text: 'Plain text',
  html: '<h1>HTML content</h1>',
});

// Simple text
await email.sendText('user@example.com', 'Subject', 'Text');

// HTML email
await email.sendHtml('user@example.com', 'Subject', '<h1>HTML</h1>');

// Template email
await email.sendTemplate('welcome', {
  to: 'user@example.com',
  name: 'John',
  appName: 'MyApp',
});

// Batch emails
await email.sendBatch([email1, email2, email3]);
```

### Utility Methods

```typescript
// Debugging
email.getStrategy(); // 'resend', 'smtp', or 'console'
emailClass.hasResend(); // true if RESEND_API_KEY set
emailClass.hasSmtp(); // true if SMTP_HOST set

// Convenience
await emailClass.send(emailData); // Direct send without get()
```

## 💡 Simple Examples

### **User Registration Email**

```typescript
import { emailClass } from '@bloomneo/appkit/email';

async function sendWelcomeEmail(user) {
  await emailClass.send({
    to: user.email,
    subject: `Welcome to ${process.env.APP_NAME}!`,
    html: `
      <h1>Welcome ${user.name}!</h1>
      <p>Thanks for joining us. We're excited to have you!</p>
      <a href="${process.env.APP_URL}/dashboard">Get Started</a>
    `,
    text: `Welcome ${user.name}! Thanks for joining us. Visit ${process.env.APP_URL}/dashboard to get started.`,
  });
}
```

### **Password Reset**

```typescript
import { emailClass } from '@bloomneo/appkit/email';

async function sendPasswordReset(user, resetToken) {
  const resetUrl = `${process.env.APP_URL}/reset?token=${resetToken}`;

  await emailClass.send({
    to: user.email,
    subject: 'Reset your password',
    html: `
      <h2>Reset your password</h2>
      <p>Hi ${user.name},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl} (expires in 1 hour)`,
  });
}
```

### **Order Confirmation**

```typescript
import { emailClass } from '@bloomneo/appkit/email';

async function sendOrderConfirmation(order) {
  await emailClass.send({
    to: order.customerEmail,
    subject: `Order Confirmation #${order.id}`,
    html: `
      <h1>Order Confirmed!</h1>
      <p>Thanks for your order, ${order.customerName}!</p>
      <h3>Order Details:</h3>
      <ul>
        ${order.items.map((item) => `<li>${item.name} x${item.quantity} - $${item.price}</li>`).join('')}
      </ul>
      <p><strong>Total: $${order.total}</strong></p>
      <p>We'll send you tracking information when your order ships.</p>
    `,
  });
}
```

### **Built-in Templates**

```typescript
import { emailClass } from '@bloomneo/appkit/email';

// Welcome template
await emailClass.get().sendTemplate('welcome', {
  to: 'user@example.com',
  name: 'John',
  appName: 'MyApp',
});

// Password reset template
await emailClass.get().sendTemplate('reset', {
  to: 'user@example.com',
  name: 'John',
  resetUrl: 'https://myapp.com/reset?token=abc123',
  appName: 'MyApp',
});
```

## 🧪 Testing

```typescript
import { emailClass } from '@bloomneo/appkit/email';

describe('Email Tests', () => {
  afterEach(async () => {
    await emailClass.clear(); // Clean up between tests
  });

  test('should send email', async () => {
    // Force console strategy for tests
    await emailClass.reset({
      strategy: 'console',
      from: { name: 'Test App', email: 'test@example.com' },
    });

    const result = await emailClass.send({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Test message',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});
```

## ⚠️ Common Mistakes

### **1. Missing Required Fields**

```typescript
// ❌ DON'T forget subject or content
await emailClass.send({
  to: 'user@example.com',
  // Missing subject and content!
});

// ✅ DO include all required fields
await emailClass.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  text: 'Welcome to our app!',
});
```

### **2. Console Strategy in Production**

```typescript
// ❌ DON'T rely on console strategy in production
// This only logs emails, doesn't send them!
process.env.NODE_ENV = 'production';
// No RESEND_API_KEY or SMTP_HOST set
await emailClass.send(emailData); // Only logs to console!

// ✅ DO set up a real email provider
process.env.RESEND_API_KEY = 're_your_api_key';
await emailClass.send(emailData); // Actually sends emails
```

### **3. Ignoring Send Results**

```typescript
// ❌ DON'T ignore send results
await emailClass.send(emailData); // What if it failed?

// ✅ DO check for success/failure
const result = await emailClass.send(emailData);
if (!result.success) {
  console.error('Email failed:', result.error);
  // Handle failure appropriately
}
```

### **4. Invalid Email Addresses**

```typescript
// ❌ DON'T use invalid email formats
await emailClass.send({
  to: 'not-an-email', // Invalid format
  subject: 'Test',
  text: 'Hello',
});

// ✅ DO validate email addresses
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
if (!isValidEmail(user.email)) {
  throw new Error('Invalid email address');
}
```

### **5. Unverified FROM Addresses**

```typescript
// ❌ DON'T use unverified FROM addresses with Resend
await emailClass.send({
  from: 'random@example.com', // Unverified domain
  to: 'user@example.com',
  subject: 'Test',
  text: 'Hello',
});

// ✅ DO configure verified FROM address
process.env.BLOOM_EMAIL_FROM_EMAIL = 'noreply@yourdomain.com'; // Verified
// FROM automatically set from config
```

## 🚨 Error Handling

### **Basic Error Handling**

```typescript
async function sendWelcomeEmail(user) {
  const result = await emailClass.send({
    to: user.email,
    subject: 'Welcome!',
    text: 'Welcome to our app!',
  });

  if (!result.success) {
    console.error('Email failed:', result.error);
    // Don't throw - email failure shouldn't break user registration
    return false;
  }

  console.log('Welcome email sent:', result.messageId);
  return true;
}
```

### **Production Error Handling with Retries**

```typescript
async function sendCriticalEmail(emailData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await emailClass.send(emailData);

    if (result.success) {
      return result;
    }

    // If it's a client error (bad email, invalid data), don't retry
    if (
      result.error?.includes('Invalid email') ||
      result.error?.includes('Bad Request')
    ) {
      throw new Error(`Email validation failed: ${result.error}`);
    }

    // Server errors - retry with exponential backoff
    if (attempt < maxRetries) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(
        `Email attempt ${attempt} failed, retrying in ${delay}ms:`,
        result.error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Email failed after ${maxRetries} attempts`);
}
```

### **Strategy-Specific Error Handling**

```typescript
async function sendEmailWithContext(emailData) {
  const strategy = emailClass.getStrategy();
  const result = await emailClass.send(emailData);

  if (!result.success) {
    // Handle strategy-specific errors
    switch (strategy) {
      case 'resend':
        if (result.error?.includes('API key')) {
          throw new Error('Resend API key invalid - check RESEND_API_KEY');
        }
        if (result.error?.includes('domain')) {
          throw new Error('Email domain not verified in Resend');
        }
        break;

      case 'smtp':
        if (result.error?.includes('authentication')) {
          throw new Error(
            'SMTP authentication failed - check SMTP_USER/SMTP_PASS'
          );
        }
        if (result.error?.includes('connection')) {
          throw new Error('SMTP connection failed - check SMTP_HOST/SMTP_PORT');
        }
        break;

      case 'console':
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            'Using console strategy in production - emails not actually sent'
          );
        }
        break;
    }

    throw new Error(`Email send failed: ${result.error}`);
  }

  return result;
}
```

## 🔧 Startup Validation

### **Basic App Startup Validation**

```typescript
import { emailClass } from '@bloomneo/appkit/email';

async function startApp() {
  // validateConfig() RETURNS a report — it does not throw.
  // Inspect `errors` yourself and decide whether to proceed.
  const report = emailClass.validateConfig();

  if (!report.valid) {
    console.error('❌ Email configuration errors:', report.errors);
    process.exit(1);
  }

  console.log(`📧 Email configured with ${report.strategy} strategy`);

  app.listen(3000, () => {
    console.log('🚀 Server started on port 3000');
  });
}
```

> 🧩 **`validateConfig()` vs `validateProduction()`.**
> - `validateConfig()` → returns `{ valid, strategy, warnings, errors, ready }`. Never throws. Use for graceful startup checks.
> - `validateProduction()` → throws on missing provider in production. Use at boot for fail-fast deploys.

### **Production Startup Validation**

```typescript
async function validateProductionSetup() {
  if (process.env.NODE_ENV !== 'production') return;

  // Check if real email provider is configured
  if (!emailClass.hasProvider()) {
    throw new Error(
      'No email provider configured in production. ' +
        'Set RESEND_API_KEY or SMTP_HOST environment variable.'
    );
  }

  // Validate FROM address is set
  if (!process.env.BLOOM_EMAIL_FROM_EMAIL) {
    console.warn(
      '⚠️ No FROM email configured. Using default. ' +
        'Set BLOOM_EMAIL_FROM_EMAIL for professional emails.'
    );
  }

  console.log('✅ Email system validated successfully');
}
```

### **Health Check Endpoint**

```typescript
// Express middleware for email health check
function emailHealthCheck(req, res) {
  try {
    const config = emailClass.getConfig();
    const hasProvider = emailClass.hasProvider();

    res.json({
      status: 'ok',
      strategy: config.strategy,
      hasProvider,
      fromEmail: config.fromEmail,
      ready: hasProvider || process.env.NODE_ENV === 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
}

app.get('/health/email', emailHealthCheck);
```

## 🌍 Environment Variables

### **Resend (Recommended)**

```bash
# Modern email service with great deliverability
RESEND_API_KEY=re_your_api_key_here

# Optional: Custom FROM address
BLOOM_EMAIL_FROM_EMAIL=noreply@yourdomain.com
BLOOM_EMAIL_FROM_NAME="Your App Name"
```

### **SMTP (Universal)**

```bash
# Works with Gmail, Outlook, custom servers
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: Security settings
SMTP_SECURE=false  # true for port 465, false for 587
```

### **Console (Development)**

```bash
# No configuration needed!
# Automatically used when no email provider is set

# Optional: Customize console output
BLOOM_EMAIL_CONSOLE_FORMAT=detailed  # or 'simple'
BLOOM_EMAIL_CONSOLE_PREVIEW=true     # Show email content
```

## 🔧 Platform Setup

### **Local Development**

```bash
# No setup needed - beautiful console preview
npm start
```

### **Resend (Recommended)**

1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Set `RESEND_API_KEY=re_your_key`
4. Done! ✅

### **Gmail SMTP**

```bash
# Enable 2FA and create App Password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

### **Outlook/Hotmail SMTP**

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### **Custom SMTP Server**

```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-password
SMTP_SECURE=false
```

## 🚀 Production Deployment

### **Vercel**

```bash
# Add to Vercel environment variables
RESEND_API_KEY=re_your_api_key
BLOOM_EMAIL_FROM_EMAIL=noreply@yourdomain.com
```

### **Railway/Heroku**

```bash
# Add to platform environment variables
RESEND_API_KEY=re_your_api_key
```

### **Docker**

```yaml
# docker-compose.yml
services:
  app:
    image: my-app
    environment:
      RESEND_API_KEY: re_your_api_key
      BLOOM_EMAIL_FROM_EMAIL: noreply@yourdomain.com
```

### **AWS/VPS**

```bash
# Add to your deployment script
export RESEND_API_KEY=re_your_api_key
export BLOOM_EMAIL_FROM_EMAIL=noreply@yourdomain.com
```

## 🤖 LLM Guidelines

### **Essential Patterns**

```typescript
// ✅ ALWAYS use these patterns
import { emailClass } from '@bloomneo/appkit/email';
const email = emailClass.get();

// ✅ Basic email sending
await email.send({
  to: 'user@example.com',
  subject: 'Subject',
  text: 'Plain text content',
});

// ✅ HTML email with fallback
await email.send({
  to: 'user@example.com',
  subject: 'Subject',
  html: '<h1>HTML content</h1>',
  text: 'Plain text fallback',
});

// ✅ Convenience methods
await emailClass.sendText('user@example.com', 'Subject', 'Message');

// ✅ Template usage
await email.sendTemplate('welcome', {
  to: 'user@example.com',
  name: 'John',
  appName: 'MyApp',
});
```

### **Anti-Patterns to Avoid**

```typescript
// ❌ DON'T create email strategies directly
const resend = new ResendStrategy(); // Use emailClass.get() instead

// ❌ DON'T forget error handling
await email.send(data); // Check result.success

// ❌ DON'T send without subject
await email.send({ to: 'user@example.com', text: 'Hi' }); // Missing subject

// ❌ DON'T send without content
await email.send({ to: 'user@example.com', subject: 'Hi' }); // Missing text/html

// ❌ DON'T ignore email validation
await email.send({ to: 'invalid-email', subject: 'Hi', text: 'Hello' });
```

### **Common Patterns**

```typescript
// Email with error handling
const result = await emailClass.send({
  to: user.email,
  subject: 'Welcome!',
  text: 'Welcome to our app!',
});

if (!result.success) {
  console.error('Email failed:', result.error);
}

// Conditional email sending
if (emailClass.hasProvider()) {
  await emailClass.send(emailData);
} else {
  console.log('No email provider configured');
}

// Batch email sending
const emails = users.map((user) => ({
  to: user.email,
  subject: 'Newsletter',
  html: newsletterHtml,
}));

await emailClass.get().sendBatch(emails);
```

## 📈 Performance

- **Resend Strategy**: ~100-500ms per email
- **SMTP Strategy**: ~200-1000ms per email (depends on server)
- **Console Strategy**: ~1-5ms (instant logging)
- **Batch Sending**: Processes 10 emails concurrently by default
- **Memory Usage**: <2MB baseline usage

## 🔍 TypeScript Support

```typescript
import type { EmailData, EmailResult } from '@bloomneo/appkit/email';

// Strongly typed email operations
const emailData: EmailData = {
  to: 'user@example.com',
  subject: 'Hello',
  text: 'Hello world!',
};

const result: EmailResult = await emailClass.send(emailData);
```

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>

---

## Agent-Dev Friendliness Score

**Score: 81/100 — 🟡 Solid**
*Scored 2026-04-14 by Claude · Rubric [`AGENT_DEV_SCORING_ALGORITHM.md`](../../AGENT_DEV_SCORING_ALGORITHM.md) v1.1*
*Delta vs previous (2026-04-13): **+8** (73 → 81)*

> No anti-pattern caps applied. All 16 public surface methods on `emailClass` resolve to real runtime functions; `examples/email.ts` was runtime-verified today; `llms.txt` and root `README.md` re-aligned with source on 2026-04-14; `dist/` rebuilt same day.

| # | Dimension | Score | Notes |
|---|---|---:|---|
| 1 | API correctness | **10** | All 16 surface methods (`get`, `clear`, `reset`, `getStrategy`, `getConfig`, `hasResend`, `hasSmtp`, `hasProvider`, `send`, `sendText`, `validateConfig`, `validateProduction`, `getHealthStatus`, `shutdown`, plus instance `sendHtml`, `sendTemplate`, `sendBatch`, `disconnect`) exist verbatim in `src/email/index.ts` + `email.ts`. No hallucinations found in README, AGENTS.md, llms.txt, or examples. |
| 2 | Doc consistency | **9** | README, AGENTS.md (Module 8), llms.txt, and `examples/email.ts` all use `emailClass.get()` → `email.send(...)` canonical pattern. Minor: README testing snippet still calls `emailClass.reset()` then `emailClass.send()` rather than `email.send()` — legal alias, slight pattern flicker. |
| 3 | Runtime verification | **8** | `email.test.ts` (149 LOC) exercises `send`, `sendText`, `sendHtml`, `sendBatch`, `sendTemplate`, `reset`, `clear`, `getStrategy`, `hasProvider`. `examples/email.ts` was runtime-verified today. Still no explicit test for `validateProduction` / `getHealthStatus`. |
| 4 | Type safety | **7** | `EmailData`, `EmailResult`, `EmailConfig` exported; recipient unions are precise. `sendTemplate(data: any)` and `Email.getConfig(): any` on the interface remain loose. No `any` in core `send()` path. |
| 5 | Discoverability | **8** | `package.json` exposes `./email` subpath; README hero has one copy-pasteable import that matches llms.txt and AGENTS.md Module 8 exactly. Still no inline "See also" pointer block at the very top. |
| 6 | Example completeness | **9** | Fresh `examples/email.ts` now covers `validateConfig`, `get`, `sendText`, `sendHtml`, `send` (full options + attachments + cc/replyTo), `sendBatch`, `getStrategy`, `hasProvider`, `getConfig`, `getHealthStatus`, `clear`. Remaining gap: no standalone demo for `sendTemplate`, `validateProduction`, `reset`, `shutdown`. |
| 7 | Composability | **6** | `cookbook/` has no email-first recipe; email only appears as a comment mention in `file-upload-pipeline.ts`. `examples/email.ts` composes config+send+health but is single-module. |
| 8 | Educational errors | **7** | Every internal `throw` is branded `[@bloomneo/appkit/email]`, names the offending field, and links to a specific README anchor (`#complete-api`, `#common-mistakes`, `#environment-variables`, `#built-in-templates`). Downside: provider-side errors (Resend/SMTP) pass through unwrapped. |
| 9 | Convention enforcement | **9** | Exactly one canonical path: `emailClass.get()` then instance methods, or `emailClass.send()/sendText()` shortcuts. `new EmailClass()` is explicitly flagged as anti-pattern in README's LLM Guidelines. |
| 10 | Drift prevention | **5** | No CI gate compares docs against source. Re-alignment today was manual. |
| 11 | Reading order | **6** | Root `README.md` and `llms.txt` both point at module README and `examples/email.ts`; module README still lacks a top-of-file "See also: AGENTS.md · examples/email.ts" block. |
| **12** | **Simplicity** | **8** | 16 exports but 80% case is 2 methods (`get`, `send`). Auto-strategy selection removes the provider-choice concept entirely. |
| **13** | **Clarity** | **9** | Every method name is a verb phrase that reads as a sentence: `sendText`, `sendHtml`, `sendBatch`, `hasProvider`, `validateProduction`, `getHealthStatus`. No `process`/`handle`/`run`. |
| **14** | **Unambiguity** | **7** | `validateConfig` (returns report) vs `validateProduction` (throws) is now called out in a callout box. Console strategy silently dropping mail in prod is flagged in "Common Mistakes". |
| **15** | **Learning curve** | **9** | README hero gives a working call in ≤10 lines with zero env vars (console strategy). Agent reading AGENTS.md Module 8 alone produces correct code first try. |

### Weighted (v1.1)

```
(10×.12)+(9×.08)+(8×.09)+(7×.06)+(8×.06)+(9×.08)+(6×.06)+(7×.05)+(9×.05)+(5×.04)+(6×.03)
+(8×.09)+(9×.09)+(7×.05)+(9×.05) = 8.13 → 81/100
No cap applied.
```

### Gaps to reach 🟢 85+

1. **D7 → 8**: Add an email-first cookbook recipe (e.g. `cookbook/transactional-email.ts` composing email + error + logger for a signup flow).
2. **D10 → 8**: Wire a CI drift check that greps doc files for `emailClass.<method>` and fails if the method is not exported.
3. **D11 → 8**: Add a top-of-file "See also" pointer block to this README (AGENTS.md Module 8, `examples/email.ts`, `llms.txt`).
4. **D4 → 9**: Tighten `sendTemplate` to a generic `sendTemplate<T extends TemplateName>(name: T, data: TemplateData<T>)` and narrow `Email.getConfig()` away from `any`.
5. **D3 → 9**: Add tests for `validateProduction` (prod-missing-provider branch) and `getHealthStatus`.
