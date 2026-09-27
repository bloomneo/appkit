/**
 * Shared types for the MCP module
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/types.ts
 *
 * @llm-rule WHEN: Declaring MCP tools in a feature's <feature>.mcp.ts file
 * @llm-rule AVOID: JSON Schema in inputSchema - the SDK expects a Zod raw shape
 * @llm-rule NOTE: A tool is a plain object; name, description and handler are the only required parts
 */

/**
 * The MCP SDK's expected input schema: a **Zod raw shape**, not JSON Schema.
 *
 * ```ts
 * inputSchema: {
 *   collegeId: z.string().describe('Tenant id from list_colleges'),
 *   limit: z.number().int().min(1).max(50).optional(),
 * }
 * ```
 *
 * Typed loosely on purpose — appkit passes it straight to the SDK and never
 * inspects it, so appkit takes no zod dependency of its own. Apps get zod
 * transitively from `@modelcontextprotocol/sdk`.
 */
export type McpInputSchema = Record<string, unknown>;

/** Who is behind an MCP tool invocation. */
export interface McpContext {
  /** OAuth subject — whatever `authenticate()` returned as `sub`. */
  sub: string;
  /** Granted OAuth scope. */
  scope: string;
  /** The caller's `role.level`, from the router's resolveRoles hook. */
  roleLevel: string | null;
  /**
   * The caller's tenant, from the router's resolveTenant hook. The handler
   * already runs inside it — database calls are scoped to it. Null for a
   * caller with no tenant (e.g. platform staff): database calls then need
   * `database.bypass(reason, fn)`.
   */
  tenantId: string | null;
}

export interface McpTool {
  /**
   * Tool name as the agent sees it. Discovered tools are automatically
   * prefixed with their feature name (`invoice_list`) unless already prefixed.
   */
  name: string;
  /** Optional human title. Defaults to the name. */
  title?: string;
  /** Shown to the agent when choosing a tool. Write it for a reader with no other context. */
  description: string;
  /** Zod raw shape describing the arguments. Omit for a no-argument tool. */
  inputSchema?: McpInputSchema;
  /**
   * REQUIRED: who may call this tool — role.level values, OR-ed, with the same
   * inheritance as auth.requireUserRoles() (['admin.tenant'] also admits
   * admin.system). ['user.basic'] admits every signed-in role.
   *
   * There is no default, as with a route contract's `auth`: a tool that
   * forgets it does not compile and is refused at registration. A caller
   * without the role never sees the tool in tools/list.
   */
  roles: string[];
  handler: (args: Record<string, any>, ctx: McpContext) => Promise<unknown> | unknown;
}

/** What a feature's `<feature>.mcp.ts` may export. */
export interface McpFeatureModule {
  default?: McpTool[] | { tools: McpTool[] };
  tools?: McpTool[];
}

/** Name + description pair, for health checks and debugging. */
export interface McpToolDescriptor {
  name: string;
  description: string;
}
