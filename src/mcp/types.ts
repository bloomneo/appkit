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
  /** `role.level` when a resolveRoles hook is configured, else null. */
  roleLevel: string | null;
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
   * Required role.level values, OR-ed, using the same inheritance as
   * auth.requireUserRoles() — ['admin.tenant'] also admits admin.system.
   *
   * A caller without the role never sees the tool in tools/list at all.
   * Only enforced when the router is given a resolveRoles hook.
   */
  roles?: string[];
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
