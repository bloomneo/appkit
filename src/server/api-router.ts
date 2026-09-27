/**
 * Feature auto-discovery for Bloom APIs: `features/<name>/<name>.route.ts`
 * is mounted at `/api/<name>`, and a feature that default-exports a
 * contractRouter() is mounted at the paths its contracts declare.
 *
 * Every Bloom app used to carry a copy of this router, and every production
 * app had added the same workarounds to its copy. It lives here now:
 *
 * ```ts
 * app.use('/api', await createApiRouter({ featuresDir: join(__dirname, 'features') }));
 * ```
 *
 * At boot it reports, once each:
 *   - a feature whose routes have no auth guard and don't declare isPublic;
 *   - sibling *.route.ts files that are never mounted;
 *   - a feature that failed to load, with the real error;
 *   - a feature folder with no route file.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadExpress } from './peers.js';
import { CONTRACT_ROUTER } from './route.js';
import type { RouteContract } from './contract.js';

/*
 * Any appkit guard counts, including app-level wrappers named like one
 * (bloomneo-cloud's requireLoginOrApiToken). The template's copy matched only
 * `auth.require…(`, so apps with wrappers got a false warning on every boot
 * and learned to ignore the real ones.
 */
const GUARD = /\b(?:auth\s*\.\s*)?require(?:LoginToken|UserRoles|ApiToken|Roles|LoginOrApiToken)\s*\(/;
const PUBLIC = /export\s+const\s+isPublic\s*=\s*true/;

export interface ApiRouterOptions {
  /** Absolute path of the features directory. */
  featuresDir: string;
  /** Where boot messages go. Default: console. */
  log?: { info: (msg: string) => void; warn: (msg: string) => void };
}

export interface DiscoveredEndpoint {
  feature: string;
  /** For contract routes: method, path and auth. For plain routers: the mount path. */
  method?: string;
  path: string;
  auth?: RouteContract['auth'];
  /** Plain routers only: the file declares `export const isPublic = true`. */
  public?: true;
}

export async function createApiRouter(options: ApiRouterOptions): Promise<any> {
  const express = await loadExpress();
  const router = (express.default ?? express).Router();
  const log = options.log ?? { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) };
  const endpoints: DiscoveredEndpoint[] = [];

  // The index answers with every endpoint, which is also what verifyClass
  // reads to find what to probe.
  router.get('/', (_req: unknown, res: any) => {
    res.json({
      endpoints: {
        features: [...new Set(endpoints.map((e) => `/api/${e.feature}`))],
        routes: endpoints,
      },
    });
  });

  const dir = options.featuresDir;
  if (!existsSync(dir)) {
    log.warn(`[@bloomneo/appkit/server] no features directory at ${dir}`);
    return router;
  }

  for (const feature of readdirSync(dir).sort()) {
    const featureDir = join(dir, feature);
    if (!statSync(featureDir).isDirectory() || feature.startsWith('_') || feature.startsWith('.')) continue;

    const files = readdirSync(featureDir);
    const main = [`${feature}.route.ts`, `${feature}.route.js`].find((f) => files.includes(f));
    for (const f of files) {
      if (/\.route\.(ts|js)$/.test(f) && f !== main && !f.endsWith('.d.ts')) {
        log.warn(`  ⚠️  ${feature}/${f} is NOT mounted — only ${feature}.route.ts is loaded. Move its handlers there.`);
      }
    }
    if (!main) {
      log.warn(`  ⚠️  features/${feature}/ has no ${feature}.route.ts — nothing was mounted.`);
      continue;
    }

    let mod: any;
    try {
      mod = await import(pathToFileURL(join(featureDir, main)).href);
    } catch (err) {
      log.warn(`  ⚠️  /api/${feature} failed to load — NOT mounted.\n      ${String((err as Error)?.message ?? err).split('\n')[0]}`);
      continue;
    }
    const exported = mod.default;
    if (!exported) {
      log.warn(`  ⚠️  ${feature}/${main} has no default export — nothing was mounted.`);
      continue;
    }

    const contracts: RouteContract[] | undefined = exported[CONTRACT_ROUTER];
    if (contracts) {
      // Contract routes declare their full paths and their own auth.
      router.use(exported);
      for (const c of contracts) endpoints.push({ feature, method: c.method, path: c.path, auth: c.auth });
      log.info(`  ${contracts.length} contract route${contracts.length === 1 ? '' : 's'} -> ${feature}/${main}`);
      continue;
    }

    const source = readFileSync(join(featureDir, main), 'utf8');
    if (!GUARD.test(source) && !PUBLIC.test(source)) {
      log.warn(
        `  ⚠️  /api/${feature} has NO auth guard — every route in it is public. Guard it with ` +
          `auth.requireLoginToken(), declare \`export const isPublic = true\`, or use contracts.`,
      );
    }
    router.use(`/${feature}`, exported);
    endpoints.push({ feature, path: `/api/${feature}`, ...(PUBLIC.test(source) ? { public: true as const } : {}) });
    log.info(`  /api/${feature} -> ${main}`);
  }

  // Unmatched /api paths answer JSON, never the SPA's HTML.
  router.use((req: any, res: any) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `No API route matches ${req.method} /api${req.path}` });
  });

  return router;
}
