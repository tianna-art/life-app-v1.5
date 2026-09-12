/**
 * Lift the content layer out of the preview HTML.
 *
 * crincran-app-preview-v3.html is the specification: "迷ったら、この2つの
 * HTMLの挙動が正です". Retyping its copy into TypeScript by hand would create a
 * second source of truth that drifts on the first edit nobody notices, so the
 * strings, the アンテナ tree and the fixed vocabularies are read out of the
 * file itself and written as a generated module.
 *
 *   node scripts/extract-from-preview.mjs <preview.html> [out-dir]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { join } from 'node:path';
import vm from 'node:vm';

const [previewPath, outDir = 'src/constants/generated'] = process.argv.slice(2);
if (!previewPath) {
  console.error('usage: node scripts/extract-from-preview.mjs <preview.html> [out-dir]');
  process.exit(1);
}

const html = readFileSync(previewPath, 'utf8');
const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .sort((a, b) => b.length - a.length)[0];

/** What we take. Anything not listed here stays in the preview. */
const WANTED = [
  'COPY',
  'ANTENNAS',
  'ANTENNA_ORDER',
  'ANTENNA_WISH',
  'ANTENNA_COLORS',
  'MAX_ANTENNAS',
  'INSIGHT_KINDS',
  'FUTURE_TYPES',
  'TYPE_LABEL',
  'DONE_TYPE_LABEL',
  'DATE_KINDS',
  'HEART_TAGS',
  'FLOW_STEPS',
  'VISION_SUGGESTIONS',
  'WORD_SUGGESTIONS',
  'YEAR_SETUP_QUESTIONS',
  'MONTHS_SHORT',
  'MONTHS_EN',
  'WEEKDAYS',
  'TOPIC_EXAMPLES',
];

/**
 * The preview is a DOM program, and a top-level `const` never becomes a
 * property of the global object — so those declarations cannot be read from
 * outside. Two things make them reachable: a DOM stub permissive enough that
 * the program runs to the end rather than throwing part-way, and a collector
 * appended to the same scope, where it can see them.
 */
function stubNode() {
  return new Proxy(function () {}, {
    get(_t, key) {
      if (key === 'children' || key === 'childNodes') return [];
      if (key === 'length') return 0;
      if (key === 'toString' || key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return [][Symbol.iterator].bind([]);
      return stubNode();
    },
    set: () => true,
    apply: () => stubNode(),
  });
}

const sandbox = {
  console: { log() {}, warn() {}, error() {} },
  requestAnimationFrame: () => 0,
  setTimeout: () => 0,
  setInterval: () => 0,
  clearTimeout() {},
  clearInterval() {},
  addEventListener() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  getComputedStyle: () => stubNode(),
  document: stubNode(),
  navigator: { userAgent: 'node' },
  location: { href: '', hash: '', search: '' },
  history: { replaceState() {}, pushState() {} },
  Image: function Image() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const collector =
  '\n;globalThis.__extracted = {' +
  WANTED.map((n) => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ') +
  '};\n';

try {
  vm.runInContext(script + collector, sandbox, { timeout: 30000 });
} catch (error) {
  console.error('preview threw while running:', String(error?.message ?? error).slice(0, 160));
}

const extracted = sandbox.__extracted ?? {};
const missing = WANTED.filter((name) => extracted[name] === undefined);
if (missing.length > 0) {
  console.error('not found in the preview:', missing.join(', '));
  process.exit(2);
}

/** Drops the parts of FLOW_STEPS that are artwork rather than content. */
function prune(name, value) {
  if (name !== 'FLOW_STEPS') return value;
  return value.map(({ art, video, render, ...rest }) => rest);
}

mkdirSync(outDir, { recursive: true });

/**
 * Which preview this came from.
 *
 * The copy in the preview moves, and a generated file that does not say what
 * it was generated from makes the next regeneration unreadable: the diff shows
 * every string that changed but nothing about which version changed them. The
 * digest goes in the file, so it goes in the commit.
 */
const digest = createHash('sha256').update(readFileSync(previewPath)).digest('hex');

const header = `/**
 * GENERATED — do not edit.
 *
 * Lifted from the preview HTML by scripts/extract-from-preview.mjs. The
 * preview is the specification; edit it there and run the script again.
 *
 * source: ${basename(previewPath)}
 * sha256: ${digest}
 */
`;

const body = WANTED.map(
  (name) => `export const ${name} = ${JSON.stringify(prune(name, extracted[name]), null, 2)} as const;`
).join('\n\n');

const contents = `${header}\n${body}\n`;
const outFile = join(outDir, 'preview.ts');
writeFileSync(outFile, contents);

console.log(`wrote ${outFile} — ${WANTED.length} exports, ${(Buffer.byteLength(contents) / 1024).toFixed(1)}KB`);
console.log(`  source: ${basename(previewPath)} sha256:${digest}`);
for (const name of WANTED) {
  const v = extracted[name];
  const size = Array.isArray(v)
    ? `${v.length} items`
    : v && typeof v === 'object'
      ? `${Object.keys(v).length} keys`
      : JSON.stringify(v);
  console.log(`  ${name}: ${size}`);
}
