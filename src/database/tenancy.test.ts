/**
 * Unit tests for the tenancy helpers that need no database.
 * The Postgres behaviour is covered by tests/integration/rls.integration.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { rlsPolicySql, rlsPolicyStatements, tenantStore, currentTenant, onBypass, reportBypass, BYPASS_TOKEN } from './tenancy.js';
import { databaseClass } from './index.js';

describe('rlsPolicyStatements', () => {
  it('enables, forces and (re)creates one policy', () => {
    const sql = rlsPolicyStatements({ table: 'invoices' });
    expect(sql).toHaveLength(4);
    expect(sql[0]).toBe('ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;');
    expect(sql[1]).toBe('ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;');
    expect(sql[2]).toBe('DROP POLICY IF EXISTS "tenant_isolation" ON "invoices";');
    expect(sql[3]).toContain(`"tenant_id"::text = current_setting('app.tenant_id', true)`);
    expect(sql[3]).toContain(`= '${BYPASS_TOKEN}'`);
    expect(sql[3]).toMatch(/USING \(.+\) WITH CHECK \(.+\);$/);
  });

  it('takes a column, policy name and schema', () => {
    const sql = rlsPolicySql({ table: 'students', column: 'collegeId', policy: 'college_isolation', schema: 'app' });
    expect(sql).toContain('ALTER TABLE "app"."students"');
    expect(sql).toContain('"collegeId"::text');
    expect(sql).toContain('CREATE POLICY "college_isolation"');
  });

  it('refuses anything that is not a plain identifier', () => {
    expect(() => rlsPolicySql({ table: 'x; DROP TABLE users' })).toThrow(/not a plain SQL identifier/);
    expect(() => rlsPolicySql({ table: 'ok', column: 'a"b' })).toThrow(/not a plain SQL identifier/);
  });
});

describe('tenant context', () => {
  it('is visible inside run() and gone outside it', async () => {
    expect(currentTenant()).toBeUndefined();
    await tenantStore.run({ tenantId: 't1' }, async () => {
      await Promise.resolve();
      expect(currentTenant()).toEqual({ tenantId: 't1' });
    });
    expect(currentTenant()).toBeUndefined();
  });

  it('reports bypasses to listeners and survives a failing one', () => {
    const seen: string[] = [];
    const offBad = onBypass(() => {
      throw new Error('audit down');
    });
    const off = onBypass(({ reason }) => seen.push(reason));
    reportBypass('nightly export');
    off();
    offBad();
    reportBypass('not seen');
    expect(seen).toEqual(['nightly export']);
  });
});

describe('database.context() binds a tenant only in tenant mode', () => {
  const run = (value: string | undefined) => {
    const saved = process.env.BLOOM_DB_TENANT;
    if (value === undefined) delete process.env.BLOOM_DB_TENANT;
    else process.env.BLOOM_DB_TENANT = value;
    try {
      let seen: string | undefined = 'next() not called';
      databaseClass.context()({ user: { tenantId: 't1' } }, {}, () => {
        seen = currentTenant()?.tenantId;
      });
      return seen;
    } finally {
      if (saved === undefined) delete process.env.BLOOM_DB_TENANT;
      else process.env.BLOOM_DB_TENANT = saved;
    }
  };

  it('binds the token tenant when BLOOM_DB_TENANT is on', () => {
    expect(run('auto')).toBe('t1');
    expect(run('rls')).toBe('t1');
  });

  it("binds nothing when it is unset or 'false' (cache keys and jobs stay unprefixed)", () => {
    expect(run(undefined)).toBeUndefined();
    expect(run('false')).toBeUndefined();
  });
});

describe('rlsPolicyStatements({ via }) scopes a child table through its parent', () => {
  it('checks the parent row\'s tenant column, keeps the bypass, and validates identifiers', () => {
    const [enable, force, drop, create] = rlsPolicyStatements({
      table: 'deployments',
      column: 'customerId',
      via: { parent: 'deploy_targets', foreignKey: 'deployTargetId' },
    });
    expect(enable).toBe('ALTER TABLE "deployments" ENABLE ROW LEVEL SECURITY;');
    expect(force).toBe('ALTER TABLE "deployments" FORCE ROW LEVEL SECURITY;');
    expect(drop).toBe('DROP POLICY IF EXISTS "tenant_isolation" ON "deployments";');
    expect(create).toContain(
      `EXISTS (SELECT 1 FROM "deploy_targets" bloom_parent WHERE bloom_parent."id" = "deployments"."deployTargetId" AND bloom_parent."customerId"::text = current_setting('app.tenant_id', true))`,
    );
    expect(create).toContain(`OR current_setting('app.tenant_id', true) = '${BYPASS_TOKEN}'`);
    expect(create).toMatch(/USING \(.+\) WITH CHECK \(.+\);$/);
    expect(() => rlsPolicyStatements({ table: 'c', via: { parent: 'p; DROP TABLE x', foreignKey: 'p_id' } })).toThrow(/via\.parent/);

    const [, , , grandchild] = rlsPolicyStatements({ table: 'reactions', via: { parent: 'comments', foreignKey: 'comment_id', column: false } });
    expect(grandchild).toContain('EXISTS (SELECT 1 FROM "comments" bloom_parent WHERE bloom_parent."id" = "reactions"."comment_id")');
    expect(grandchild).not.toContain('bloom_parent."tenant_id"');
  });
});
