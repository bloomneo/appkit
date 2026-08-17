---
name: appkit-mcp
description: >-
  Use when exposing a Bloom app to AI agents as an MCP server via
  `@bloomneo/appkit/mcp` — a claude.ai custom connector or Claude Desktop tool
  source. Covers `mcp.routers()`, why discovery must be mounted at the ROOT,
  FBCA tool declaration, and per-tool roles.
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

- **The connection.** `authenticate()` runs at OAuth consent and is the only
  app-specific hook. The connection is exactly as privileged as what it
  returns, so reject non-admins there if that's your model.
- **The tool.** `roles` needs a `resolveRoles` hook. A caller without the role
  **never sees the tool in `tools/list`** rather than being refused on call.

## Public API

```ts
mcpClass.get() / .reset() / .disconnectAll() / .getToolCount()

mcp.register(tool) / mcp.registerAll([...])
await mcp.discover(featuresPath)
mcp.list() / mcp.getTools() / mcp.has(name)
await mcp.routers(options)          // → { wellKnown, mcp }
mcp.getConfig()
```

## Common mistakes

- **Mounting only `/mcp`.** See above — the connector cannot discover you.
- **JSON Schema in `inputSchema`.** The SDK wants a Zod raw shape.
- **Assuming tenant context exists.** MCP tools run outside the HTTP request
  path, so middleware that establishes tenant context never ran. Under
  Postgres `FORCE ROW LEVEL SECURITY` the write is refused in production while
  passing on a non-forcing dev database. Establish it inside the tool.
- **Expecting `roles` to work without `resolveRoles`.** Without that hook
  every registered tool is offered to every authorised connection.
