/**
 * Copy the reading rules into the Edge Function runtime.
 *
 * src/ai/reading.ts is the original. Deno cannot follow the app's `@/` paths,
 * so a copy has to live under supabase/functions/_shared — and a copy that is
 * edited by hand is how the app and the function come to disagree about what a
 * reading is allowed to be. So the copy is generated, marked as generated, and
 * __tests__/sharedParity.test.ts fails if it drifts.
 *
 *   node scripts/sync-shared.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'src/ai/reading.ts';
const TARGET = 'supabase/functions/_shared/reading.ts';

const HEADER = `/**
 * GENERATED — do not edit. Run \`npm run sync:shared\`.
 *
 * The original is ${SOURCE}. Both the app and the Edge Functions have to agree
 * about what a reading is allowed to be, so there is one file and one copy.
 */
`;

/** The two types the rules borrow, inlined so Deno needs no path mapping. */
const TYPES = `
type AntennaId = 'progress' | 'self_understanding' | 'spark' | 'sustainable' | 'values';

type InsightLabel =
  | '積み上がったこと'
  | '力が出る条件'
  | '大切にしたいもの'
  | '自分に合う進み方'
  | '続けやすい方法'
  | '心が向く方向'
  | '思っていたこととの違い'
  | '手がかり';
`;

export function render() {
  const source = readFileSync(SOURCE, 'utf8');
  const body = source.replace(
    /^import type \{[^}]*\} from '@\/types';\n/m,
    TYPES.trimStart() + '\n'
  );
  if (body === source) {
    throw new Error(`${SOURCE}: expected an import of AntennaId and InsightLabel from '@/types'`);
  }
  return HEADER + body;
}

const wanted = render();

if (process.argv.includes('--check')) {
  const current = (() => {
    try {
      return readFileSync(TARGET, 'utf8');
    } catch {
      return '';
    }
  })();
  if (current !== wanted) {
    console.error(`${TARGET} is out of date. Run: npm run sync:shared`);
    process.exit(1);
  }
  console.log(`${TARGET} is up to date.`);
} else {
  writeFileSync(TARGET, wanted);
  console.log(`wrote ${TARGET}`);
}
