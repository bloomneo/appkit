/**
 * examples/mcp.ts
 *
 * Runnable tour of the @bloomneo/appkit/mcp module — turning the app into an
 * MCP server that a claude.ai custom connector can attach to.
 *
 * Prereqs:  npm install express @modelcontextprotocol/sdk  (optional peers)
 *           BLOOM_AUTH_SECRET set (min 32 chars) — signs the OAuth JWTs.
 * Run:      tsx examples/mcp.ts   → http://localhost:3000/mcp
 */

import express from 'express';
import { z } from 'zod';
import { mcpClass } from '@bloomneo/appkit/mcp';

const mcp = mcpClass.get();

// Tools normally live in features/<name>/<name>.mcp.ts and are picked up by
// `await mcp.discover(join(__dirname, 'features'))`. Registered inline here so
// the example runs standalone.
mcp.register({
  name: 'echo',
  description: 'Echo a message back. Replace with something your app can do.',
  inputSchema: { text: z.string().describe('Anything you want returned') },
  handler: async (args, ctx) => ({ echoed: args.text, calledBy: ctx.sub }),
});

const app = express();
app.use(express.json());

const { wellKnown, mcp: mcpRouter } = await mcp.routers({
  serviceName: 'AppKit Example',
  // The ONLY app-specific hook. The connection is exactly as privileged as
  // whatever this returns, so gate on role here — returning null rejects.
  authenticate: async (email, password) => {
    if (email === 'admin@example.test' && password === 'test1234') {
      return { sub: 'user-1', label: email };
    }
    return null;
  },
  // Optional: enables per-tool `roles`. Without it, every registered tool is
  // offered to every authorised connection.
  // resolveRoles: async (sub) => 'admin.tenant',
});

// ORDER MATTERS. Connector clients probe the discovery documents at the ROOT
// (/.well-known/oauth-authorization-server/mcp), not under the mount. If a SPA
// catch-all answers those paths first, the client gets HTML and reports
// "couldn't register" even though /mcp/register works when called directly.
app.use(wellKnown);
app.use('/mcp', mcpRouter);

app.listen(3000, () => {
  console.log('MCP server:      http://localhost:3000/mcp');
  console.log('AS metadata:     http://localhost:3000/.well-known/oauth-authorization-server/mcp');
  console.log(`tools registered: ${mcpClass.getToolCount()}`);
});
