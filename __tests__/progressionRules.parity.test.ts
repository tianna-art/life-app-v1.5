import { readFileSync } from 'node:fs';

/**
 * The app and the Edge Function must apply the same limits.
 *
 * If they drift, the offline path and the online path can make claims of
 * different strengths about the same evidence — a record that reads
 * "兆しがあります" on a plane and "繰り返し確認されています" on wifi. That is
 * the one failure the rules exist to prevent, so it fails the build.
 */
it('the two copies of the rules are identical', () => {
  const source = readFileSync('src/ai/progressionRules.ts', 'utf8');
  const copy = readFileSync('supabase/functions/_shared/progressionRules.ts', 'utf8');
  expect(copy).toBe(source);
});
