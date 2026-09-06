import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildChangeMap } from '@/map/changeMap';
import { groupChanges } from '@/map/changeGroups';
import { TARGET_SHORT } from '@/constants/copy';
import type { Change } from '@/types';

const ROOT = join(__dirname, '..');

/**
 * The browser preview draws the same sky as the app, or it is worse than
 * useless.
 *
 * `docs/map-preview.html` exists so the layout can be looked at and pushed
 * around without a device. That only works while it is the same arithmetic: a
 * preview that drifts sends someone back to change the app to match a picture
 * the app never drew. So the page's copy of the maths is evaluated here and
 * run against the same input as the real one, and the two have to agree on
 * every number.
 */
function loadPreview(): {
  buildChangeMap: (input: Record<string, unknown>) => Record<string, unknown>;
  groupChanges: (changes: unknown[]) => Array<Record<string, unknown>>;
  CHANGES: Change[];
  TARGET_SHORT: Record<string, string>;
} {
  const html = readFileSync(join(ROOT, 'docs/map-preview.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!script) throw new Error('the preview has no script');
  const factory = new Function(
    `${script}\nreturn { buildChangeMap, groupChanges, CHANGES, TARGET_SHORT };`
  );
  return factory() as ReturnType<typeof loadPreview>;
}

describe('the browser preview', () => {
  const preview = loadPreview();
  const box = { width: 384, height: 413.6 };

  it('carries data the app would accept', () => {
    // Not a fixture invented for the picture: every field the card and the
    // sky read has to be there, or the preview is showing a different object.
    expect(preview.CHANGES.length).toBeGreaterThan(0);
    for (const change of preview.CHANGES) {
      expect(typeof change.title).toBe('string');
      expect(change.evidence.length).toBeGreaterThanOrEqual(2);
      expect(['signal', 'supported', 'strong']).toContain(change.confidence);
      expect(Object.keys(TARGET_SHORT)).toContain(change.linkedTargetType);
    }
  });

  it('groups a month exactly as the app does', () => {
    const mine = groupChanges(preview.CHANGES);
    const theirs = preview.groupChanges(preview.CHANGES);

    expect(theirs.map((g) => g.key)).toEqual(mine.map((g) => g.key));
    expect(theirs.map((g) => (g.changes as Change[]).map((c) => c.id))).toEqual(
      mine.map((g) => g.changes.map((c) => c.id))
    );
    expect(theirs.map((g) => (g.gains as Array<{ label: string }>).map((x) => x.label))).toEqual(
      mine.map((g) => g.gains.map((x) => x.label))
    );
  });

  it('places every point and every sector on the same coordinates', () => {
    const mine = buildChangeMap({
      monthKey: '2026-09',
      changes: preview.CHANGES,
      targetLabels: TARGET_SHORT,
      ...box,
    });
    const theirs = preview.buildChangeMap({
      monthKey: '2026-09',
      changes: preview.CHANGES,
      targetLabels: preview.TARGET_SHORT,
      ...box,
    }) as unknown as typeof mine;

    // Exact, not close: both run the same seeded PRNG in the same order, so
    // any difference at all means a line of the arithmetic has drifted.
    expect(theirs.nodes).toEqual(mine.nodes);
    expect(theirs.sectors).toEqual(mine.sectors);
    expect(theirs.edges).toEqual(mine.edges);
    expect(theirs.me).toEqual(mine.me);
  });

  it('keeps the same short labels for the rim', () => {
    expect(preview.TARGET_SHORT).toEqual({ ...TARGET_SHORT });
  });
});
