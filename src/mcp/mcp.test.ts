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
  const CLASS_METHODS = ['get', 'disconnectAll', 'getToolCount'];
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
    r.register(tool({ name: 'public_read', roles: undefined }));
    r.register(tool({ name: 'staff_write', roles: ['user.basic'] }));
    r.register(tool({ name: 'admin_delete', roles: ['admin.tenant'] }));
    return r;
  };

  it('offers every tool when no role resolution is configured', () => {
    expect(reg().visibleTo(null).map((t) => t.name)).toEqual([
      'public_read',
      'staff_write',
      'admin_delete',
    ]);
  });

  it('hides tools the caller has no role for', () => {
    expect(reg().visibleTo('user.basic').map((t) => t.name)).toEqual(['public_read', 'staff_write']);
  });

  it('applies role inheritance (admin.system reaches admin.tenant)', () => {
    expect(reg().visibleTo('admin.system').map((t) => t.name)).toEqual([
      'public_read',
      'staff_write',
      'admin_delete',
    ]);
  });

  it('an unknown role still sees unrestricted tools only', () => {
    expect(reg().visibleTo('nonsense.role').map((t) => t.name)).toEqual(['public_read']);
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
      name: 'app', version: '1.0.0', roleLevel: null, ctx: {},
    });
    const out = await server.tools[0].handler({});
    expect(out.content[0].text).toBe('{"ok":1}');
  });

  it('passes an already-MCP-shaped result straight through', async () => {
    const r = new McpRegistryClass();
    r.register(tool({ handler: () => ({ content: [{ type: 'text', text: 'raw' }] }) }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app', version: '1.0.0', roleLevel: null, ctx: {},
    });
    const out = await server.tools[0].handler({});
    expect(out.content).toEqual([{ type: 'text', text: 'raw' }]);
  });

  it('turns a throwing handler into an error result, not a broken connection', async () => {
    const r = new McpRegistryClass();
    r.register(tool({ handler: () => { throw new Error('boom'); } }));
    const server: any = r.buildServer(FakeMcpServer as any, {
      name: 'app', version: '1.0.0', roleLevel: null, ctx: {},
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
      name: 'app', version: '1.0.0', roleLevel: null, ctx: { sub: 'u1', scope: 'mcp', roleLevel: null },
    });
    await server.tools[0].handler({});
    expect(seen.sub).toBe('u1');
  });
});

describe('OAuth authorization server', () => {
  const build = (authenticate = async () => ({ sub: 'u1', label: 'a@b.test' })) =>
    createMcpOAuth({ secret: OAUTH_SECRET, serviceName: 'Test App', authenticate }, fakeRouter);

  it('rejects a weak secret', () => {
    expect(() =>
      createMcpOAuth({ secret: 'short', serviceName: 'x', authenticate: async () => null }, fakeRouter)
    ).toThrow(/at least 32 characters/);
  });

  it('rejects a missing authenticate hook', () => {
    expect(() =>
      createMcpOAuth({ secret: OAUTH_SECRET, serviceName: 'x' } as any, fakeRouter)
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
      { secret: OAUTH_SECRET, serviceName: 'Test App', authenticate: async () => null },
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
