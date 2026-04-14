/**
 * examples/email.ts
 *
 * Runnable tour of the @bloomneo/appkit/email module.
 *
 * Strategy auto-selection:
 *   • RESEND_API_KEY set → Resend transport (recommended for prod)
 *   • SMTP_HOST set      → SMTP transport
 *   • neither            → Console transport (emails logged, not sent)
 *
 * Run: tsx examples/email.ts
 */

import { emailClass } from '../src/email/index.js';

async function main() {
  // 1. Validate config at startup — prints warnings/errors, doesn't throw.
  const validation = emailClass.validateConfig();
  console.log('config valid:', validation.valid, 'strategy:', validation.strategy);

  // 2. Get the instance. Strategy is locked in on first call.
  const email = emailClass.get();

  // 3. Simplest path — plain text.
  const r1 = await email.sendText(
    'user@example.com',
    'Welcome!',
    'Thanks for signing up.',
  );
  console.log('sendText →', r1);

  // 4. HTML with a plain-text fallback.
  const r2 = await email.sendHtml(
    'user@example.com',
    'Order confirmed',
    '<h1>Thanks!</h1><p>Your order is on the way.</p>',
    'Thanks! Your order is on the way.',
  );
  console.log('sendHtml →', r2);

  // 5. Full send() — CC/BCC/attachments/replyTo etc.
  const r3 = await email.send({
    to: [{ name: 'Ada', email: 'ada@example.com' }],
    from: { name: 'MyApp', email: 'noreply@myapp.dev' },
    subject: 'Your invoice',
    html: '<p>See attached.</p>',
    text: 'See attached.',
    replyTo: 'billing@myapp.dev',
    cc: 'accounting@myapp.dev',
    attachments: [
      { filename: 'invoice.txt', content: Buffer.from('line items...'), contentType: 'text/plain' },
    ],
  });
  console.log('send →', r3);

  // 6. Batch send — up to `batchSize` in flight at once.
  const batch = await email.sendBatch(
    [
      { to: 'a@example.com', subject: 'Hi A', text: 'hello A' },
      { to: 'b@example.com', subject: 'Hi B', text: 'hello B' },
    ],
    5,
  );
  console.log('sendBatch →', batch.map(b => b.success));

  // 7. Debug helpers — safe to log (no credentials).
  console.log('strategy    =', emailClass.getStrategy());
  console.log('hasProvider =', emailClass.hasProvider());
  console.log('config      =', emailClass.getConfig());
  console.log('health      =', emailClass.getHealthStatus());

  // 8. Graceful shutdown (app termination or tests).
  await emailClass.clear();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
