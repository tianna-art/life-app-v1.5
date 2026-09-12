/**
 * Exports nothing else names — the orphan check, one level down.
 *
 * find-orphans.mjs asks whether a module is reachable. This asks whether the
 * things inside a reachable module are. That gap is where the same failure
 * kept reappearing: `src/ai/client.ts` was reached, and `proposeTitles` inside
 * it was not, so a deployed reader had no caller and every check stayed green.
 *
 * Only values are reported — functions, constants, classes. Types are left
 * alone on purpose: an exported interface that nothing imports is a shape
 * stated for readers, and reporting those would bury the finding that matters.
 *
 *   node scripts/find-unused-exports.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'dist', 'generated']);
/** Entry points: what these export is for the outside, not for us. */
const ENTRIES = ['app/', '__tests__/', 'scripts/'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = ['app', 'components', 'src', '__tests__', 'scripts'].flatMap((r) =>
  walk(join(ROOT, r))
);
const texts = new Map(files.map((f) => [relative(ROOT, f), readFileSync(f, 'utf8')]));

const VALUE_EXPORT = /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g;
const findings = [];

for (const [file, text] of texts) {
  if (ENTRIES.some((e) => file.startsWith(e))) continue;
  for (const match of text.matchAll(VALUE_EXPORT)) {
    const name = match[1];
    const named = [...texts].some(
      ([other, otherText]) => other !== file && new RegExp(`\\b${name}\\b`).test(otherText)
    );
    // Used only inside its own file is not dead — it just does not need to be
    // exported, which is a smaller thing than nothing reaching it at all.
    const usedHere = (text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length > 1;
    if (!named && !usedHere) findings.push(`${file}  →  ${name}`);
  }
}

if (findings.length > 0) {
  console.log('Values nothing reaches:');
  for (const f of findings) console.log(`  ${f}`);
} else {
  console.log('Every exported value is reached from somewhere.');
}
process.exitCode = findings.length > 0 ? 1 : 0;
