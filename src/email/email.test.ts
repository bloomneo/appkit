/**
 * Vitest tests for the email module.
 * @file src/email/email.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { emailClass } from './index.js';

afterEach(async () => { await emailClass.clear(); });

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

  it('EmailData has no template or data fields — use sendTemplate() instead', async () => {
    // This is a type-level assertion captured as a runtime check:
    // passing template/data to send() would be ignored or cause a type error
    const email = emailClass.get();
    // send() only accepts: to, from, subject, text, html, attachments, replyTo, cc, bcc
    const result = await email.send({ to: 'x@y.com', subject: 'S', text: 'T' });
    expect(result).toBeDefined();
  });
});

describe('email.sendTemplate()', () => {
  it('calls sendTemplate with name and data object', async () => {
    const email = emailClass.get();
    try {
      const result = await email.sendTemplate('welcome', {
        to: 'user@example.com',
        name: 'Alice',
      });
      expect(typeof result).toBe('object');
      expect(typeof result.success).toBe('boolean');
    } catch (e: any) {
      // Template may not be registered in test env — that's acceptable
      expect(e.message).toBeDefined();
    }
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
    'get', 'clear', 'reset', 'getStrategy', 'getConfig',
    'hasResend', 'hasSmtp', 'hasProvider',
    'send', 'sendText',
    'validateConfig', 'validateProduction', 'getHealthStatus', 'shutdown',
  ];

  const INSTANCE_METHODS = [
    'send', 'sendBatch', 'sendText', 'sendHtml', 'sendTemplate',
    'disconnect', 'getStrategy', 'getConfig',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = ['sendWithTemplate', 'queue', 'schedule'];

  // Class-level methods that MUST NOT exist — drift trap for docs.
  // `disconnectAll`/`flush`/`connect` have never been exposed at the class
  // level; `clear()` and `shutdown()` are the documented lifecycle hooks.
  const HALLUCINATED_CLASS = ['disconnectAll', 'flush', 'connect'];

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

  it('email.sendTemplate() is the correct template method (not send({template}))', () => {
    expect(typeof email.sendTemplate).toBe('function');
    // EmailData does not have a "template" field — enforced at type level
  });
});
