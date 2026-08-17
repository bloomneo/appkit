/**
 * Vitest tests for the tenant-isolation verifier.
 * The end-to-end proof lives in the bloom-bench harness (it needs a running
 * app); these cover the parts that decide whether a run is trustworthy.
 * @file src/verify/verify.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import { verifyClass, VerifierClass } from './index.js';

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = ['get', 'reset', 'disconnectAll'];
  const HALLUCINATED_CLASS = ['run', 'check', 'audit', 'scan', 'format'];

  for (const m of CLASS_METHODS) {
    it(`verifyClass.${m} exists and is a function`, () => {
      expect(typeof (verifyClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`verifyClass.${m} does NOT exist (call via verifyClass.get().${m}())`, () => {
      expect(typeof (verifyClass as any)[m]).not.toBe('function');
    });
  }
});

describe('options validation', () => {
  afterEach(() => verifyClass.disconnectAll());

  it('requires a baseUrl', async () => {
    await expect(verifyClass.get().run({ identities: [] } as any)).rejects.toThrow(/baseUrl is required/);
  });

  it('requires at least two identities — isolation is only observable by comparison', async () => {
    await expect(
      verifyClass.get().run({
        baseUrl: 'http://localhost:1',
        identities: [{ label: 'a', email: 'a@x.test', password: 'p' }],
      }),
    ).rejects.toThrow(/At least two identities/);
  });

  it('requires each identity to be complete', async () => {
    await expect(
      verifyClass.get().run({
        baseUrl: 'http://localhost:1',
        identities: [
          { label: 'a', email: 'a@x.test', password: 'p' },
          { label: 'b', email: '', password: 'p' } as any,
        ],
      }),
    ).rejects.toThrow(/label, email and password/);
  });
});

describe('id discovery — ids are discovered, never declared', () => {
  // This is what makes the verifier a generator rather than a template: it
  // needs no manifest of an app's response shapes or fixture ids.
  const extract = (json: unknown) => (new VerifierClass() as any).extractIds(json).sort();

  it('finds ids in a bare array', () => {
    expect(extract([{ id: 'cabcdefghijklmnopqrstuvw' }])).toEqual(['cabcdefghijklmnopqrstuvw']);
  });

  it('finds ids under an arbitrary envelope key', () => {
    expect(extract({ clients: [{ id: '123' }, { id: '456' }] })).toEqual(['123', '456']);
  });

  it('handles uuid and mongo ObjectId shapes', () => {
    const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const oid = '507f1f77bcf86cd799439011';
    expect(extract({ items: [{ id: uuid }, { _id: oid }] }).sort()).toEqual([oid, uuid].sort());
  });

  it('ignores values that are not id-shaped', () => {
    expect(extract({ rows: [{ id: 'not an id at all!' }, { id: 'open' }] })).toEqual([]);
  });

  it('descends into nested collections', () => {
    expect(extract({ page: { data: { rows: [{ id: '77' }] } } })).toEqual(['77']);
  });

  it('does not run away on deeply nested or huge payloads', () => {
    const deep: any = { a: { b: { c: { d: { e: { f: { g: { h: [{ id: '1' }] } } } } } } } };
    expect(extract(deep)).toEqual([]); // depth-capped on purpose
    const huge = { rows: Array.from({ length: 500 }, (_, i) => ({ id: String(i + 1) })) };
    expect(extract(huge).length).toBeLessThanOrEqual(50);
  });
});

describe('a skip never reads as a pass', () => {
  // The failure mode that would make this tool worse than useless: a CI gate
  // asserting report.ok going green on an app the verifier never reached.
  const verifier = new VerifierClass();

  it('format() calls an empty run INCONCLUSIVE, not clean', () => {
    const out = verifier.format({
      ok: false,
      checks: 0,
      findings: [],
      probed: [],
      harvested: {},
      skipped: ['no endpoints discovered'],
    });
    expect(out).toMatch(/INCONCLUSIVE/);
    expect(out).not.toMatch(/✅/);
  });

  it('format() reports a genuinely clean run as clean', () => {
    const out = verifier.format({
      ok: true,
      checks: 40,
      findings: [],
      probed: ['/api/clients'],
      harvested: { a: 8 },
      skipped: [],
    });
    expect(out).toMatch(/no tenant leaks found/);
  });

  it('format() names actor, victim and remedy for each leak', () => {
    const out = verifier.format({
      ok: false,
      checks: 40,
      findings: [
        {
          kind: 'cross-tenant-write',
          actor: 'firm-b',
          victim: 'firm-a',
          method: 'PATCH',
          path: '/api/clients/abc',
          status: 200,
          detail: 'Modified a resource belonging to "firm-a".',
        },
      ],
      probed: ['/api/clients'],
      harvested: { 'firm-a': 8, 'firm-b': 8 },
      skipped: [],
    });
    expect(out).toContain('cross-tenant-write');
    expect(out).toContain('firm-b reached firm-a');
    expect(out).toContain('PATCH /api/clients/abc');
  });
});
