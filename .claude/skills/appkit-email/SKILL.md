---
name: appkit-email
description: >-
  Use when writing code that sends transactional email via
  `@bloomneo/appkit/email`. Covers the `emailClass.get()` pattern, the
  Console → Resend → SMTP provider auto-detection, and the `send/sendText/sendHtml`
  surface.
---

# @bloomneo/appkit/email

Single-entry email: `emailClass.get()` returns a client that wraps the active
provider. In dev with no provider configured, emails log to the console — so
your first run never fails on missing SMTP config.

## Canonical flow

```ts
import { emailClass } from '@bloomneo/appkit/email';

const email = emailClass.get();

await email.send({
  to: 'user@example.com',
  subject: 'Welcome',
  text: 'Plain-text body',
  html: '<p>HTML body</p>',           // either/both
});

// Shortcuts for the common cases
await email.sendText('user@x.com', 'Subject', 'Plain body');
await email.sendHtml('user@x.com', 'Subject', '<p>HTML body</p>');

// Batch
await email.sendBatch([
  { to: 'a@x.com', subject: 'Hi Alice',   text: '...' },
  { to: 'b@x.com', subject: 'Hi Bob',     text: '...' },
]);
```

## Provider auto-detection

| Env | Strategy |
|---|---|
| `RESEND_API_KEY` | Resend (recommended for transactional) |
| `SMTP_HOST` (no Resend) | SMTP via nodemailer |
| none | Console (dev) — logs emails, sends nothing |

Override: `BLOOM_EMAIL_STRATEGY=console|resend|smtp`.

## Required in production

In `NODE_ENV=production`, the module refuses to operate without:
- One of `RESEND_API_KEY` or `SMTP_HOST` set
- `BLOOM_EMAIL_FROM_EMAIL` set (can't ship unlabeled mail)

`emailClass.validateProduction()` surfaces both at startup — call it in your
app boot so prod misconfig fails loud, not silent.

## Public API

### Email instance (from `emailClass.get()`)

```ts
email.send(emailData)                         // → Promise<EmailResult>
email.sendText(to, subject, text, from?)
email.sendHtml(to, subject, html, from?)
email.sendBatch(emailDataArray)               // → EmailResult[]
email.renderTemplate(name, vars)              // built-ins: 'welcome', 'reset'
```

### emailClass

```ts
emailClass.get(overrides?)                    // → Email
emailClass.send(data)                         // shortcut, no .get() needed
emailClass.sendText(to, subject, text, from?) // shortcut
emailClass.clear() / emailClass.reset(cfg?)   // tests
emailClass.getStrategy()                      // 'console' | 'resend' | 'smtp'
emailClass.hasResend() / hasSmtp() / hasProvider()
emailClass.validateConfig() / validateProduction()
emailClass.getHealthStatus()
emailClass.shutdown()                         // graceful close (call from SIGTERM)
```

## Env vars

Core:
- `BLOOM_EMAIL_FROM_EMAIL` — required in prod, the "From" address
- `BLOOM_EMAIL_FROM_NAME` — display name, falls back to `BLOOM_SERVICE_NAME`

Resend:
- `RESEND_API_KEY` — `re_...`
- `RESEND_BASE_URL` — default `https://api.resend.com`

SMTP:
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE`

Console (dev):
- `BLOOM_EMAIL_CONSOLE_FORMAT` — `simple` | `detailed`
- `BLOOM_EMAIL_CONSOLE_COLOR=false` — disable ANSI

## Common mistakes

- Forgetting `BLOOM_EMAIL_FROM_EMAIL` in prod — emails throw at send time.
  Call `emailClass.validateProduction()` during boot to surface early.
- Providing `to: ['a', 'b']` without a validator — the module validates each
  but your own input-layer validation is safer.
- Calling `email.send({ text: undefined, html: undefined })` — module throws
  "Email must have either text or html content".
