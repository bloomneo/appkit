/**
 * scripts/check-skill-api.ts
 *
 * Fails if a skill's "Public API" block claims a class method that doesn't
 * exist on the built module.
 *
 * Why: the appkit-database skill shipped documenting `databaseClass.reset()`,
 * `databaseClass.getProvider()` and `databaseClass.getActiveTenantIds()` —
 * none of which have ever existed. Hallucinated API inside the artefact whose
 * entire job is preventing hallucination is the worst possible place for it,
 * because an agent trusts it more than it trusts itself.
 *
 * Only the fenced blocks under a `## Public API` heading are checked. Lines in
 * "Common mistakes" sections legitimately name removed methods — that's the
 * point of those sections — so scanning the whole file produces false
 * positives and trains people to ignore the check.
 *
 * Run:  npm run check:skills   (also part of `npm test`)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, '.claude/skills');

// A check that skips reports green. Without dist/ nothing below can be
// verified, so that is a failure, not a pass.
if (!existsSync(join(ROOT, 'dist'))) {
  console.error('FAIL: dist/ not built — run `npm run build` before `npm run check:skills`.');
  process.exit(1);
}

/**
 * Extract only the FENCED CODE under the `## Public API` heading.
 *
 * Prose in that section legitimately names methods that don't exist — the
 * database skill says "there is no `databaseClass.reset()`", which is true and
 * useful. Scanning prose flags it, so only executable-looking claims count.
 */
function publicApiBlock(md: string): string {
  const start = md.search(/^##\s+Public API\s*$/m);
  if (start === -1) return '';
  const rest = md.slice(start);
  const end = rest.search(/^##\s+(?!Public API)/m);
  const section = end === -1 ? rest : rest.slice(0, end);

  return [...section.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
}

let violations = 0;
let checked = 0;

for (const dir of readdirSync(SKILLS)) {
  const match = dir.match(/^appkit-(.+)$/);
  if (!match) continue;
  const moduleName = match[1];

  const skillPath = join(SKILLS, dir, 'SKILL.md');
  const distPath = join(ROOT, 'dist', moduleName, 'index.js');
  if (!existsSync(skillPath)) continue;
  if (!existsSync(distPath)) {
    console.error(`FAIL: skill ${dir} documents dist/${moduleName}, which is not built.`);
    process.exit(1);
  }

  const mod = await import(distPath);
  const cls = mod[`${moduleName}Class`];
  if (!cls) continue;

  const real = new Set(Object.keys(cls));
  const block = publicApiBlock(readFileSync(skillPath, 'utf8'));
  if (!block) continue;

  checked++;
  const claimed = [
    ...new Set([...block.matchAll(new RegExp(`\\b${moduleName}Class\\.(\\w+)\\s*\\(`, 'g'))].map((m) => m[1])),
  ];

  for (const method of claimed) {
    if (!real.has(method)) {
      console.error(
        `  ${dir}/SKILL.md claims ${moduleName}Class.${method}() — it does not exist.\n` +
          `    real: ${[...real].filter((k) => !k.startsWith('_')).join(', ')}`,
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(
    `\nFAIL: ${violations} hallucinated method(s) in skill Public API blocks.\n` +
      `An agent trusts a skill more than it trusts itself. Fix the skill.\n`,
  );
  process.exit(1);
}
console.log(`OK: ${checked} skill Public API blocks match the built modules.`);
