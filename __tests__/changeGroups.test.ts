import { TARGET_ORDER, groupChanges, orderedChanges } from '@/map/changeGroups';
import type { Change, ChangeTargetType, Gain } from '@/types';

const gain = (label: string): Gain => ({
  id: `g:${label}`,
  category: 'clarity',
  label,
  confidence: 0.5,
  firstDetectedAt: '',
  lastDetectedAt: '',
});

const change = (
  id: string,
  targetType: ChangeTargetType,
  targetId: string,
  overrides: Partial<Change> = {}
): Change =>
  ({
    id,
    userId: 'u1',
    periodType: 'month',
    year: 2026,
    month: 9,
    title: `${id}の方へ動く`,
    linkedTargetType: targetType,
    ...(targetType === 'emerging_direction' ? {} : { linkedTargetId: targetId }),
    linkedTargetLabel: targetId,
    currentState: '',
    observation: '',
    targetConnection: '',
    confidence: 'supported',
    position: 0,
    userEdited: false,
    evidence: [],
    gains: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as Change;

/**
 * §14. The five points are not five unrelated findings.
 *
 * Each was published against something the person put down before the month
 * started, and that is the grouping worth drawing: it turns the sky from "here
 * are five changes" into "here is what moved on what I said I wanted, and here
 * is what moved somewhere else".
 */
describe('grouping the month by what it answers to', () => {
  it('puts two changes on the same thing together', () => {
    const groups = groupChanges([
      change('a', 'desired_self', '自分で決められる', { position: 0 }),
      change('b', 'year_direction', '自分に合う働き方', { position: 1 }),
      change('c', 'desired_self', '自分で決められる', { position: 2 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.targetLabel === '自分で決められる')?.changes.map((c) => c.id)).toEqual(
      ['a', 'c']
    );
  });

  it('groups by the thing, not by its kind', () => {
    // Two desired-self cards are two things the person picked, and saying
    // which one moved is more use than saying both were desired-self.
    const groups = groupChanges([
      change('a', 'desired_self', '自分で決められる'),
      change('b', 'desired_self', '人にアイデアを見せられる'),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('follows the priority §14 fixes', () => {
    const groups = groupChanges([
      change('a', 'emerging_direction', '人と体験をつくる'),
      change('b', 'desired_self', '自分で決められる'),
      change('c', 'month_declaration', '次の一歩を選ぶ'),
      change('d', 'year_direction', '自分に合う働き方'),
    ]);
    expect(groups.map((g) => g.targetType)).toEqual([...TARGET_ORDER]);
  });

  it('does not put what grew outside the declarations above or below it (§34)', () => {
    // Last in the order because §14 ranks the declarations, not because it
    // is worth less. Nothing marks it as a miss.
    const groups = groupChanges([change('a', 'emerging_direction', '人と体験をつくる')]);
    expect(groups[0]?.targetLabel).toBe('人と体験をつくる');
    expect(groups[0]?.changes).toHaveLength(1);
  });

  it('gathers what each thing was left holding, once each (§32)', () => {
    const groups = groupChanges([
      change('a', 'desired_self', '自分で決められる', {
        gains: [gain('判断の基準'), gain('小さく試す')],
      }),
      change('b', 'desired_self', '自分で決められる', {
        // The same thing settling out of two changes is one thing they have.
        gains: [gain('判断の基準')],
      }),
    ]);
    expect(groups[0]?.gains.map((g) => g.label)).toEqual(['判断の基準', '小さく試す']);
  });

  it('keeps the reading own order inside a group', () => {
    const groups = groupChanges([
      change('late', 'desired_self', '自分で決められる', { position: 4 }),
      change('early', 'desired_self', '自分で決められる', { position: 1 }),
    ]);
    expect(groups[0]?.changes.map((c) => c.id)).toEqual(['early', 'late']);
  });

  it('hands back every change it was given', () => {
    // The sky is laid out from the grouped order and the cards are printed
    // from it. A change lost here is a point with no card, which is the one
    // thing the whole object exists to prevent (§23).
    const changes = [
      change('a', 'desired_self', '自分で決められる'),
      change('b', 'month_declaration', '次の一歩を選ぶ'),
      change('c', 'emerging_direction', '人と体験をつくる'),
    ];
    expect(orderedChanges(groupChanges(changes)).map((c) => c.id).sort()).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('is empty for a month that published nothing', () => {
    expect(groupChanges([])).toEqual([]);
  });
});
