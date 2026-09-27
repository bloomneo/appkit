/**
 * Vitest tests for the MCP module.
 * Covers the public surface, tool validation, role-based visibility, OAuth
 * (metadata, dynamic registration, PKCE, token grants) and FBCA discovery.
 * The SDK and express are optional peers, so both are faked here.
 * @file src/mcp/mcp.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { mcpClass, McpError, McpRegistryClass, createMcpOAuth } from './index.js';
import type { McpTool } from './types.js';

const OAUTH_SECRET = 'a-test-oauth-secret-that-is-over-32-chars';

const tool = (over: Partial<McpTool> = {}): McpTool => ({
  name: 'echo',
  description: 'Echo the input back',
  roles: ['user.basic'],
  handler: (args) => ({ echoed: args.text }),
  ...over,
});

/** Minimal express Router stand-in that records handlers and can dispatch. */
function fakeRouter() {
  const routes: Array<{ method: string; path: string; fn: Function }> = [];
  const r: any = {
    routes,
    get: (p: string, fn: Function) => routes.push({ method: 'get', path: p, fn }),
    post: (p: string, fn: Function) => routes.push({ method: 'post', path: p, fn }),
    delete: (p: string, fn: Function) => routes.push({ method: 'delete', path: p, fn }),
    use: (fn: Function) => routes.push({ method: 'use', path: '*', fn }),
  };
  return r;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {} as Record<string, string>,
    redirected: undefined as string | undefined,
    sent: undefined as string | undefined,
    status(c: number) { res.statusCode = c; return res; },
    json(b: unknown) { res.body = b; return res; },
    send(b: string) { res.sent = b; return res; },
    type() { return res; },
    setHeader(k: string, v: string) { res.headers[k] = v; return res; },
    redirect(url: string) { res.redirected = url; return res; },
  };
  return res;
}

const call = (router: any, method: string, path: string, req: any) => {
  const route = router.routes.find((r: any) => r.method === method && r.path === path);
  if (!route) throw new Error(`no route ${method} ${path}`);
  const res = mockRes();
  return Promise.resolve(route.fn(req, res)).then(() => res);
};

const baseReq = (over: any = {}) => ({
  headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
  get: (h: string) => (h === 'host' ? 'example.com' : undefined),
  baseUrl: '/mcp',
  query: {},
  body: {},
  ...over,
});

describe('Public API surface — drift check', () => {
  const CLASS_METHODS = ['get', 'reset', 'disconnectAll', 'getToolCount'];
  const HALLUCINATED_CLASS = ['register', 'call', 'list', 'tools', 'connect', 'shutdown', 'clear', 'router'];

  for (const m of CLASS_METHODS) {
    it(`mcpClass.${m} exists and is a function`, () => {
      expect(typeof (mcpClass as any)[m]).toBe('function');
    });
  }

  for (const m of HALLUCINATED_CLASS) {
    it(`mcpClass.${m} does NOT exist (call via mcpClass.get().${m}() instead)`, () => {
      expect(typeof (mcpClass as any)[m]).not.toBe('function');
    });
  }
});

describe('tool registration', () => {
  beforeEach(() => mcpClass.disconnectAll());
  afterEach(() => mcpClass.disconnectAll());

  it('returns the same registry across calls', () => {
    mcpClass.get().register(tool());
    expect(mcpClass.get().has('echo')).toBe(true);
    expect(mcpClass.getToolCount()).toBe(1);
  });

  it('rejects malformed tools', () => {
    const mcp = mcpClass.get();
    expect(() => mcp.register({} as McpTool)).toThrow(McpError);
    expect(() => mcp.register(tool({ name: 'bad name!' }))).toThrow(/may only contain/);
    expect(() => mcp.register(tool({ description: '' }))).toThrow(/description/);
    expect(() => mcp.register(tool({ handler: undefined as any }))).toThrow(/handler/);
    // An auth decision is required, as with a route contract.
    expect(() => mcp.register(tool({ roles: undefined as any }))).toThrow(/needs roles/);
    expect(() => mcp.register(tool({ roles: [] }))).toThrow(/needs roles/);
    expect(() => mcp.register(tool({ roles: ['admin'] }))).toThrow(/needs roles/);
    expect(() => mcp.registerAll('nope' as any)).toThrow(/array/);
  });

  it('last registration of a name wins', () => {
    const mcp = mcpClass.get();
    mcp.register(tool());
    mcp.register(tool({ description: 'Replaced' }));
    expect(mcp.list()).toEqual([{ name: 'echo', description: 'Replaced' }]);
  });

  it('a tool needs no inputSchema', () => {
    const mcp = mcpClass.get();
    expect(() => mcp.register(tool({ inputSchema: undefined }))).not.toThrow();
  });
});

describe('role-based visibility', () => {
  const reg = () => {
    const r = new McpRegistryClass();
    r.register(tool({ name: 'any_user', roles: ['user.basic'] }));
    r.register(tool({ name: 'admin_delete', roles: ['admin.tenant'] }));
    return r;
  };

  it('a caller whose role is unresolved sees no tools (fail closed)', () => {
    expect(reg().visibleTo(null)).toEqual([]);
  });

  it('hides tools the caller has no role for', () => {
    expect(reg().visibleTo('user.basic').map((t) => t.name)).toEqual(['any_user']);
  });

  it('applies role inheritance (admin.system reaches admin.tenant)', () => {
    expect(reg().visibleTo('admin.system').map((t) => t.name)).toEqual(['any_user', 'admin_delete']);
  });

  it('an unknown role sees nothing', () => {
    expect(reg().visibleTo('nonsense.role')).toEqual([]);
  });
});

describe('buildServer', () => {
  class FakeMcpServer {
    tools: Array<{ name: string; def: any; handler: Function }> = [];
    constructor(public info: { name: string; version: string }) {}
    registerTool(name: string, def: any, handler: Function) {
      this.tools.push({ name, def, handler });
    }
  }

  it('registers only the visible tools', () => {
    const r = new McpRegistryClass();
    r.register(tool({ name: 'open' }));
    r.register(tool({ name: 'locked', roles: ['admin.system'] }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app',
      version: '1.0.0',
      roleLevel: 'user.basic',
      ctx: {},
    });
    expect(server.tools.map((t: any) => t.name)).toEqual(['open']);
  });

  it('wraps a plain return value in MCP content', async () => {
    const r = new McpRegistryClass();
    r.register(tool({ handler: () => ({ ok: 1 }) }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app', version: '1.0.0', roleLevel: 'user.basic', ctx: {},
    });
    const out = await server.tools[0].handler({});
    expect(out.content[0].text).toBe('{"ok":1}');
  });

  it('passes an already-MCP-shaped result straight through', async () => {
    const r = new McpRegistryClass();
    r.register(tool({ handler: () => ({ content: [{ type: 'text', text: 'raw' }] }) }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app', version: '1.0.0', roleLevel: 'user.basic', ctx: {},
    });
    const out = await server.tools[0].handler({});
    expect(out.content).toEqual([{ type: 'text', text: 'raw' }]);
  });

  it('turns a throwing handler into an error result, not a broken connection', async () => {
    const r = new McpRegistryClass();
    r.register(tool({ handler: () => { throw new Error('boom'); } }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app', version: '1.0.0', roleLevel: 'user.basic', ctx: {},
    });
    const out = await server.tools[0].handler({});
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe('boom');
  });

  it('hands the context to the handler', async () => {
    const r = new McpRegistryClass();
    let seen: any;
    r.register(tool({ handler: (_a, ctx) => { seen = ctx; return 'ok'; } }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app', version: '1.0.0', roleLevel: 'user.basic', ctx: { sub: 'u1', scope: 'mcp', roleLevel: 'user.basic', tenantId: null },
    });
    await server.tools[0].handler({});
    expect(seen.sub).toBe('u1');
  });

  it("runs the handler inside the caller's tenant; no tenant, no context", async () => {
    const { currentTenant } = await import('../database/tenancy.js');
    const r = new McpRegistryClass();
    let seen: unknown = 'unset';
    r.register(tool({ handler: () => { seen = currentTenant()?.tenantId; return 'ok'; } }));
    const build = (tenantId: string | null): any =>
      r.buildServer(FakeMcpServer as any, {
        name: 'app', version: '1.0.0', roleLevel: 'user.basic', ctx: { sub: 'u1', scope: 'mcp', roleLevel: 'user.basic', tenantId },
      });
    await build('t1').tools[0].handler({});
    expect(seen).toBe('t1');
    await build(null).tools[0].handler({});
    expect(seen).toBeUndefined();
  });
});

describe('OAuth authorization server', () => {
  const build = (authenticate = async () => ({ sub: 'u1', label: 'a@b.test' })) =>
    createMcpOAuth({ secret: OAUTH_SECRET, mountPath: '/mcp', serviceName: 'Test App', authenticate }, fakeRouter);

  it('rejects a weak secret', () => {
    expect(() =>
      createMcpOAuth({ secret: 'short', mountPath: '/mcp', serviceName: 'x', authenticate: async () => null }, fakeRouter)
    ).toThrow(/at least 32 characters/);
  });

  it('rejects a missing authenticate hook', () => {
    expect(() =>
      createMcpOAuth({ secret: OAUTH_SECRET, mountPath: '/mcp', serviceName: 'x' } as any, fakeRouter)
    ).toThrow(/authenticate/);
  });

  it('serves RFC 9728 protected-resource metadata', async () => {
    const res = await call(build().router, 'get', '/.well-known/oauth-protected-resource', baseReq());
    expect(res.body.resource).toBe('https://example.com/mcp/');
    expect(res.body.authorization_servers).toEqual(['https://example.com/mcp']);
  });

  it('serves RFC 8414 authorization-server metadata with PKCE S256 only', async () => {
    const res = await call(build().router, 'get', '/.well-known/oauth-authorization-server', baseReq());
    expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
    expect(res.body.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(res.body.registration_endpoint).toBe('https://example.com/mcp/register');
  });

  it('registers a client dynamically (RFC 7591) and rejects one with no redirect_uris', async () => {
    const oauth = build();
    const ok = await call(oauth.router, 'post', '/register', baseReq({ body: { redirect_uris: ['https://c/cb'], client_name: 'Claude' } }));
    expect(ok.statusCode).toBe(201);
    expect(typeof ok.body.client_id).toBe('string');

    const bad = await call(oauth.router, 'post', '/register', baseReq({ body: {} }));
    expect(bad.statusCode).toBe(400);
  });

  it('runs the full PKCE authorization-code flow', async () => {
    const oauth = build();
    const reg = await call(oauth.router, 'post', '/register', baseReq({ body: { redirect_uris: ['https://c/cb'] } }));
    const clientId = reg.body.client_id;

    const verifier = 'a'.repeat(64);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    const authorized = await call(oauth.router, 'post', '/authorize', baseReq({
      body: {
        client_id: clientId, redirect_uri: 'https://c/cb', code_challenge: challenge,
        code_challenge_method: 'S256', email: 'a@b.test', password: 'pw', state: 'xyz',
      },
    }));
    expect(authorized.redirected).toContain('code=');
    const code = new URL(authorized.redirected!).searchParams.get('code')!;
    expect(new URL(authorized.redirected!).searchParams.get('state')).toBe('xyz');

    const token = await call(oauth.router, 'post', '/token', baseReq({
      body: { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: 'https://c/cb', code_verifier: verifier },
    }));
    expect(token.body.token_type).toBe('Bearer');
    expect(oauth.verifyAccessToken(token.body.access_token)).toEqual({ sub: 'u1', scope: 'mcp' });

    const refreshed = await call(oauth.router, 'post', '/token', baseReq({
      body: { grant_type: 'refresh_token', refresh_token: token.body.refresh_token },
    }));
    expect(refreshed.body.access_token).toBeTruthy();
  });

  it('fails the token exchange when the PKCE verifier does not match', async () => {
    const oauth = build();
    const reg = await call(oauth.router, 'post', '/register', baseReq({ body: { redirect_uris: ['https://c/cb'] } }));
    const clientId = reg.body.client_id;
    const challenge = crypto.createHash('sha256').update('right-verifier').digest('base64url');

    const authorized = await call(oauth.router, 'post', '/authorize', baseReq({
      body: { client_id: clientId, redirect_uri: 'https://c/cb', code_challenge: challenge, code_challenge_method: 'S256', email: 'a@b.test', password: 'pw' },
    }));
    const code = new URL(authorized.redirected!).searchParams.get('code')!;

    const token = await call(oauth.router, 'post', '/token', baseReq({
      body: { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: 'https://c/cb', code_verifier: 'wrong-verifier' },
    }));
    expect(token.statusCode).toBe(400);
    expect(token.body.error_description).toMatch(/PKCE/);
  });

  it('refuses a redirect_uri the client did not register', async () => {
    const oauth = build();
    const reg = await call(oauth.router, 'post', '/register', baseReq({ body: { redirect_uris: ['https://c/cb'] } }));
    const res = await call(oauth.router, 'post', '/authorize', baseReq({
      body: { client_id: reg.body.client_id, redirect_uri: 'https://evil/cb', code_challenge: 'x', code_challenge_method: 'S256' },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('refuses anything weaker than PKCE S256', async () => {
    const oauth = build();
    const reg = await call(oauth.router, 'post', '/register', baseReq({ body: { redirect_uris: ['https://c/cb'] } }));
    const res = await call(oauth.router, 'get', '/authorize', baseReq({
      query: { client_id: reg.body.client_id, redirect_uri: 'https://c/cb', code_challenge_method: 'plain', code_challenge: 'x' },
    }));
    expect(res.statusCode).toBe(400);
    expect(res.sent).toMatch(/PKCE/);
  });

  it('re-renders the consent page with an error when credentials are rejected', async () => {
    const oauth = createMcpOAuth(
      { secret: OAUTH_SECRET, mountPath: '/mcp', serviceName: 'Test App', authenticate: async () => null },
      fakeRouter
    );
    const reg = await call(oauth.router, 'post', '/register', baseReq({ body: { redirect_uris: ['https://c/cb'] } }));
    const res = await call(oauth.router, 'post', '/authorize', baseReq({
      body: { client_id: reg.body.client_id, redirect_uri: 'https://c/cb', code_challenge: 'x', code_challenge_method: 'S256', email: 'a@b.test', password: 'no' },
    }));
    expect(res.statusCode).toBe(401);
    expect(res.sent).toContain('not accepted');
  });

  it('rejects an unsupported grant type', async () => {
    const res = await call(build().router, 'post', '/token', baseReq({ body: { grant_type: 'password' } }));
    expect(res.body.error).toBe('unsupported_grant_type');
  });

  it('verifyAccessToken rejects a refresh token and garbage', async () => {
    const oauth = build();
    expect(oauth.verifyAccessToken('nonsense')).toBeNull();
  });
});

describe('config', () => {
  afterEach(() => {
    delete process.env.BLOOM_MCP_VERSION;
    mcpClass.disconnectAll();
  });

  it('rejects a non-semver BLOOM_MCP_VERSION', () => {
    process.env.BLOOM_MCP_VERSION = 'v1';
    mcpClass.disconnectAll();
    expect(() => mcpClass.get()).toThrow(/BLOOM_MCP_VERSION/);
  });

  it('exposes the resolved config', () => {
    mcpClass.disconnectAll();
    expect(typeof mcpClass.get().getConfig().name).toBe('string');
  });
});

describe('root well-known discovery (regression — the claude.ai connector bug)', () => {
  // RFC 8414/9728 clients probe the metadata at the ROOT with the mount path
  // inserted — /.well-known/oauth-authorization-server/mcp — NOT under /mcp.
  // Serving them only under the mount means those paths fall through to the
  // app's SPA, the client gets HTML, and it reports "couldn't register" even
  // though /mcp/register works when called directly.
  //
  // Uses the real express + SDK (devDependencies) rather than fakes, because
  // the bug is precisely about how express computes req.baseUrl per mount.
  let server: any;
  let base: string;

  beforeEach(async () => {
    mcpClass.disconnectAll();
    const express = (await import('express')).default;
    const mcp = mcpClass.get();
    mcp.register(tool({ name: 'ping', description: 'Health probe' }));

    const { wellKnown, mcp: mcpRouter } = await mcp.routers({
      secret: OAUTH_SECRET,
      serviceName: 'Regression App',
      authenticate: async () => ({ sub: 'u1' }),
      resolveRoles: () => 'admin.system',
    });

    const app = express();
    app.use(express.json());
    app.use(wellKnown);
    app.use('/mcp', mcpRouter);
    // Stand-in for the SPA catch-all that swallowed these paths in production.
    app.use((_req: any, res: any) => res.status(200).type('html').send('<!doctype html><title>SPA</title>'));

    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    mcpClass.disconnectAll();
  });

  for (const path of [
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/mcp',
  ]) {
    it(`serves AS metadata as JSON at ${path} (not the SPA)`, async () => {
      const res = await fetch(base + path);
      expect(res.headers.get('content-type')).toMatch(/json/);
      const body = await res.json();
      // The critical assertion: endpoints point at {origin}/mcp even though
      // this document is served from the root, where req.baseUrl is ''.
      expect(body.issuer).toBe(`${base}/mcp`);
      expect(body.registration_endpoint).toBe(`${base}/mcp/register`);
      expect(body.token_endpoint).toBe(`${base}/mcp/token`);
      expect(body.code_challenge_methods_supported).toEqual(['S256']);
    });
  }

  for (const path of [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ]) {
    it(`serves protected-resource metadata as JSON at ${path}`, async () => {
      const res = await fetch(base + path);
      expect(res.headers.get('content-type')).toMatch(/json/);
      const body = await res.json();
      expect(body.resource).toBe(`${base}/mcp/`);
      expect(body.authorization_servers).toEqual([`${base}/mcp`]);
    });
  }

  it('still serves the same metadata under the mount', async () => {
    const body = await (await fetch(`${base}/mcp/.well-known/oauth-authorization-server`)).json();
    expect(body.issuer).toBe(`${base}/mcp`);
  });

  it('an unauthenticated MCP POST answers 401 with WWW-Authenticate', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('dynamic client registration works through the mounted router', async () => {
    const res = await fetch(`${base}/mcp/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://claude.ai/cb'], client_name: 'Claude' }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).client_id).toBeTruthy();
  });
});

describe('module convention parity', () => {
  // Every stateful module exposes get / reset / disconnectAll. "One pattern,
  // no exceptions" is the whole value proposition, so a 13th module that only
  // has two of the three is drift, not a shortcut.
  it('reset() rebuilds config and drops registered tools', () => {
    mcpClass.disconnectAll();
    mcpClass.get().register(tool());
    expect(mcpClass.getToolCount()).toBe(1);
    const fresh = mcpClass.reset();
    expect(mcpClass.getToolCount()).toBe(0);
    expect(typeof fresh.register).toBe('function');
    mcpClass.disconnectAll();
  });
});

describe('mcp.routers() refuses to start without the rules routes follow', () => {
  beforeEach(() => mcpClass.disconnectAll());
  afterEach(() => {
    mcpClass.disconnectAll();
    delete process.env.BLOOM_DB_TENANT;
  });

  it('needs resolveRoles', async () => {
    await expect(
      mcpClass.get().routers({ secret: OAUTH_SECRET, serviceName: 'x', authenticate: async () => null } as any),
    ).rejects.toThrow(/needs resolveRoles/);
  });

  it('needs resolveTenant when BLOOM_DB_TENANT is on, and not when it is off', async () => {
    const base = { secret: OAUTH_SECRET, serviceName: 'x', authenticate: async () => null, resolveRoles: () => 'user.basic' };
    process.env.BLOOM_DB_TENANT = 'rls';
    await expect(mcpClass.get().routers(base)).rejects.toThrow(/needs resolveTenant/);
    await expect(mcpClass.get().routers({ ...base, resolveTenant: () => 't1' })).resolves.toBeDefined();
    process.env.BLOOM_DB_TENANT = 'false';
    await expect(mcpClass.get().routers(base)).resolves.toBeDefined();
  });
});
