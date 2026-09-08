import {
  PATTERN_REQUIREMENTS,
  patternSatisfied,
  resolvePattern,
  satisfiedPatterns,
} from '../src/ai/progressionRules';
import type { CategoryId } from '../src/types';

type Row = [categoryId: CategoryId, day: string];

function path(rows: Row[]) {
  return rows.map(([categoryId, day], i) => ({
    logId: `log-${i}`,
    categoryId,
    occurredAt: `2026-${day}T09:00:00Z`,
  }));
}

describe('PIVOT needs all three points (§18)', () => {
  const full = path([
    ['self_hard', '04-01'],
    ['sustainable_relieved', '05-01'],
    ['progress_tried', '06-01'],
  ]);

  it('is satisfied by friction → changed → retry', () => {
    expect(patternSatisfied('pivot', full)).toBe(true);
  });

  it('is not satisfied without the retry', () => {
    expect(patternSatisfied('pivot', full.slice(0, 2))).toBe(false);
  });

  it('is not satisfied without the change', () => {
    const noChange = path([
      ['self_hard', '04-01'],
      ['progress_tried', '06-01'],
    ]);
    expect(patternSatisfied('pivot', noChange)).toBe(false);
  });

  it('is not satisfied when the retry came first', () => {
    const wrongOrder = path([
      ['progress_tried', '04-01'],
      ['self_hard', '05-01'],
      ['sustainable_relieved', '06-01'],
    ]);
    expect(patternSatisfied('pivot', wrongOrder)).toBe(false);
  });

  it('is not satisfied by one record, whatever it is filed under', () => {
    // One moment is not a movement: the stages may not share a record, and a
    // record can only be filed under one category anyway.
    expect(patternSatisfied('pivot', path([['self_hard', '04-01']]))).toBe(false);
  });

  it('is not satisfied by an unclassified record', () => {
    // A free entry nothing has read yet is not evidence of a shape. It
    // becomes evidence when something says what it is.
    const unread = [
      { logId: 'a', occurredAt: '2026-04-01T09:00:00Z' },
      { logId: 'b', occurredAt: '2026-05-01T09:00:00Z' },
      { logId: 'c', occurredAt: '2026-06-01T09:00:00Z' },
    ];
    expect(patternSatisfied('pivot', unread)).toBe(false);
  });
});

describe('the other nine', () => {
  it('FIRST-ACT needs the pull before the doing', () => {
    expect(
      patternSatisfied(
        'first_act',
        path([
          ['spark_curious', '04-01'],
          ['progress_tried', '05-01'],
        ])
      )
    ).toBe(true);
    expect(
      patternSatisfied('first_act', path([['progress_tried', '05-01']]))
    ).toBe(false);
  });

  it('REPEAT needs three, not two', () => {
    const twice = path([
      ['progress_tried', '04-01'],
      ['progress_tried', '05-01'],
    ]);
    expect(patternSatisfied('repeat', twice)).toBe(false);
    expect(patternSatisfied('repeat', [...twice, ...path([['progress_tried', '06-01']])]))
      .toBe(true);
  });

  it('SOLO needs the hard part before it goes by itself', () => {
    expect(
      patternSatisfied(
        'solo',
        path([
          ['self_hard', '04-01'],
          ['self_good', '05-01'],
        ])
      )
    ).toBe(true);
  });

  it('BOUNDARY needs friction before the decision', () => {
    expect(
      patternSatisfied(
        'boundary',
        path([
          ['self_hard', '04-01'],
          ['values_important', '05-01'],
        ])
      )
    ).toBe(true);
    expect(
      patternSatisfied(
        'boundary',
        path([
          ['values_important', '04-01'],
          ['self_hard', '05-01'],
        ])
      )
    ).toBe(false);
  });

  it('REFRAME needs friction before the discovery', () => {
    expect(
      patternSatisfied(
        'reframe',
        path([
          ['self_hard', '04-01'],
          ['progress_learned', '05-01'],
        ])
      )
    ).toBe(true);
  });

  it('every pattern has a requirement', () => {
    expect(PATTERN_REQUIREMENTS).toHaveLength(10);
  });
});

describe('resolvePattern', () => {
  const evidence = path([
    ['self_hard', '04-01'],
    ['values_important', '05-01'],
  ]);

  it('keeps a pattern the records show', () => {
    expect(resolvePattern('boundary', evidence)).toBe('boundary');
  });

  it('drops a pattern the records do not show, rather than swapping it', () => {
    // The evidence would satisfy BOUNDARY, but the model said PIVOT. Guessing
    // BOUNDARY for it would be the same overclaim under another name.
    expect(resolvePattern('pivot', evidence)).toBeUndefined();
  });

  it('leaves an absent pattern absent', () => {
    expect(resolvePattern(undefined, evidence)).toBeUndefined();
  });
});

describe('satisfiedPatterns', () => {
  it('reports every shape the records actually show', () => {
    const found = satisfiedPatterns(
      path([
        ['self_hard', '04-01'],
        ['sustainable_relieved', '05-01'],
        ['progress_tried', '06-01'],
      ])
    );
    expect(found).toContain('pivot');
    expect(found).toContain('transfer');
    expect(found).not.toContain('own_call');
  });

  it('reports nothing for a single record', () => {
    expect(satisfiedPatterns(path([['progress_tried', '04-01']]))).toEqual([]);
  });
});
