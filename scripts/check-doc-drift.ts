/**
 * scripts/check-doc-drift.ts
 *
 * Fails if any known-hallucinated or renamed method appears in docs,
 * examples, or cookbook. This is the lightweight drift gate that
 * catches regressions without a full AST parse.
 *
 * Run:  npm run check:docs
 * Wire: add to CI on every PR.
 *
 * Extending: when a rename lands, add the OLD name here so no future
 * contributor can reintroduce it via docs. Each entry is a regex +
 * the correct replacement for the error message.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

type Banned = { pattern: RegExp; now: string };

const BANNED: Banned[] = [
  // auth — 2.0.0 compatibility-break renames (no aliases kept)
  { pattern: /\bauth\.user\s*\(/,          now: 'auth.getUser(req)' },
  { pattern: /\bauth\.can\s*\(/,           now: 'auth.hasPermission(user, permission)' },
  { pattern: /\bauth\.requireLogin\s*\(/,  now: 'auth.requireLoginToken()' },
  { pattern: /\bauth\.requireRole\s*\(/,   now: 'auth.requireUserRoles([...])' },

  // security — 2.0.0 rename
  { pattern: /\bsecurity\.csrf\s*\(/,      now: 'security.forms()' },

  // cache — 2.0.1 synonym drift removal
  { pattern: /\bcacheClass\.flushAll\s*\(/, now: 'cacheClass.clearAll()' },
  { pattern: /\bcacheClass\.shutdown\s*\(/, now: 'cacheClass.disconnectAll()' },

  // queue — 2.0.1 align with cache teardown naming
  { pattern: /\bqueueClass\.clear\s*\(/,    now: 'queueClass.disconnectAll()' },

  // email / storage — 3.0.2 unify teardown verb across all modules
  { pattern: /\bemailClass\.shutdown\s*\(/,   now: 'emailClass.disconnectAll()' },
  { pattern: /\bstorageClass\.shutdown\s*\(/, now: 'storageClass.disconnectAll()' },

  // email / storage / logger — 4.0.0 removes redundant class-level clear()
  { pattern: /\bemailClass\.clear\s*\(/,   now: 'emailClass.disconnectAll()' },
  { pattern: /\bstorageClass\.clear\s*\(/, now: 'storageClass.disconnectAll()' },
  { pattern: /\bloggerClass\.clear\s*\(/,  now: 'loggerClass.disconnectAll()' },

  // 6.0.0 — removed modules. No app used them; see MIGRATION-6.md.
  { pattern: /\beventClass\b|@bloomneo\/appkit\/event\b/, now: 'removed in 6.0 — use queueClass jobs for async work (MIGRATION-6.md)' },
  { pattern: /\butilClass\b|@bloomneo\/appkit\/util\b/,   now: 'removed in 6.0 — use Node built-ins, e.g. crypto.randomUUID() (MIGRATION-6.md)' },

  // database — 4.0.0 rename for cross-module teardown consistency
  { pattern: /\bdatabaseClass\.disconnect\s*\(/, now: 'databaseClass.disconnectAll()' },

  // logger — 1.5.x hallucinations
  { pattern: /\bgethasTransport\b/,        now: 'hasTransport' },
  { pattern: /\bgetclear\b/,               now: 'clear' },

  // error — signature drift
  { pattern: /handleErrors\s*\(\s*\{[^}]*includeStack/,
    now: 'handleErrors({ showStack, logErrors })' },
];

const SCAN: string[] = [
  'AGENTS.md',
  'llms.txt',
  'README.md',
];

function addTsDir(rel: string) {
  for (const f of readdirSync(join(ROOT, rel))) {
    if (f.endsWith('.ts')) SCAN.push(join(rel, f));
  }
}
addTsDir('examples');
addTsDir('cookbook');


for (const mod of readdirSync(join(ROOT, 'src'))) {
  const sub = join('src', mod);
  if (!statSync(join(ROOT, sub)).isDirectory()) continue;
  const readme = join(sub, 'README.md');
  try { statSync(join(ROOT, readme)); SCAN.push(readme); } catch {}

  // Also scan the module's source .ts files — catches drift in index.ts,
  // the class file, defaults.ts, and tests. This is how cache's flushAll /
  // shutdown synonym drift slipped through: the script used to skip src/.
  // Skip .test.ts — test files deliberately reference banned names inside
  // negative assertions ("method MUST NOT exist"), which the inline-code-span
  // strip below handles, but the drift check for `typeof (x as any).foo`
  // patterns would still fire. Safer to skip the tests outright.
  for (const f of readdirSync(join(ROOT, sub))) {
    if (f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts')) {
      SCAN.push(join(sub, f));
    }
  }
}

let violations = 0;
for (const file of SCAN) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Strip inline code spans — quoted references like `auth.user()` in
    // prose or score-block history are discussing past drift, not introducing it.
    let clean = line.replace(/`[^`]*`/g, '');

    // Migration arrow: on `<old> → <new>` lines, the left side is SUPPOSED
    // to contain the banned name (that's the point of a migration table).
    // Only scan the right side so we catch drift introduced in the new
    // canonical call without false-positiving the migration reference itself.
    const arrowMatch = clean.match(/^(.*?)(?:→|->)(.*)$/);
    if (arrowMatch) clean = arrowMatch[2];
    for (const { pattern, now } of BANNED) {
      if (pattern.test(clean)) {
        console.error(
          `  ${file}:${i + 1}\n    ${line.trim()}\n    → use: ${now}`,
        );
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\nFAIL: ${violations} stale/hallucinated reference(s) in docs.\n`);
  process.exit(1);
}
console.log(`OK: scanned ${SCAN.length} files, no drift.`);

/* ────────────────────────────────────────────────────────────────────────────
 * Coverage: every public module must appear in the agent-facing docs.
 *
 * The scan above is one-directional — it catches names that were REMOVED and
 * came back. It cannot catch the opposite failure: a whole module shipping
 * with no mention in llms.txt or AGENTS.md, which is worse. An agent never
 * calls what it cannot find, so an undocumented module is an unused one —
 * exactly how a shipped component ends up hand-rolled three times downstream.
 *
 * Rule: every `xxxClass` exported from src/index.ts must be named in both
 * llms.txt and AGENTS.md.
 * ──────────────────────────────────────────────────────────────────────────── */

const indexSource = readFileSync(join(ROOT, 'src/index.ts'), 'utf8');
const exportedClasses = [...indexSource.matchAll(/export\s*\{\s*(\w+Class)\s*\}/g)].map((m) => m[1]);

const AGENT_DOCS = ['llms.txt', 'AGENTS.md'] as const;
const missing: string[] = [];

for (const doc of AGENT_DOCS) {
  const content = readFileSync(join(ROOT, doc), 'utf8');
  for (const cls of exportedClasses) {
    if (!content.includes(cls)) missing.push(`${doc} is missing ${cls}`);
  }
}

// Skills are shipped teaching material and are what agents actually reach for,
// so a module without one is effectively undiscoverable. `mcpClass` and
// `verifyClass` both shipped before this check existed, and the database skill
// documented three methods that never existed — the checks below catch the
// first failure; the second is caught by the per-skill audit in CI.
for (const cls of exportedClasses) {
  const moduleName = cls.replace(/Class$/, '');
  const skillPath = join(ROOT, '.claude/skills', `appkit-${moduleName}`, 'SKILL.md');
  if (!existsSync(skillPath)) {
    missing.push(`.claude/skills/appkit-${moduleName}/SKILL.md does not exist`);
  }
}

if (missing.length > 0) {
  console.error('\nFAIL: public API missing from the agent-facing docs:\n');
  for (const m of missing) console.error(`  ${m}`);
  console.error(
    '\nAn agent only calls what it can find. Document the module in llms.txt' +
      ' (API reference) and AGENTS.md (rules) before shipping it.\n',
  );
  process.exit(1);
}
console.log(`OK: all ${exportedClasses.length} modules documented in ${AGENT_DOCS.join(' + ')} + skills.`);

/* ────────────────────────────────────────────────────────────────────────────
 * Version claims must match package.json.
 *
 * llms.txt shipped claiming v5.1.0 while package.json said 5.1.1, and AGENTS.md
 * said "Current release: 4.0.0 … after 4.0.0 the API is stable" three releases
 * and one breaking change later. An agent reading that would conclude nothing
 * had broken since 4.0 — worse than no version line at all.
 * ──────────────────────────────────────────────────────────────────────────── */

const pkgVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
const versionClaims: Array<{ file: string; re: RegExp; label: string }> = [
  { file: 'llms.txt', re: /^# @bloomneo\/appkit v([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?)/m, label: 'llms.txt header' },
  { file: 'AGENTS.md', re: /\*\*Current release: ([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?)\.\*\*/, label: 'AGENTS.md "Current release"' },
  { file: 'README.md', re: /\*\*Current release: ([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?)\.\*\*/, label: 'README "Current release"' },
];

const versionErrors: string[] = [];
for (const claim of versionClaims) {
  const content = readFileSync(join(ROOT, claim.file), 'utf8');
  const found = content.match(claim.re);
  if (!found) {
    versionErrors.push(`${claim.label} not found — the version line was removed or reworded`);
  } else if (found[1] !== pkgVersion) {
    versionErrors.push(`${claim.label} says ${found[1]}, package.json says ${pkgVersion}`);
  }
}

if (versionErrors.length > 0) {
  console.error('\nFAIL: version claims out of sync:\n');
  for (const e of versionErrors) console.error(`  ${e}`);
  console.error('');
  process.exit(1);
}
console.log(`OK: version claims match package.json (${pkgVersion}).`);
