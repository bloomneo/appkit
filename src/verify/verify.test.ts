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

describe('safety rails', () => {
  afterEach(() => verifyClass.disconnectAll());

  const identities = [
    { label: 'firm-a', email: 'a@x.test', password: 'p' },
    { label: 'firm-b', email: 'b@x.test', password: 'p' },
  ];

  it('refuses a non-local baseUrl unless allowRemote is set', async () => {
    await expect(
      verifyClass.get().run({ baseUrl: 'https://app.example.com', identities }),
    ).rejects.toThrow(/Refusing to probe app\.example\.com/);
  });

  /*
   * A deliberately leaky app: every tenant can read, patch and delete every
   * row. It counts the DELETEs it receives, which is what the default run
   * must never send.
   */
  async function leakyServer() {
    const { createServer } = await import('node:http');
    const rows: Record<string, string> = {
      'a@x.test': '11111111-1111-4111-8111-111111111111',
      'b@x.test': '22222222-2222-4222-8222-222222222222',
    };
    const state = { deletes: 0 };
    const server = createServer((req, res) => {
      const token = (req.headers.authorization ?? '').replace('Bearer ', '');
      const send = (status: number, body?: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(body === undefined ? '' : JSON.stringify(body));
      };
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/api/auth/login') {
          return send(200, { token: JSON.parse(raw).email });
        }
        if (!token) return send(401, { error: 'no token' });
        if (req.method === 'GET' && req.url === '/api/notes') return send(200, [{ id: rows[token] }]);
        if (req.method === 'DELETE') {
          state.deletes++;
          return send(204);
        }
        return send(200, { ok: true });
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as any).port;
    return { server, state, baseUrl: `http://127.0.0.1:${port}` };
  }

  it('sends no DELETE unless allowDestructive is set', async () => {
    const { server, state, baseUrl } = await leakyServer();
    try {
      const report = await verifyClass.get().run({ baseUrl, identities, paths: ['/api/notes'] });
      expect(state.deletes).toBe(0);
      expect(report.destructive).toBe(false);
      expect(report.findings.some((f) => f.kind === 'cross-tenant-read')).toBe(true);
    } finally {
      server.close();
    }
  });

  it('replays DELETE when allowDestructive is set', async () => {
    const { server, state, baseUrl } = await leakyServer();
    try {
      const report = await verifyClass.get().run({ baseUrl, identities, paths: ['/api/notes'], allowDestructive: true });
      expect(state.deletes).toBeGreaterThan(0);
      expect(report.destructive).toBe(true);
      expect(report.findings.some((f) => f.kind === 'cross-tenant-delete')).toBe(true);
    } finally {
      server.close();
    }
  });
});
