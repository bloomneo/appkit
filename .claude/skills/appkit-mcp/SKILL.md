---
name: appkit-mcp
description: >-
  Use when exposing a Bloom app to AI agents as an MCP server via
  `@bloomneo/appkit/mcp` — a claude.ai custom connector or Claude Desktop tool
  source. Covers `mcp.routers()`, why discovery must be mounted at the ROOT,
  FBCA tool declaration, required per-tool roles, and tools running in the
  caller's tenant.
---

# @bloomneo/appkit/mcp

Turns the app into an MCP server: OAuth 2.1 authorization server, a
Streamable-HTTP transport, and FBCA tool discovery.

```ts
import { mcpClass } from '@bloomneo/appkit/mcp';

const mcp = mcpClass.get();
await mcp.discover(join(__dirname, 'features'));   // features/<n>/<n>.mcp.ts

const { wellKnown, mcp: mcpRouter } = await mcp.routers({
  serviceName: 'My App',
  authenticate: async (email, password) => {
    const user = await verify(email, password);
    return user ? { sub: user.id, label: user.email } : null;   // null rejects
  },
  resolveRoles: async (sub) => {                                  // REQUIRED
    const user = await getUser(sub);
    return user ? `${user.role}.${user.level}` : null;             // null: no tools
  },
  resolveTenant: async (sub) => (await getUser(sub))?.tenantId ?? null,  // REQUIRED with BLOOM_DB_TENANT
});

app.use(wellKnown);          // ROOT — MUST be before any SPA catch-all
app.use('/mcp', mcpRouter);
```

## Two mounts, not one — this is the one that bites

RFC 8414/9728 clients probe the discovery documents at the **root** with the
mount path inserted:

```
/.well-known/oauth-authorization-server/mcp     ← where the client looks
/mcp/.well-known/oauth-authorization-server     ← NOT where it looks
```

Mount only under `/mcp` and those root paths fall through to your SPA. The
client gets HTML and reports *"couldn't register with your sign-in service"* —
while `/mcp/register` works perfectly when called directly. That symptom is
confusing enough to cost an afternoon.

Behind a reverse proxy, route `/.well-known/oauth-*` to the app too.

## Installation

`express` and `@modelcontextprotocol/sdk` are **optional peers**:

```bash
npm install express @modelcontextprotocol/sdk
```

A missing peer throws at `mcp.routers()` — at boot, with the install command.

## Declaring tools

Tools sit beside the routes they complement, mirroring `<n>.route.ts`:

```ts
// src/api/features/invoice/invoice.mcp.ts
import { z } from 'zod';
import type { McpTool } from '@bloomneo/appkit/mcp';

export const tools: McpTool[] = [
  {
    name: 'list',                      // exposed as `invoice_list`
    description: "List invoices for the caller's firm, newest first.",
    inputSchema: { status: z.enum(['open', 'paid']).optional() },
    roles: ['user.basic'],
    handler: async (args, ctx) => listInvoices(ctx.sub, args),
  },
];
```

`inputSchema` is a **Zod raw shape**, not JSON Schema — that's what the SDK
expects. Names are namespaced by feature automatically.

## Authorization — two layers

The same rules a route contract enforces: an auth decision for every tool,
and the caller's tenant for every call.

- **The connection.** `authenticate()` runs at OAuth consent. The connection
  is exactly as privileged as what it returns, so reject non-admins there if
  that's your model.
- **The tool.** Every tool declares `roles` — required, like a contract's
  `auth`; `register()` throws `MCP_TOOL_NO_ROLES` without a non-empty array of
  `role.level` strings. `['user.basic']` admits every signed-in role; there is
  no unrestricted tool. `routers()` requires `resolveRoles(sub)`
  (`MCP_NO_ROLE_RESOLVER`). A caller without the role **never sees the tool in
  `tools/list`**; a caller resolved to null (or whose resolver throws) sees no
  tools.

## Tenants

With `BLOOM_DB_TENANT` on, `routers()` requires `resolveTenant(sub)`
(`MCP_NO_TENANT_RESOLVER`). Every handler runs inside the caller's tenant,
like a route behind `database.context()`, so its database calls are scoped
and row-level security applies. `ctx.tenantId` names the tenant. A caller
resolved to null (platform staff) gets no tenant context: their tools'
queries fail closed unless the tool uses `database.bypass('reason', fn)`.

## Public API

```ts
mcpClass.get() / .reset() / .disconnectAll() / .getToolCount()

mcp.register(tool) / mcp.registerAll([...])
await mcp.discover(featuresPath)
mcp.list() / mcp.getTools() / mcp.has(name)
await mcp.routers({ serviceName, authenticate, resolveRoles, resolveTenant?, mountPath?, secret? })
                                    // → { wellKnown, mcp }
mcp.getConfig()
```

## Common mistakes

- **Mounting only `/mcp`.** See above — the connector cannot discover you.
- **JSON Schema in `inputSchema`.** The SDK wants a Zod raw shape.
- **A tool without `roles`.** Refused at compile time and at registration.
  Don't reach for an empty array — `['user.basic']` is "any signed-in caller".
- **Calling `routers()` without `resolveRoles`.** It throws at boot; roles
  are never silently unenforced.
- **Setting tenant context inside the tool.** The handler already runs in the
  caller's tenant. For deliberate cross-tenant access, use
  `database.bypass('reason', fn)` in that tool.
