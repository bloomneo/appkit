# @bloomneo/appkit/mcp

Turn a Bloom app into an **MCP server** — a claude.ai custom connector, or a
Claude Desktop tool source — using the same FBCA convention the API router
already uses.

```ts
import { mcpClass } from '@bloomneo/appkit/mcp';

const mcp = mcpClass.get();
await mcp.discover(join(__dirname, 'features'));

app.use('/mcp', await mcp.router({
  serviceName: 'My App',
  authenticate: async (email, password) => {
    const user = await verify(email, password);
    return user ? { sub: user.id, label: user.email } : null;   // null rejects
  },
}));
```

That's the whole integration. You get the OAuth 2.1 authorization server the
connector flow requires, a Streamable-HTTP transport, and every feature's tools
registered automatically.

## Installation

Both peers are **optional** — the other appkit modules stay dependency-free,
and you only pay for these if you actually expose MCP:

```bash
npm install express @modelcontextprotocol/sdk
```

A missing peer throws at `mcp.router()` — at boot, with the install command in
the message — rather than on the first agent request.

## Declaring tools

Tools live next to the routes they complement:

```
src/api/features/invoice/
├── invoice.route.ts     # → /api/invoice   (mounted by api-router)
├── invoice.service.ts
└── invoice.mcp.ts       # → invoice_* tools (registered by mcp.discover)
```

```ts
// src/api/features/invoice/invoice.mcp.ts
import { z } from 'zod';
import type { McpTool } from '@bloomneo/appkit/mcp';
import { listInvoices } from './invoice.service.js';

export const tools: McpTool[] = [
  {
    name: 'list',                       // exposed as `invoice_list`
    description: "List invoices for the caller's firm, newest first.",
    inputSchema: {
      status: z.enum(['open', 'paid']).optional(),
      limit: z.number().int().min(1).max(50).optional().describe('Default 50'),
    },
    roles: ['user.basic'],
    handler: async (args, ctx) => listInvoices(ctx.sub, args),
  },
];
```

`inputSchema` is a **Zod raw shape**, not JSON Schema — that's what the SDK
expects. appkit passes it straight through and never inspects it, so appkit
takes no zod dependency of its own; you get zod transitively from the SDK.

Tool names are namespaced with the feature name automatically, so two features
can both expose `list` without colliding. `export default [...]` and
`export default { tools: [...] }` work identically. Names may contain letters,
numbers, underscore and hyphen only — clients map them onto function
identifiers.

Write the `description` for a reader with no other context: it is the only
thing the agent sees when choosing between tools.

## Authorization

Two layers.

**The connection.** `authenticate(email, password)` runs at OAuth consent time
and is the only app-specific hook. A connection is exactly as privileged as
whatever you return, so gate on role here — returning `null` for non-admins is
how you stop an agent inheriting more reach than you intended.

**The tool.** Pass `resolveRoles` to enable per-tool `roles`:

```ts
app.use('/mcp', await mcp.router({
  serviceName: 'My App',
  authenticate,
  resolveRoles: async (sub) => {
    const user = await db.user.findUnique({ where: { id: sub } });
    return user ? `${user.role}.${user.level}` : null;
  },
}));
```

`roles` is OR-ed and uses the same inheritance as `auth.requireUserRoles()`, so
`['admin.tenant']` also admits `admin.org` and `admin.system`. A caller without
the role **never sees the tool in `tools/list` at all** — better than offering
a tool that always refuses.

Without `resolveRoles`, every registered tool is offered to every authorised
connection, which is the right shape when `authenticate` already restricts the
connection to one role.

## How the OAuth layer works

claude.ai's connector flow needs exactly four things, and this ships all four:

| RFC | Endpoint |
|---|---|
| 9728 | `GET /.well-known/oauth-protected-resource` |
| 8414 | `GET /.well-known/oauth-authorization-server` |
| 7591 | `POST /register` (dynamic client registration) |
| OAuth 2.1 | `GET/POST /authorize`, `POST /token` |

Every artefact — client id, auth code, access and refresh token — is a signed
JWT, so nothing is stored server-side. That's the load-bearing decision: an app
running N workers in cluster mode would otherwise have to share codes, clients
and tokens across all of them. Here any worker can validate anything.

PKCE with S256 is required and there are no client secrets (public clients
only). Lifetimes: auth code 60s, access token 1h, refresh token 30d.

The transport is stateless too — a fresh `McpServer` per request, torn down
when the response closes — for the same reason.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BLOOM_MCP_OAUTH_SECRET` | falls back to `BLOOM_AUTH_SECRET` | Signs the OAuth JWTs (min 32 chars) |
| `BLOOM_MCP_NAME` | `npm_package_name` | Server name reported by `initialize` |
| `BLOOM_MCP_VERSION` | `1.0.0` | Server version reported by `initialize` (semver) |
| `BLOOM_MCP_PROTOCOL_VERSION` | `2025-06-18` | Fallback protocol version |
| `BLOOM_MCP_FEATURES_DIR` | `features` | Directory name scanned by `discover()` |

## API

```ts
const mcp = mcpClass.get();

mcp.register(tool)                     // add one tool
mcp.registerAll([tool, tool])          // add many
await mcp.discover(featuresPath)       // FBCA auto-discovery
mcp.list()                             // name + description pairs
mcp.getTools()
mcp.has(name)
await mcp.router({ serviceName, authenticate, resolveRoles?, secret? })
mcp.getConfig()

mcpClass.getToolCount()
mcpClass.disconnectAll()               // drop registry + config (tests)
```

## Common issues

**No tools registered.** `discover()` looks for
`features/<name>/<name>.mcp.ts` — the file must be named after its directory,
exactly like `<name>.route.ts`. Features without one are skipped silently;
features whose file throws are reported in the returned `failures` array and
logged, without aborting the rest of the scan.

**`MCP_MISSING_PEER` at boot.** Install `express` and
`@modelcontextprotocol/sdk` — see [Installation](#installation).

**Every request 401s with a `WWW-Authenticate` header.** That's correct: the
header points the client at the protected-resource metadata so it can start the
OAuth flow. Connect through the client's "add connector" flow rather than
calling the endpoint directly.

**A tool is missing from `tools/list`.** Either the caller's role doesn't
satisfy its `roles`, or `resolveRoles` returned null. Without `resolveRoles`,
`roles` is not enforced at all.

**OAuth secret rejected.** It must be at least 32 characters. Set
`BLOOM_MCP_OAUTH_SECRET`, or let it fall back to `BLOOM_AUTH_SECRET`.
