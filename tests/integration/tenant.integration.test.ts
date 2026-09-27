/**
 * Tenant scoping against a real Prisma client and a real Postgres.
 *
 * 5.1.3 and earlier scoped tenants with `client.$use`, which Prisma removed in
 * 6.14. Nothing exercised the path with a real client, so tenant mode threw on
 * its first query and every test stayed green. This suite runs the adapter's
 * scoping against Postgres.
 *
 * Needs APPKIT_TEST_POSTGRES_URL. The generated client comes from
 * tests/integration/fixtures/tenant/schema.prisma.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PrismaAdapter } from '../../src/database/adapters/prisma.js';

const POSTGRES = process.env.APPKIT_TEST_POSTGRES_URL;
const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'tenant');
const require = createRequire(import.meta.url);

describe.skipIf(!POSTGRES)('database: tenant scoping on Prisma 6 ($extends)', () => {
  let base: any;
  let a: any;
  let b: any;

  beforeAll(async () => {
    const schema = join(fixture, 'schema.prisma');
    const env = { ...process.env, APPKIT_TEST_POSTGRES_URL: POSTGRES };
    execSync(`npx prisma generate --schema "${schema}"`, { stdio: 'pipe', env });

    const generated = join(fixture, 'generated');
    expect(existsSync(generated)).toBe(true);
    const { PrismaClient } = require(generated);
    base = new PrismaClient({ datasources: { db: { url: POSTGRES } } });

    // Fresh tables owned by this suite (names prefixed appkit_tenant_).
    await base.$executeRawUnsafe('DROP TABLE IF EXISTS appkit_tenant_note, appkit_tenant_plan');
    await base.$executeRawUnsafe(
      'CREATE TABLE appkit_tenant_note (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, body TEXT NOT NULL)'
    );
    await base.$executeRawUnsafe('CREATE TABLE appkit_tenant_plan (id SERIAL PRIMARY KEY, name TEXT NOT NULL)');

    const adapter = new PrismaAdapter({ url: POSTGRES } as any);
    a = await adapter.applyTenantMiddleware(base, 'tenant-a');
    b = await adapter.applyTenantMiddleware(base, 'tenant-b');
  }, 120_000);

  afterAll(async () => {
    await base?.$disconnect();
  });

  it('creates rows in the scoped tenant, even when the caller names another', async () => {
    const own = await a.note.create({ data: { body: 'a1' } });
    const spoofed = await a.note.create({ data: { body: 'a2', tenant_id: 'tenant-b' } });
    expect(own.tenant_id).toBe('tenant-a');
    expect(spoofed.tenant_id).toBe('tenant-a');

    await b.note.createMany({ data: [{ body: 'b1' }, { body: 'b2', tenant_id: 'tenant-a' }] });
    expect(await base.note.count({ where: { tenant_id: 'tenant-b' } })).toBe(2);
  });

  it('reads only the scoped tenant, including through OR filters', async () => {
    expect((await a.note.findMany()).map((n: any) => n.body).sort()).toEqual(['a1', 'a2']);
    expect(await b.note.count()).toBe(2);

    const or = await a.note.findMany({ where: { OR: [{ body: 'a1' }, { body: 'b1' }] } });
    expect(or.map((n: any) => n.body)).toEqual(['a1']);
  });

  it('cannot read, update or delete another tenant\'s row by id', async () => {
    const bRow = await base.note.findFirst({ where: { tenant_id: 'tenant-b' } });

    expect(await a.note.findUnique({ where: { id: bRow.id } })).toBeNull();
    await expect(a.note.update({ where: { id: bRow.id }, data: { body: 'x' } })).rejects.toThrow();
    await expect(a.note.delete({ where: { id: bRow.id } })).rejects.toThrow();
    expect((await a.note.updateMany({ where: { id: bRow.id }, data: { body: 'x' } })).count).toBe(0);
    expect((await a.note.deleteMany({ where: { id: bRow.id } })).count).toBe(0);

    const still = await base.note.findUnique({ where: { id: bRow.id } });
    expect(still.body).not.toBe('x');
  });

  it('cannot move a row to another tenant', async () => {
    const row = await a.note.findFirst();
    const moved = await a.note.update({ where: { id: row.id }, data: { tenant_id: 'tenant-b' } });
    expect(moved.tenant_id).toBe('tenant-a');
  });

  it('leaves the base client and models without the field untouched', async () => {
    expect(await base.note.count()).toBe(4);
    await a.plan.create({ data: { name: 'pro' } });
    expect(await b.plan.count()).toBe(1);
  });
});
