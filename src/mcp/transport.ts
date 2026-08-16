/**
 * Streamable-HTTP transport for MCP, with a bearer-token guard
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/transport.ts
 *
 * @llm-rule WHEN: Internal - mcp.router() composes this behind the OAuth layer
 * @llm-rule AVOID: Sharing one McpServer across requests - a session would pin a worker
 * @llm-rule NOTE: Stateless by design, so any worker in a cluster can serve any request
 *
 * A fresh McpServer + transport are built per request and torn down when the
 * response closes (sessionIdGenerator: undefined). No session lives in memory,
 * which is the same reason the OAuth layer issues stateless JWTs.
 *
 * Extracted from a production deployment serving a live claude.ai connector.
 */

export interface McpTransportConfig {
  /** Builds a fresh, fully-configured server for one request. */
  buildServer: (auth: { sub: string; scope: string }) => any;
  /** Validate a bearer token; return the subject/scope or null. */
  verifyAccessToken: (token: string) => { sub: string; scope: string } | null;
  /**
   * Absolute URL of the protected-resource metadata, advertised in the 401
   * WWW-Authenticate header so the client can discover the auth server.
   */
  resourceMetadataUrl: (req: any) => string;
}

export interface McpTransportPeers {
  Router: () => any;
  StreamableHTTPServerTransport: new (opts: { sessionIdGenerator: undefined }) => any;
}

function bearer(req: any): string | null {
  const h = req?.headers?.authorization;
  if (!h || !/^Bearer\s+/i.test(h)) return null;
  return h.replace(/^Bearer\s+/i, '').trim() || null;
}

export function createMcpTransport(config: McpTransportConfig, peers: McpTransportPeers): any {
  const router = peers.Router();

  // Every MCP call is authenticated. On failure we point the client at the
  // protected-resource metadata per RFC 9728 so it can start the OAuth flow.
  const guard = (req: any, res: any): { sub: string; scope: string } | null => {
    const token = bearer(req);
    const auth = token ? config.verifyAccessToken(token) : null;
    if (!auth) {
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${config.resourceMetadataUrl(req)}"`);
      res.status(401).json({ error: 'unauthorized', error_description: 'A valid access token is required.' });
      return null;
    }
    return auth;
  };

  const handle = async (req: any, res: any) => {
    const auth = guard(req, res);
    if (!auth) return;

    // Stateless: one server + transport per request, closed on response end.
    const server = config.buildServer(auth);
    const transport = new peers.StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      // req.body is already parsed by the app's json middleware; hand it in so
      // the transport doesn't try to re-read the consumed stream.
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
      }
    }
  };

  router.post('/', handle);
  // GET/DELETE drive the SSE-style streaming leg; in stateless mode there is no
  // standing stream, so answer 405 rather than opening one.
  router.get('/', (req: any, res: any) => {
    if (guard(req, res)) res.status(405).json({ error: 'method_not_allowed' });
  });
  router.delete('/', (req: any, res: any) => {
    if (guard(req, res)) res.status(405).json({ error: 'method_not_allowed' });
  });

  return router;
}
