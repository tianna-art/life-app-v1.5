import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const FUNCTIONS = join(ROOT, 'supabase/functions');

/**
 * Every write an Edge Function makes has to be checked.
 *
 * This has cost twice. A silent `log_ai_analysis` upsert left an account with
 * progressions standing on records still marked unread: STAGE 2 runs whatever
 * STAGE 1's storage did, so the trail got built, the month never turned
 * green, and it could be paid for a second time. Nothing in the app could see
 * it, because from the outside a failed write and a skipped one look the
 * same.
 */
describe('Edge Function writes', () => {
  const files: string[] = [];
  for (const entry of readdirSync(FUNCTIONS, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_shared') continue;
    files.push(join(FUNCTIONS, entry.name, 'index.ts'));
  }
  files.push(join(FUNCTIONS, '_shared/progressionStore.ts'));

  it.each(files.map((f) => [f.replace(`${ROOT}/`, ''), f]))(
    '%s checks what it writes',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      // A write whose result is thrown away is a statement that opens with
      // `await` — anything bound to a name starts with `const` or `=`.
      const unchecked = /^[ \t]*await\s+\w+\s*\n?\s*\.from\([^)]*\)\s*\n?\s*\.(upsert|insert|update|delete)\(/gm;
      const found = [...source.matchAll(unchecked)].map((m) => m[0].replace(/\s+/g, ' '));
      expect(found).toEqual([]);
    }
  );
});
