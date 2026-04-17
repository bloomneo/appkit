/**
 * Vitest tests for the event module.
 * @file src/event/event.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { eventClass } from './index.js';

afterEach(async () => { await eventClass.disconnectAll(); });

describe('eventClass.get()', () => {
  it('returns an Event instance for the default namespace', () => {
    const event = eventClass.get();
    expect(event).toBeDefined();
    expect(typeof event).toBe('object');
  });

  it('returns the same instance for the same namespace (singleton per namespace)', () => {
    expect(eventClass.get('orders')).toBe(eventClass.get('orders'));
  });

  it('returns different instances for different namespaces', () => {
    expect(eventClass.get('ns-a')).not.toBe(eventClass.get('ns-b'));
  });

  it('throws for an empty namespace', () => {
    expect(() => eventClass.get('')).toThrow();
  });

  it('throws for a namespace with invalid characters', () => {
    expect(() => eventClass.get('bad namespace!')).toThrow();
  });
});

describe('event.emit() + event.on()', () => {
  it('delivers emitted events to registered handlers', async () => {
    const event = eventClass.get('test-emit');
    const received: any[] = [];

    event.on('user.created', (data) => { received.push(data); });
    await event.emit('user.created', { id: 1 });

    // Allow in-memory event loop to flush
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(received.length).toBeGreaterThan(0);
    expect(received[0]).toMatchObject({ id: 1 });
  });

  it('emit returns a boolean', async () => {
    const event = eventClass.get('test-bool');
    const result = await event.emit('ping', {});
    expect(typeof result).toBe('boolean');
  });
});

describe('event.once()', () => {
  it('fires handler only once', async () => {
    const event = eventClass.get('test-once');
    let count = 0;

    event.once('one-shot', () => { count++; });
    await event.emit('one-shot', {});
    await event.emit('one-shot', {});
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(count).toBe(1);
  });
});

describe('event.off()', () => {
  it('removes a registered handler', async () => {
    const event = eventClass.get('test-off');
    let count = 0;
    const handler = () => { count++; };

    event.on('tick', handler);
    await event.emit('tick', {});
    await new Promise(resolve => setTimeout(resolve, 10));

    event.off('tick', handler);
    await event.emit('tick', {});
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(count).toBe(1);
  });
});

describe('event.emitBatch()', () => {
  it('returns an array of booleans', async () => {
    const event = eventClass.get('test-batch');
    const results = await event.emitBatch([
      { event: 'a', data: 1 },
      { event: 'b', data: 2 },
    ]);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
  });
});

describe('eventClass.broadcast()', () => {
  it('returns an array (empty when no active namespaces)', async () => {
    const results = await eventClass.broadcast('system.ping', {});
    expect(Array.isArray(results)).toBe(true);
  });

  it('broadcasts to all active namespaces', async () => {
    eventClass.get('bcast-1');
    eventClass.get('bcast-2');
    const results = await eventClass.broadcast('system.ping', {});
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe('eventClass.getActiveNamespaces()', () => {
  it('returns list of created namespaces', () => {
    eventClass.get('monitor-a');
    eventClass.get('monitor-b');
    const ns = eventClass.getActiveNamespaces();
    expect(ns).toContain('monitor-a');
    expect(ns).toContain('monitor-b');
  });
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = [
    'get', 'reset', 'getStrategy', 'getActiveNamespaces', 'getConfig',
    'hasRedis', 'getStats', 'broadcast',
    'validateConfig', 'validateProduction', 'getHealthStatus', 'disconnectAll',
  ];

  const INSTANCE_METHODS = [
    'emit', 'on', 'once', 'off', 'emitBatch', 'history',
    'getListeners', 'disconnect', 'getStrategy', 'getConfig',
  ];

  // Instance methods that do NOT exist — previously hallucinated
  const HALLUCINATED_INSTANCE = ['subscribe', 'unsubscribe', 'publish', 'listen'];

  // Class-level methods that MUST NOT exist — removed dead exports + renames.
  const HALLUCINATED_CLASS = [
    'getConfigSummary', 'getEnvironmentOptimizedConfig', 'getMicroservicesConfig',
    'shutdown',   // renamed to disconnectAll() in 3.0.2 — NAMING.md §70
    'clear',      // removed in 4.0.0 — redundant alias, use disconnectAll()
  ];

  for (const m of CLASS_METHODS) {
    it(`eventClass.${m} exists`, () => {
      expect(typeof (eventClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`eventClass.${m} does NOT exist (not part of the public API)`, () => {
      expect(typeof (eventClass as any)[m]).not.toBe('function');
    });
  }

  const event = eventClass.get('drift-check');
  for (const m of INSTANCE_METHODS) {
    it(`event instance .${m} exists`, () => {
      expect(typeof (event as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_INSTANCE) {
    it(`event.${m} does NOT exist`, () => {
      expect(typeof (event as any)[m]).not.toBe('function');
    });
  }
});
