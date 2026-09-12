/**
 * 足跡タイトル is a name for time already lived. The rules are about whether
 * the time is over — never about what was achieved in it.
 */
import { footprintState, monthStrip, periodLabel, yearStrip } from '@/utils/footprint';

const TODAY = new Date(2026, 8, 12); // 2026-09-12

describe('what can be done with a period', () => {
  const state = (periodKey: string, over: Partial<{ hasTitle: boolean; firstUsedKey: string }> = {}) =>
    footprintState({ periodKey, today: TODAY, hasTitle: false, ...over });

  it('leaves the month you are standing in alone — it is not over', () => {
    expect(state('2026-09')).toBe('waiting');
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
