/**
 * FBCA tool discovery — the same convention api-router uses, for MCP tools
 * @module @bloomneo/appkit/mcp
 * @file src/mcp/discovery.ts
 *
 * @llm-rule WHEN: You want every feature's tools registered without a manifest
 * @llm-rule AVOID: Importing feature .mcp.ts files by hand - that is the manifest you were avoiding
 * @llm-rule NOTE: Convention is features/<name>/<name>.mcp.ts, mirroring <name>.route.ts
 */
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
function extractTools(mod) {
    // Accept `export default [...]`, `export default { tools: [...] }`, and
    // `export const tools = [...]`. All three read naturally; picking one and
    // rejecting the others just creates a failure mode with no upside.
    if (Array.isArray(mod.tools))
        return mod.tools;
    const def = mod.default;
    if (Array.isArray(def))
        return def;
    if (def && typeof def === 'object' && Array.isArray(def.tools)) {
        return def.tools;
    }
    return [];
}
/**
 * Namespace a tool so two features can both expose `list` without colliding.
 * A name that already starts with the feature prefix is left alone, so an
 * author who wrote the full name explicitly gets what they wrote.
 */
function namespaced(feature, name) {
    return name === feature || name.startsWith(`${feature}_`) || name.startsWith(`${feature}.`)
        ? name
        : `${feature}_${name}`;
}
/**
 * Scan a features directory and collect every declared tool.
 *
 * A feature whose tool file throws is recorded in `failures` rather than
 * aborting the scan — one broken feature shouldn't cost you every other
 * feature's tools, the same way api-router keeps mounting after a bad route.
 */
export async function discoverTools(featuresPath) {
    const result = { tools: [], failures: [], skipped: [] };
    if (!existsSync(featuresPath)) {
        return result;
    }
    const entries = await readdir(featuresPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const feature = entry.name;
        const candidate = [
            join(featuresPath, feature, `${feature}.mcp.ts`),
            join(featuresPath, feature, `${feature}.mcp.js`),
        ].find((f) => existsSync(f));
        if (!candidate) {
            result.skipped.push(feature);
            continue;
        }
        try {
            const mod = (await import(pathToFileURL(candidate).href));
            const tools = extractTools(mod);
            for (const tool of tools) {
                result.tools.push({ ...tool, name: namespaced(feature, tool.name) });
            }
        }
        catch (error) {
            result.failures.push({
                feature,
                file: candidate,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return result;
}
//# sourceMappingURL=discovery.js.map