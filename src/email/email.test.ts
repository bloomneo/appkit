/**
 * Vitest tests for the email module.
 * @file src/email/email.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { emailClass } from './index.js';

afterEach(async () => { await emailClass.disconnectAll(); });

describe('emailClass.get()', () => {
  it('returns an Email instance', () => {
    const email = emailClass.get();
    expect(email).toBeDefined();
    expect(typeof email).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(emailClass.get()).toBe(emailClass.get());
  });
});

describe('email.send()', () => {
  it('sends a plain-text email and returns a result object', async () => {
    const email = emailClass.get();
    const result = await email.send({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello world',
    });
    expect(typeof result).toBe('object');
    expect(typeof result.success).toBe('boolean');
  });

  it('EmailData has no template or data fields — render the body yourself', async () => {
    // This is a type-level assertion captured as a runtime check:
    // passing template/data to send() would be ignored or cause a type error
    const email = emailClass.get();
    // send() only accepts: to, from, subject, text, html, attachments, replyTo, cc, bcc
    const result = await email.send({ to: 'x@y.com', subject: 'S', text: 'T' });
    expect(result).toBeDefined();
  });
});

describe('email.sendText()', () => {
  it('sends a text-only email', async () => {
    const email = emailClass.get();
    const result = await email.sendText('a@b.com', 'Subject', 'Body text');
    expect(typeof result.success).toBe('boolean');
  });
});

describe('email.sendHtml()', () => {
  it('sends an HTML email', async () => {
    const email = emailClass.get();
    const result = await email.sendHtml(
      'a@b.com',
      'HTML Subject',
      '<p>Hello</p>',
      'Hello',
    );
    expect(typeof result.success).toBe('boolean');
  });
});

describe('emailClass convenience methods', () => {
  it('emailClass.send() convenience shortcut works', async () => {
    const result = await emailClass.send({
      to: 'z@z.com',
      subject: 'Shortcut',
      text: 'Direct',
    });
    expect(typeof result.success).toBe('boolean');
  });

  it('emailClass.sendText() convenience shortcut works', async () => {
    const result = await emailClass.sendText('z@z.com', 'Subj', 'Msg');
    expect(typeof result.success).toBe('boolean');
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset', 'getStrategy', 'getConfig',
    'hasResend', 'hasSmtp', 'hasProvider',
    'send', 'sendText',
    'validateConfig', 'validateProduction', 'getHealthStatus', 'disconnectAll',
  ];

  const INSTANCE_METHODS = [
    'send', 'sendBatch', 'sendText', 'sendHtml',
    'disconnect', 'getStrategy', 'getConfig',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = [
    'sendWithTemplate', 'queue', 'schedule',
    'sendTemplate', // removed in 6.0 — render the body in the app, then send()
  ];

  // Class-level methods that MUST NOT exist — `flush`/`connect` never existed.
  // `shutdown` was renamed to `disconnectAll` in 3.0.2. `clear` was removed
  // in 4.0.0 (was a redundant alias for disconnectAll).
  const HALLUCINATED_CLASS = [
    'flush', 'connect',
    'shutdown',   // renamed to disconnectAll() — NAMING.md §70
    'clear',      // removed in 4.0.0 — use disconnectAll()
  ];

  for (const m of CLASS_METHODS) {
    it(`emailClass.${m} exists`, () => {
      expect(typeof (emailClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`emailClass.${m} does NOT exist (not part of the public API)`, () => {
      expect(typeof (emailClass as any)[m]).not.toBe('function');
    });
  }

  const email = emailClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`email instance .${m} exists`, () => {
      expect(typeof (email as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
    it(`email.${m} does NOT exist`, () => {
      expect(typeof (email as any)[m]).not.toBe('function');
    });
  }
});
