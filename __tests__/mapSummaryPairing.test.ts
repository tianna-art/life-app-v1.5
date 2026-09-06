import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildChangeMap } from '@/map/changeMap';
import { parseChangeReading, type ChangeContext } from '@/ai/changeRules';

const ROOT = join(__dirname, '..');

/**
 * §22 and §23: the map and the summary are one object.
 *
 * They used to be two model calls about the same month — one wrote the points,
 * the other wrote the cards, and nothing reconciled them. A point could appear
 * with no card explaining it and a card could name a change with no point
 * above it, because neither had seen the other. That is the failure this whole
 * rewrite is for, so it is checked from two directions: the structure cannot
 * express the mismatch, and no second reading exists to reintroduce it.
 */
describe('one object, not two', () => {
  it('gives every point a card and every card a point, by construction', () => {
    const context: ChangeContext = {
      knownLogIds: new Set(['a', 'b', 'c', 'd']),
      monthLogIds: new Set(['a', 'b', 'c', 'd']),
      knownProgressionIds: new Set(),
      targets: new Map([
        ['month_declaration', new Map()],
        ['year_direction', new Map()],
        ['desired_self', new Map([['choose_decide_myself', '自分で決められる']])],
        ['emerging_direction', new Map()],
      ]),
      frictionOnlyLogIds: new Set(),
      enjoyedOnlyLogIds: new Set(),
    };

    const { changes } = parseChangeReading(
      {
        changes: [
          {
            title: '自分の基準で選ぶ',
            linked_target_type: 'desired_self',
            linked_target_id: 'choose_decide_myself',
            observation: '実際に一つを選ぶ記録が出ています。',
            target_connection: '判断基準を選択に使い始めた変化です。',
            evidence: [
              { log_id: 'a', role: 'attempt' },
              { log_id: 'b', role: 'current' },
            ],
          },
          {
            title: '人に希望を伝える',
            linked_target_type: 'desired_self',
            linked_target_id: 'choose_decide_myself',
            observation: '相手を見ながら話を広げた記録があります。',
            target_connection: '自分の希望を口に出す側に回った変化です。',
            evidence: [
              { log_id: 'c', role: 'attempt' },
              { log_id: 'd', role: 'current' },
            ],
          },
        ],
      },
      context
    );

    const cards = changes.map((c, index) => ({ ...c, id: `c${index}` }));
    const graph = buildChangeMap({
      monthKey: '2026-09',
      // The map is handed the cards themselves, which is the point: there is
      // no separate list of points that could disagree with them.
      changes: cards as never,
      width: 340,
      height: 400,
    });

    expect(graph.nodes.map((n) => n.title)).toEqual(cards.map((c) => c.title));
    expect(graph.nodes.map((n) => n.id)).toEqual(cards.map((c) => c.id));
  });

  it('draws the sky from the same grouping the cards print', () => {
    // The sky's arcs and the blocks of cards have to be the same sets, or a
    // sector points at a heading that is not under it.
    const map = readFileSync(join(ROOT, 'app/(tabs)/map.tsx'), 'utf8');
    const layout = readFileSync(join(ROOT, 'src/map/changeMap.ts'), 'utf8');
    expect(map).toContain("groupChanges(list)");
    expect(layout).toContain('groupChanges(changes.slice(0, MAX_NODES))');
  });

  it('leaves no second reading that could decide the month differently', () => {
    // month-review names the month and compares it with what was set out with.
    // It must not re-derive what changed: the published rows are copied.
    const review = readFileSync(
      join(ROOT, 'supabase/functions/month-review/index.ts'),
      'utf8'
    );
    expect(review).toContain('publishedChanges.map');
    expect(review).not.toContain('parsed.changed');

    // And the prompt is told the same thing, so the model does not spend
    // tokens producing an answer that is thrown away.
    const prompts = readFileSync(
      join(ROOT, 'supabase/functions/_shared/prompts.ts'),
      'utf8'
    );
    const section = prompts.slice(
      prompts.indexOf('export const MONTH_REVIEW_SYSTEM'),
      prompts.indexOf('export const MONTH_CHANGE_SYSTEM')
    );
    expect(section).toContain('ここでその判断をやり直さないこと');
  });

  it('has one place that writes a change, and it writes all of it', () => {
    // Evidence, gains and the row itself go in together. A function that
    // wrote the row and left the evidence to something else would be the old
    // split wearing a different name.
    const fn = readFileSync(
      join(ROOT, 'supabase/functions/month-changes/index.ts'),
      'utf8'
    );
    for (const table of ["from('changes')", "from('change_evidence')", "from('gains')"]) {
      expect(fn).toContain(table);
    }
    // Re-reading a month replaces it rather than stacking a second opinion.
    expect(fn).toContain(".delete()");
  });
});
