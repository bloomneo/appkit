/**
 * The tenant middleware writes the tenant id in the column's own type: an
 * Int tenant column (bloomneo-cloud's customerId) gets a number, not "1".
 */
import { describe, it, expect } from 'vitest';
import { PrismaAdapter } from './prisma.js';

function fakeClient(type: string) {
  let ext: any;
  const client: any = {
    _runtimeDataModel: { models: { Target: { fields: [{ name: 'id', type: 'Int' }, { name: 'customerId', type }] } } },
    $extends(e: any) {
      ext = e;
      return client;
    },
  };
  const run = (operation: string, args: any) =>
    ext.query.$allModels.$allOperations({ model: 'Target', operation, args, query: (a: any) => a });
  return { client, run };
}

async function scoped(type: string, tenantId: string) {
  const { client, run } = fakeClient(type);
  await new PrismaAdapter({}).applyTenantMiddleware(client, () => ({ tenantId }), { fieldName: 'customerId' });
  return run;
}

describe('tenant middleware: tenant id in the column type', () => {
  it('Int columns get a number in filters and in created rows', async () => {
    const run = await scoped('Int', '7');
    expect((await run('findMany', {})).where).toEqual({ customerId: 7 });
    expect((await run('findUnique', { where: { id: 1 } })).where).toEqual({ id: 1, customerId: 7 });
    expect((await run('create', { data: { name: 'x' } })).data).toEqual({ name: 'x', customerId: 7 });
  });

  it('BigInt columns get a bigint; String columns keep the string', async () => {
    expect((await (await scoped('BigInt', '7'))('findMany', {})).where).toEqual({ customerId: 7n });
    expect((await (await scoped('String', '7'))('findMany', {})).where).toEqual({ customerId: '7' });
  });

  it('refuses a tenant id that is not an integer for an Int column', async () => {
    const run = await scoped('Int', 'acme');
    await expect(run('findMany', {})).rejects.toThrow(/not an integer/);
  });
});
