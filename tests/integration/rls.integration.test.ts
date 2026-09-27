/**
 * Row-level security, end to end, against a real Postgres.
 *
 * The app connects as an ordinary role (not a superuser, no BYPASSRLS) —
 * superusers skip RLS entirely, so testing as one would prove nothing.
 * The policy is created with rlsPolicyStatements(), exactly as an app would.
 *
 * Needs APPKIT_TEST_POSTGRES_URL (an admin connection; the test creates the
 * app role and table itself).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ADMIN_URL = process.env.APPKIT_TEST_POSTGRES_URL;
const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'tenant');
const require = createRequire(import.meta.url);

const APP_ROLE = 'appkit_rls_app';

describe.skipIf(!ADMIN_URL)('database: tenant isolation with Postgres row-level security', () => {
  let admin: any;
  let db: typeof import('../../src/database/index.js');
  let appUrl: string;
  const req = (tenantId: string) => ({ user: { userId: `u-${tenantId}`, tenantId } });

  beforeAll(async () => {
    const schema = join(fixture, 'schema.prisma');
    execSync(`npx prisma generate --schema "${schema}"`, {
      stdio: 'pipe',
      env: { ...process.env, APPKIT_TEST_POSTGRES_URL: ADMIN_URL },
    });
    const { PrismaClient } = require(join(fixture, 'generated'));
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });

    await admin.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE}' NOSUPERUSER NOBYPASSRLS;
      END IF; END $$`);
    await admin.$executeRawUnsafe('DROP TABLE IF EXISTS appkit_rls_reaction');
    await admin.$executeRawUnsafe('DROP TABLE IF EXISTS appkit_rls_comment');
    await admin.$executeRawUnsafe('DROP TABLE IF EXISTS appkit_rls_note');
    await admin.$executeRawUnsafe(
      'CREATE TABLE appkit_rls_note (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, body TEXT NOT NULL)',
    );
    await admin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON appkit_rls_note TO ${APP_ROLE}`);
    await admin.$executeRawUnsafe(`GRANT USAGE, SELECT ON SEQUENCE appkit_rls_note_id_seq TO ${APP_ROLE}`);

    const { rlsPolicyStatements } = await import('../../src/database/tenancy.js');
    for (const sql of rlsPolicyStatements({ table: 'appkit_rls_note' })) await admin.$executeRawUnsafe(sql);

    // A child table with no tenant column of its own, scoped through its note.
    await admin.$executeRawUnsafe(
      'CREATE TABLE appkit_rls_comment (id SERIAL PRIMARY KEY, note_id INT REFERENCES appkit_rls_note(id), body TEXT NOT NULL)',
    );
    await admin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON appkit_rls_comment TO ${APP_ROLE}`);
    await admin.$executeRawUnsafe(`GRANT USAGE, SELECT ON SEQUENCE appkit_rls_comment_id_seq TO ${APP_ROLE}`);
    for (const sql of rlsPolicyStatements({
      table: 'appkit_rls_comment',
      via: { parent: 'appkit_rls_note', foreignKey: 'note_id' },
    })) {
      await admin.$executeRawUnsafe(sql);
    }
    // A grandchild: scoped by "its comment is visible", i.e. the comment's policy.
    await admin.$executeRawUnsafe(
      'CREATE TABLE appkit_rls_reaction (id SERIAL PRIMARY KEY, comment_id INT REFERENCES appkit_rls_comment(id), emoji TEXT NOT NULL)',
    );
    await admin.$executeRawUnsafe(`GRANT SELECT, INSERT ON appkit_rls_reaction TO ${APP_ROLE}`);
    await admin.$executeRawUnsafe(`GRANT USAGE, SELECT ON SEQUENCE appkit_rls_reaction_id_seq TO ${APP_ROLE}`);
    for (const sql of rlsPolicyStatements({
      table: 'appkit_rls_reaction',
      via: { parent: 'appkit_rls_comment', foreignKey: 'comment_id', column: false },
    })) {
      await admin.$executeRawUnsafe(sql);
    }

    // Seed through the policy's own escape hatch, so it works whether or not
    // the admin connection is a superuser.
    await admin.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', '__BYPASS__', true)`;
      await tx.$executeRawUnsafe(
        "INSERT INTO appkit_rls_note (tenant_id, body) VALUES ('a','a1'),('a','a2'),('b','b1')",
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO appkit_rls_comment (note_id, body)
         SELECT id, body || '-c' FROM appkit_rls_note UNION ALL SELECT NULL, 'orphan'`,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO appkit_rls_reaction (comment_id, emoji) SELECT id, body || '-r' FROM appkit_rls_comment`,
      );
    });

    const u = new URL(ADMIN_URL!);
    u.username = APP_ROLE;
    u.password = APP_ROLE;
    appUrl = u.toString();

    process.env.DATABASE_URL = appUrl;
    process.env.BLOOM_DB_TENANT = 'rls';
    process.env.BLOOM_PRISMA_CLIENT = join(fixture, 'generated', 'index.js');
    db = await import('../../src/database/index.js');
  }, 120_000);

  afterAll(async () => {
    await db?.databaseClass.disconnectAll();
    await admin?.$disconnect();
    delete process.env.BLOOM_DB_TENANT;
    delete process.env.BLOOM_PRISMA_CLIENT;
  });

  it('the policy alone scopes an ordinary role (no appkit filter involved)', async () => {
    const { PrismaClient } = require(join(fixture, 'generated'));
    const raw = new PrismaClient({ datasources: { db: { url: appUrl } } });
    try {
      const none = await raw.$queryRawUnsafe('SELECT body FROM appkit_rls_note');
      expect(none).toEqual([]); // no app.tenant_id: fail closed

      const onlyA = await raw.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', 'a', true)`;
        return tx.$queryRawUnsafe('SELECT body FROM appkit_rls_note ORDER BY body');
      });
      expect(onlyA.map((r: any) => r.body)).toEqual(['a1', 'a2']);

      await expect(
        raw.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', 'a', true)`;
          await tx.$executeRawUnsafe("INSERT INTO appkit_rls_note (tenant_id, body) VALUES ('b', 'sneaky')");
        }),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await raw.$disconnect();
    }
  });

  it('database.tenant(req) returns only the caller\'s rows', async () => {
    const rows = await db.databaseClass.tenant(req('a'), (c: any) => c.rlsNote.findMany({ orderBy: { body: 'asc' } }));
    expect(rows.map((r: any) => r.body)).toEqual(['a1', 'a2']);
  });

  it('writes land in the caller\'s tenant even when the caller names another', async () => {
    const created = await db.databaseClass.tenant(req('b'), (c: any) =>
      c.rlsNote.create({ data: { tenant_id: 'a', body: 'b2' } }),
    );
    expect(created.tenant_id).toBe('b');
  });

  it('concurrent requests never see each other\'s rows', async () => {
    const runs = await Promise.all(
      Array.from({ length: 20 }, (_, i) => {
        const t = i % 2 ? 'a' : 'b';
        return db.databaseClass
          .tenant(req(t), (c: any) => c.rlsNote.findMany())
          .then((rows: any[]) => ({ t, tenants: [...new Set(rows.map((r) => r.tenant_id))] }));
      }),
    );
    for (const { t, tenants } of runs) expect(tenants).toEqual([t]);
  });

  it('context() middleware scopes get() for the rest of the request', async () => {
    const mw = db.databaseClass.context();
    const rows: any[] = await new Promise((resolve, reject) => {
      mw(req('a'), {}, async () => {
        try {
          const client: any = await db.databaseClass.get();
          resolve(await client.rlsNote.findMany());
        } catch (e) {
          reject(e);
        }
      });
    });
    expect(rows.every((r) => r.tenant_id === 'a')).toBe(true);
  });

  it('with no tenant in context, the shared client refuses rather than returning every row', async () => {
    await expect(db.databaseClass.get()).rejects.toThrow(/no tenant resolved/);
    await expect(db.databaseClass.tenant({ user: { userId: 'x' } }, (c: any) => c.rlsNote.findMany())).rejects.toThrow(
      /No tenant resolved/,
    );
  });

  it('bypass(reason) sees every tenant and is reported', async () => {
    const seen: string[] = [];
    const off = db.databaseClass.onBypass(({ reason }) => seen.push(reason));
    const quiet = console.warn;
    console.warn = () => {};
    try {
      const rows = await db.databaseClass.bypass('platform report of all notes', (c: any) => c.rlsNote.findMany());
      expect(new Set(rows.map((r: any) => r.tenant_id))).toEqual(new Set(['a', 'b']));
      expect(seen).toEqual(['platform report of all notes']);
    } finally {
      console.warn = quiet;
      off();
    }
  });

  it('a child table scoped via its parent follows the parent\'s tenant', async () => {
    const { PrismaClient } = require(join(fixture, 'generated'));
    const raw = new PrismaClient({ datasources: { db: { url: appUrl } } });
    const as = (tenant: string, sql: string) =>
      raw.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant}, true)`;
        return tx.$queryRawUnsafe(sql);
      });
    try {
      expect(await raw.$queryRawUnsafe('SELECT body FROM appkit_rls_comment')).toEqual([]);
      const a = await as('a', 'SELECT body FROM appkit_rls_comment ORDER BY body');
      expect(a.map((r: any) => r.body)).toEqual(['a1-c', 'a2-c']); // not b's, not the orphan
      const b = await as('b', 'SELECT body FROM appkit_rls_comment ORDER BY body');
      expect(b.map((r: any) => r.body)).toEqual(['b1-c']);

      // Tenant a cannot attach a comment to b's note.
      const bNoteId = (await as('b', "SELECT id FROM appkit_rls_note WHERE body = 'b1'"))[0].id;
      await expect(
        as('a', `INSERT INTO appkit_rls_comment (note_id, body) VALUES (${Number(bNoteId)}, 'sneaky')`),
      ).rejects.toThrow(/row-level security/);

      const all = await as('__BYPASS__', 'SELECT count(*)::int AS n FROM appkit_rls_comment');
      expect(all[0].n).toBe(4); // bypass sees every row, the orphan included

      // Grandchild, through the comment's own policy.
      const ra = await as('a', 'SELECT emoji FROM appkit_rls_reaction ORDER BY emoji');
      expect(ra.map((r: any) => r.emoji)).toEqual(['a1-c-r', 'a2-c-r']);
      const bCommentId = (await as('b', "SELECT id FROM appkit_rls_comment WHERE body = 'b1-c'"))[0].id;
      await expect(
        as('a', `INSERT INTO appkit_rls_reaction (comment_id, emoji) VALUES (${Number(bCommentId)}, 'sneaky')`),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await raw.$disconnect();
    }
  });
});
