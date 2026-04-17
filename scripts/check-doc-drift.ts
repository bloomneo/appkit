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

import { readFileSync, readdirSync, statSync } from 'node:fs';
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

  // email / event / storage — 3.0.2 unify teardown verb across all 12 modules
  { pattern: /\bemailClass\.shutdown\s*\(/,   now: 'emailClass.disconnectAll()' },
  { pattern: /\beventClass\.shutdown\s*\(/,   now: 'eventClass.disconnectAll()' },
  { pattern: /\bstorageClass\.shutdown\s*\(/, now: 'storageClass.disconnectAll()' },

  // email / event / storage / logger — 4.0.0 removes redundant class-level clear()
  { pattern: /\bemailClass\.clear\s*\(/,   now: 'emailClass.disconnectAll()' },
  { pattern: /\beventClass\.clear\s*\(/,   now: 'eventClass.disconnectAll()' },
  { pattern: /\bstorageClass\.clear\s*\(/, now: 'storageClass.disconnectAll()' },
  { pattern: /\bloggerClass\.clear\s*\(/,  now: 'loggerClass.disconnectAll()' },

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

// Walk bin/templates for .template and .js/.ts files — scaffolded code
// ships to every downstream consumer, so drift here is especially bad.
function addTemplateDir(rel: string) {
  const abs = join(ROOT, rel);
  let entries: string[];
  try { entries = readdirSync(abs); } catch { return; }
  for (const f of entries) {
    const full = join(rel, f);
    const fullAbs = join(ROOT, full);
    if (statSync(fullAbs).isDirectory()) {
      addTemplateDir(full);
    } else if (/\.(template|ts|js|md)$/.test(f)) {
      SCAN.push(full);
    }
  }
}
addTemplateDir('bin');

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
