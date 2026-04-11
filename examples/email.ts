/**
 * CANONICAL PATTERN — send email with auto-scaling provider.
 *
 * Copy this file when you need to send email. Default is console (logs to
 * terminal — perfect for development). Set SMTP_HOST + SMTP_USER + SMTP_PASS
 * to use SMTP. Set RESEND_API_KEY to use Resend.
 *
 * Same code works for all three providers — no changes needed.
 */

import { emailClass, errorClass } from '@bloomneo/appkit';

const email = emailClass.get();
const error = errorClass.get();

// ── Plain text email ────────────────────────────────────────────────
export async function sendWelcomeEmail(toAddress: string, userName: string) {
  await email.send({
    to: toAddress,
    subject: 'Welcome to MyApp',
    text: `Hi ${userName},\n\nThanks for signing up!\n\n— The Team`,
  });
}

// ── HTML email with plain-text fallback ─────────────────────────────
export async function sendInvoiceEmail(toAddress: string, invoiceUrl: string) {
  await email.send({
    to: toAddress,
    subject: 'Your invoice is ready',
    text: `Your invoice: ${invoiceUrl}`,
    html: `<p>Your invoice: <a href="${invoiceUrl}">${invoiceUrl}</a></p>`,
  });
}

// ── Templated email ─────────────────────────────────────────────────
// EmailData (used by email.send()) only accepts: to, from, subject, text,
// html, attachments, replyTo, cc, bcc — it has no template/data fields.
// Use email.sendTemplate() for template-driven emails.
export async function sendPasswordResetEmail(toAddress: string, resetLink: string) {
  await email.sendTemplate('password-reset', {
    to: toAddress,
    resetLink,
    expiresIn: '1 hour',
  });
}

// ── Inside a route handler ──────────────────────────────────────────
export const sendNotificationRoute = error.asyncRoute(async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) throw error.badRequest('to and message required');
  await email.send({ to, subject: 'Notification', text: message });
  res.json({ sent: true });
});
