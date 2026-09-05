import {
  PATTERN_REQUIREMENTS,
  patternSatisfied,
  resolvePattern,
  satisfiedPatterns,
} from '../src/ai/progressionRules';
import type { LogType, MomentTag } from '../src/types';

type Row = [logType: LogType, tags: MomentTag[], day: string];

function path(rows: Row[]) {
  return rows.map(([logType, momentTags, day], i) => ({
    logId: `log-${i}`,
    logType,
    momentTags,
    occurredAt: `2026-${day}T09:00:00Z`,
  }));
}

describe('PIVOT needs all three points (§18)', () => {
  const full = path([
    ['self_action', ['friction'], '04-01'],
    ['self_action', ['changed'], '05-01'],
    ['self_action', ['tried'], '06-01'],
  ]);

  it('is satisfied by friction → changed → retry', () => {
    expect(patternSatisfied('pivot', full)).toBe(true);
  });

  it('is not satisfied without the retry', () => {
    expect(patternSatisfied('pivot', full.slice(0, 2))).toBe(false);
  });

  it('is not satisfied without the change', () => {
    const noChange = path([
      ['self_action', ['friction'], '04-01'],
      ['self_action', ['tried'], '06-01'],
    ]);
    expect(patternSatisfied('pivot', noChange)).toBe(false);
  });

  it('is not satisfied when the retry came first', () => {
    const wrongOrder = path([
      ['self_action', ['tried'], '04-01'],
      ['self_action', ['friction'], '05-01'],
      ['self_action', ['changed'], '06-01'],
    ]);
    expect(patternSatisfied('pivot', wrongOrder)).toBe(false);
  });

  it('is not satisfied by one afternoon carrying all three tags', () => {
    // One moment is not a movement: the stages may not share a record.
    const oneDay = path([['self_action', ['friction', 'changed', 'tried'], '04-01']]);
    expect(patternSatisfied('pivot', oneDay)).toBe(false);
  });
});

describe('the other nine', () => {
  it('FIRST-ACT needs a thought before the doing', () => {
    expect(
      patternSatisfied(
        'first_act',
        path([
          ['thought', [], '04-01'],
          ['self_action', ['first_time'], '05-01'],
        ])
      )
    ).toBe(true);
    expect(
      patternSatisfied('first_act', path([['self_action', ['first_time'], '05-01']]))
    ).toBe(false);
  });

  it('REPEAT needs three, not two', () => {
    const twice = path([
      ['self_action', ['tried'], '04-01'],
      ['self_action', ['tried'], '05-01'],
    ]);
    expect(patternSatisfied('repeat', twice)).toBe(false);
    expect(patternSatisfied('repeat', [...twice, ...path([['self_action', ['tried'], '06-01']])]))
      .toBe(true);
  });

  it('SOLO needs the help before the doing it alone', () => {
    expect(
      patternSatisfied(
        'solo',
        path([
          ['relationship', ['tried'], '04-01'],
          ['self_action', ['tried'], '05-01'],
        ])
      )
    ).toBe(true);
  });

  it('BOUNDARY needs friction before the decision', () => {
    expect(
      patternSatisfied(
        'boundary',
        path([
          ['self_action', ['friction'], '04-01'],
          ['self_action', ['self_decided'], '05-01'],
        ])
      )
    ).toBe(true);
    expect(
      patternSatisfied(
        'boundary',
        path([
          ['self_action', ['self_decided'], '04-01'],
          ['self_action', ['friction'], '05-01'],
        ])
      )
    ).toBe(false);
  });

  it('REFRAME needs friction before the discovery', () => {
    expect(
      patternSatisfied(
        'reframe',
        path([
          ['thought', ['friction'], '04-01'],
          ['thought', ['discovered'], '05-01'],
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
    ['self_action', ['friction'], '04-01'],
    ['self_action', ['self_decided'], '05-01'],
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
        ['self_action', ['friction'], '04-01'],
        ['self_action', ['changed'], '05-01'],
        ['self_action', ['tried'], '06-01'],
      ])
    );
    expect(found).toContain('pivot');
    expect(found).toContain('transfer');
    expect(found).not.toContain('own_call');
  });

  it('reports nothing for a single record', () => {
    expect(satisfiedPatterns(path([['self_action', ['tried'], '04-01']]))).toEqual([]);
  });
});
