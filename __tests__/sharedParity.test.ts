import { readFileSync } from 'node:fs';

import { DIRECTION_AREAS } from '@/constants/areas';
import { DESIRED_SELF_CARDS } from '@/constants/desiredSelf';
import { DIRECTION_AREA_LABELS, DESIRED_SELF_LABELS } from '../supabase/functions/_shared/targets';

/**
 * The app and the Edge Functions must apply the same limits.
 *
 * If they drift, the offline path and the online path can make claims of
 * different strengths about the same evidence — a record that reads
 * "兆しがあります" on a plane and "繰り返し確認されています" on wifi. That is
 * the one failure the rules exist to prevent, so it fails the build.
 *
 * `npm run sync:shared` is what fixes a failure here.
 */
describe.each([
  ['progressionRules.ts', 'src/ai/progressionRules.ts'],
  ['changeRules.ts', 'src/ai/changeRules.ts'],
])('%s', (name, source) => {
  it('is identical in both runtimes', () => {
    expect(readFileSync(`supabase/functions/_shared/${name}`, 'utf8')).toBe(
      readFileSync(source, 'utf8')
    );
  });
});

/**
 * A change stores the label of the thing the person chose, and the reading
 * that stores it runs in Deno. A stale copy here would attach a change to
 * wording nobody picked — which is worse than no label, because it reads as
 * the person's own.
 */
describe('the targets the reading may attach a change to', () => {
  it('carries every direction area, with the label the person saw', () => {
    for (const area of DIRECTION_AREAS) {
      expect(DIRECTION_AREA_LABELS[area.id]).toBe(area.label);
    }
    expect(Object.keys(DIRECTION_AREA_LABELS)).toHaveLength(DIRECTION_AREAS.length);
  });

  it('carries every desired-self card, with the label the person saw', () => {
    for (const card of DESIRED_SELF_CARDS) {
      expect(DESIRED_SELF_LABELS[card.id]).toBe(card.label);
    }
    expect(Object.keys(DESIRED_SELF_LABELS)).toHaveLength(DESIRED_SELF_CARDS.length);
  });
});
