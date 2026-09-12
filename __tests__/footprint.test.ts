/**
 * 足跡タイトル is a name for time already lived. The rules are about whether
 * the time is over — never about what was achieved in it.
 */
import {
  daysUntilNameable,
  footprintState,
  monthStrip,
  periodLabel,
  yearStrip,
} from '@/utils/footprint';
import { chooseAntenna } from '@/map/interaction';

const TODAY = new Date(2026, 8, 12); // 2026-09-12

describe('what can be done with a period', () => {
  const state = (periodKey: string, over: Partial<{ hasTitle: boolean; firstUsedKey: string }> = {}) =>
    footprintState({ periodKey, today: TODAY, hasTitle: false, ...over });

  it('leaves the month you are standing in alone while it is still running', () => {
    expect(state('2026-09')).toBe('waiting');
  });

  it('opens the month you are standing in on its last day', () => {
    // 2026-09-30 is the last day of September.
    const onTheLastDay = footprintState({
      periodKey: '2026-09',
      today: new Date(2026, 8, 30),
      hasTitle: false,
    });
    expect(onTheLastDay).toBe('ready');
  });

  it('opens the year you are standing in on the last day of December', () => {
    expect(
      footprintState({ periodKey: '2026', today: new Date(2026, 11, 31), hasTitle: false })
    ).toBe('ready');
    expect(
      footprintState({ periodKey: '2026', today: new Date(2026, 11, 30), hasTitle: false })
    ).toBe('waiting');
  });

  it('offers a name for a month that has ended', () => {
    expect(state('2026-08', { firstUsedKey: '2026-06' })).toBe('ready');
  });

  it('asks for a typed one for a month that ended before the app', () => {
    expect(state('2025-04', { firstUsedKey: '2026-06' })).toBe('hand');
  });

  it('says nothing about a month that has not happened', () => {
    expect(state('2026-10')).toBe('future');
  });

  it('lets a name that exists be rewritten, whenever it was given', () => {
    expect(state('2026-09', { hasTitle: true })).toBe('titled');
    expect(state('2019-01', { hasTitle: true })).toBe('titled');
  });

  it('never asks whether anything was recorded — an empty month can be named', () => {
    // There is no "records" input at all; this test stands as the statement.
    expect(state('2026-08', { firstUsedKey: '2026-01' })).toBe('ready');
  });

  it('treats a year the same way', () => {
    expect(state('2026')).toBe('waiting');
    expect(state('2025', { firstUsedKey: '2026-06' })).toBe('hand');
    expect(state('2027')).toBe('future');
  });
});

describe('how far back the strip goes', () => {
  it('runs from two Januaries ago up to this month, in order', () => {
    const months = monthStrip(TODAY);
    expect(months[0]).toBe('2024-01');
    expect(months[months.length - 1]).toBe('2026-09');
    expect(months).toHaveLength(33);
    expect([...months].sort()).toEqual(months);
  });

  it('stops at this month — there is nothing to name ahead of it', () => {
    expect(monthStrip(TODAY)).not.toContain('2026-10');
  });

  it('lists the years the same way', () => {
    expect(yearStrip(TODAY)).toEqual(['2024', '2025', '2026']);
  });
});

describe('labels', () => {
  it('names a month by its number and a year by itself', () => {
    expect(periodLabel('2026-09')).toBe('9月');
    expect(periodLabel('2026-01')).toBe('1月');
    expect(periodLabel('2026')).toBe('2026');
  });
});

describe('how long the wait is', () => {
  it('counts the days left in the month you are standing in', () => {
    expect(daysUntilNameable('2026-09', new Date(2026, 8, 12))).toBe(18);
    expect(daysUntilNameable('2026-09', new Date(2026, 8, 29))).toBe(1);
    expect(daysUntilNameable('2026-09', new Date(2026, 8, 30))).toBe(0);
  });

  it('knows how long February is', () => {
    expect(daysUntilNameable('2026-02', new Date(2026, 1, 28))).toBe(0);
    // 2028 is a leap year, so the 28th is not the last day.
    expect(daysUntilNameable('2028-02', new Date(2028, 1, 28))).toBe(1);
    expect(daysUntilNameable('2028-02', new Date(2028, 1, 29))).toBe(0);
  });

  it('counts to the end of December for a year', () => {
    expect(daysUntilNameable('2026', new Date(2026, 11, 25))).toBe(6);
    expect(daysUntilNameable('2026', new Date(2026, 11, 31))).toBe(0);
  });

  it('never counts backwards for something already over', () => {
    expect(daysUntilNameable('2026-08', new Date(2026, 8, 12))).toBe(0);
  });
});

describe('choosing what the month watches', () => {
  it('takes two', () => {
    expect(chooseAntenna<'a' | 'b'>([], 'a', 2)).toEqual(['a']);
    expect(chooseAntenna<'a' | 'b'>(['a'], 'b', 2)).toEqual(['a', 'b']);
  });

  it('ignores a third rather than dropping one to make room', () => {
    // The earlier version pushed the oldest out. That removed something the
    // person deliberately chose, without telling them.
    expect(chooseAntenna(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
  });

  it('lets one be taken off, which is how room is made', () => {
    expect(chooseAntenna(['a', 'b'], 'a', 2)).toEqual(['b']);
    expect(chooseAntenna(chooseAntenna(['a', 'b'], 'a', 2), 'c', 2)).toEqual(['b', 'c']);
  });

  it('returns a new array, never the one it was given', () => {
    const chosen = ['a', 'b'];
    expect(chooseAntenna(chosen, 'c', 2)).not.toBe(chosen);
  });
});
