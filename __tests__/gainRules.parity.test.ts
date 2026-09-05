import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'src/ai/gainRules.ts');
const EDGE_COPY = join(ROOT, 'supabase/functions/_shared/gainRules.ts');

/**
 * The Edge Function runtime cannot import from `src/`, so the rules exist
 * twice. If they drift, the app and the server disagree about how far a gain
 * may be taken — which is exactly the failure the rules exist to prevent.
 */
describe('the gain rules are the same on both sides', () => {
  it('keeps the Edge Function copy byte-identical', () => {
    const source = readFileSync(SOURCE, 'utf8');
    const copy = readFileSync(EDGE_COPY, 'utf8');
    expect(copy).toBe(source);
  });
});
