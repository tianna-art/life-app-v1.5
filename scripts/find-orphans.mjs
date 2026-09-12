/**
 * Find modules nothing reaches.
 *
 * A file written into a directory that no longer exists does not fail: the
 * shell reports it, nobody reads the report, and because nothing imports the
 * file, neither the type checker nor the tests notice it is missing. That
 * happened once here — a module created in Phase 3 went to a path the Phase 1
 * demolition had removed, and the only reason it surfaced was that someone
 * later tried to import it.
 *
 * So the check is reachability, not existence. Expo Router makes every file
 * under app/ an entry point; everything under components/ and src/ has to be
 * reachable from one of them, or from a test, or it is dead.
 *
 *   node scripts/find-orphans.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const CODE = /\.tsx?$/;
const ROOTS = ['app', 'components', 'src', '__tests__', 'scripts'];
const SKIP = new Set(['node_modules', '.git', 'dist', 'generated']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE.test(name)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r)));
const known = new Set(files.map((f) => relative(ROOT, f)));

/** `@/x` → `src/x`, `@components/x` → `components/x`, `./x` → beside the file. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('@components/')) base = join(ROOT, 'components', spec.slice(12));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // a package

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate);
  }
  return { missing: spec };
}

const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const edges = new Map();
const broken = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  const targets = new Set();
  for (const match of text.matchAll(IMPORT)) {
    const resolved = resolveImport(match[1], file);
    if (resolved === null) continue;
    if (typeof resolved === 'object') {
      broken.push(`${rel} → ${resolved.missing}`);
      continue;
    }
    targets.add(resolved);
  }
  edges.set(rel, targets);
}

// Every route file is an entry, and so is every test and script.
const entries = [...known].filter(
  (f) => f.startsWith('app/') || f.startsWith('__tests__/') || f.startsWith('scripts/')
);

const reached = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const current = queue.pop();
  if (reached.has(current)) continue;
  reached.add(current);
  for (const next of edges.get(current) ?? []) queue.push(next);
}

const orphans = [...known]
  .filter((f) => !reached.has(f))
  .filter((f) => f.startsWith('components/') || f.startsWith('src/'))
  .sort();

if (broken.length > 0) {
  console.log('Imports that resolve to nothing:');
  for (const b of broken) console.log(`  ${b}`);
}

if (orphans.length > 0) {
  console.log('Modules nothing reaches:');
  for (const o of orphans) console.log(`  ${o}`);
}

if (broken.length === 0 && orphans.length === 0) {
  console.log(`No orphans. ${known.size} files, ${reached.size} reachable.`);
}

process.exitCode = broken.length > 0 || orphans.length > 0 ? 1 : 0;
