/**
 * scripts/check-readme-anchors.ts
 *
 * Fails if any error message or inline `See: .../README.md#anchor` URL
 * points to a heading that doesn't exist in the target README.
 *
 * Errors in appkit end with `See: ${DOCS_URL}#<anchor>` per NAMING.md §Error-Names.
 * If the README anchor is missing, a consumer following the link lands on a
 * dead section — same experience as a 404 on a doc site.
 *
 * Run:  npm run check:anchors
 * Wire: add to CI on every PR (runs alongside check:docs).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** GitHub-style slugifier: lowercase, ASCII alnum + spaces/hyphens, spaces → hyphens. */
function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')  // strip punctuation, emoji, etc.
    .trim()
    .replace(/\s+/g, '-');
}

/** Extract every `## / ### / ...` heading from a markdown file, slugified. */
function readAnchors(path: string): Set<string> {
  const anchors = new Set<string>();
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (m) anchors.add(slug(m[1]));
  }
  return anchors;
}

/** Recursively find every .ts file under src/ (skip tests + .d.ts). */
function listSourceFiles(rel: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(ROOT, rel))) {
    const full = join(rel, f);
    const abs = join(ROOT, full);
    if (statSync(abs).isDirectory()) {
      listSourceFiles(full, out);
    } else if (f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const URL_RX =
  /https:\/\/github\.com\/bloomneo\/appkit\/blob\/main\/src\/([a-z]+)\/README\.md#([a-z0-9-]+)/gi;

const files = listSourceFiles('src');
const violations: { file: string; line: number; anchor: string; module: string }[] = [];
const readmeCache = new Map<string, Set<string>>();

for (const file of files) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    URL_RX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_RX.exec(line))) {
      const [, moduleName, anchor] = m;
      const readmePath = join('src', moduleName, 'README.md');
      let anchors = readmeCache.get(readmePath);
      if (!anchors) {
        try {
          anchors = readAnchors(join(ROOT, readmePath));
        } catch {
          anchors = new Set();
        }
        readmeCache.set(readmePath, anchors);
      }
      if (anchors.size === 0) {
        violations.push({ file, line: i + 1, anchor, module: moduleName });
        continue;
      }
      if (!anchors.has(anchor)) {
        violations.push({ file, line: i + 1, anchor, module: moduleName });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\nFAIL: README anchor(s) missing. The error messages below link to');
  console.error('headings that do not exist in the target README:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    → src/${v.module}/README.md#${v.anchor}  (no matching heading)\n`);
  }
  console.error(`Total: ${violations.length} broken anchor link(s).\n`);
  process.exit(1);
}

console.log(
  `OK: scanned ${files.length} source files, every README#anchor reference resolves.`,
);
