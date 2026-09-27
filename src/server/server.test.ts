/**
 * @bloomneo/appkit/server over real HTTP: a contract's auth decision,
 * validation and response handling, and feature discovery.
 * (Tenant context through route() is covered by the RLS integration suite.)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { route, contractRouter, createApiRouter } from './index.js';
import { authClass } from '../auth/index.js';
import { errorClass } from '../error/index.js';

const contract = <C>(c: C) => c;

const listPlans = contract({ method: 'GET', path: '/api/plans', auth: 'public', response: z.array(z.string()) } as const);
const createInvoice = contract({
  method: 'POST',
  path: '/api/invoices',
  auth: 'user',
  tenant: false,
  body: z.object({ total: z.number().positive(), note: z.string().optional() }),
} as const);
const getReport = contract({
  method: 'GET',
  path: '/api/reports/:id',
  auth: { roles: ['admin.tenant'] },
  tenant: false,
  params: z.object({ id: z.string().min(2) }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
} as const);

let app: express.Express;
let token: (role: string, level: string) => string;

beforeAll(async () => {
  process.env.BLOOM_AUTH_SECRET = process.env.BLOOM_AUTH_SECRET || 'test-secret-that-is-long-enough-000000000';
  const auth = authClass.get();
  token = (role, level) => auth.generateLoginToken({ userId: 'u1', role, level, tenantId: 't1' });
  app = express();
  app.use(express.json());
  app.use(
    '/api',
    await contractRouter([
      route(listPlans, () => ['free', 'pro']),
      route(createInvoice, ({ body, user }) => ({ total: body.total, by: user?.userId })),
      route(getReport, ({ params, query }) => ({ id: params.id, page: query.page })),
    ]),
  );
  app.use(errorClass.get().handleErrors());
});

describe('route(contract, handler)', () => {
  it('serves a public route with no token', async () => {
    const res = await request(app).get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['free', 'pro']);
  });

  it("'user' routes need a token, then get the user and a validated body; POST answers 201", async () => {
    expect((await request(app).post('/api/invoices').send({ total: 5 })).status).toBe(401);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token('user', 'basic')}`)
      .send({ total: 5 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ total: 5, by: 'u1' });
  });

  it('rejects an invalid body with 400 and names the failing field', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token('user', 'basic')}`)
      .send({ total: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.issues).toEqual([expect.objectContaining({ part: 'body', path: 'total' })]);
  });

  it('role routes refuse a lower role and admit the required one; params and query are validated', async () => {
    const low = await request(app).get('/api/reports/r1').set('Authorization', `Bearer ${token('user', 'basic')}`);
    expect(low.status).toBe(403);
    const ok = await request(app).get('/api/reports/r1?page=3').set('Authorization', `Bearer ${token('admin', 'tenant')}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id: 'r1', page: 3 });
    const bad = await request(app).get('/api/reports/x').set('Authorization', `Bearer ${token('admin', 'tenant')}`);
    expect(bad.status).toBe(400);
  });

  it('refuses a contract with no auth decision when the route is built', () => {
    expect(() => route({ method: 'GET', path: '/api/x' } as any, () => null)).toThrow(/auth must be/);
  });
});

describe('createApiRouter', () => {
  it('mounts plain feature routers and contract routers, lists them, and 404s in JSON', async () => {
    // Inside the repo so the fixture's `import express` resolves.
    const dir = mkdtempSync(join(process.cwd(), '.tmp-features-'));
    made.push(dir);
    const serverIndex = join(process.cwd(), 'src', 'server', 'index.ts');
    mkdirSync(join(dir, 'legacy'));
    writeFileSync(
      join(dir, 'legacy', 'legacy.route.ts'),
      `import express from 'express';\nexport const isPublic = true;\nconst r = express.Router();\nr.get('/', (_q, s) => s.json({ legacy: true }));\nexport default r;\n`,
    );
    mkdirSync(join(dir, 'plans'));
    writeFileSync(
      join(dir, 'plans', 'plans.route.ts'),
      `import { route, contractRouter } from '${serverIndex}';\n` +
        `export default await contractRouter([route({ method: 'GET', path: '/api/plans/top', auth: 'public' }, () => ({ top: 'pro' }))]);\n`,
    );
    mkdirSync(join(dir, 'empty'));

    const warnings: string[] = [];
    const app2 = express();
    app2.use('/api', await createApiRouter({ featuresDir: dir, log: { info: () => {}, warn: (m) => warnings.push(m) } }));

    expect((await request(app2).get('/api/legacy')).body).toEqual({ legacy: true });
    expect((await request(app2).get('/api/plans/top')).body).toEqual({ top: 'pro' });
    const index = await request(app2).get('/api');
    expect(index.body.endpoints.routes).toEqual(
      expect.arrayContaining([
        { feature: 'legacy', path: '/api/legacy' },
        { feature: 'plans', method: 'GET', path: '/api/plans/top', auth: 'public' },
      ]),
    );
    const missing = await request(app2).get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.headers['content-type']).toMatch(/json/);
    expect(warnings.some((w) => w.includes('features/empty/ has no empty.route.ts'))).toBe(true);
  });
});

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
