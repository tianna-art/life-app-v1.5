/**
 * AI title buttons unlock only at period end, and only past the thresholds.
 * Manual titling is unaffected — these rules govern the AI button alone.
 */
import {
  MONTHLY_AI_MIN_LOGS,
  YEARLY_AI_MIN_CONFIRMED_MONTH_TITLES,
  YEARLY_AI_MIN_LOGS,
  isMonthlyTitleAiUnlocked,
  isYearlyTitleAiUnlocked,
} from '@/utils/titleUnlock';
import type { PeriodTitle } from '@/types';

function monthTitle(periodKey: string, isConfirmed = true): PeriodTitle {
  return { periodType: 'month', periodKey, title: 't', source: 'manual', isConfirmed };
}

describe('monthly title AI unlock', () => {
  const midSeptember = new Date(2026, 8, 15);
  const endOfSeptember = new Date(2026, 8, 30);
  const october = new Date(2026, 9, 3);

  it('stays locked mid-month even with plenty of logs', () => {
    expect(
      isMonthlyTitleAiUnlocked({ periodKey: '2026-09', logCount: 40, now: midSeptember })
    ).toBe(false);
  });

  it('stays locked at month end below the log threshold', () => {
    expect(
      isMonthlyTitleAiUnlocked({
        periodKey: '2026-09',
        logCount: MONTHLY_AI_MIN_LOGS - 1,
        now: endOfSeptember,
      })
    ).toBe(false);
  });

  it('unlocks on the last day of the month at 5 logs', () => {
    expect(
      isMonthlyTitleAiUnlocked({
        periodKey: '2026-09',
        logCount: MONTHLY_AI_MIN_LOGS,
        now: endOfSeptember,
      })
    ).toBe(true);
  });

  it('unlocks for any past month that met the threshold', () => {
    expect(isMonthlyTitleAiUnlocked({ periodKey: '2026-09', logCount: 5, now: october })).toBe(true);
  });
});

describe('yearly title AI unlock', () => {
  const midYear = new Date(2026, 5, 1);
  const lastDay = new Date(2026, 11, 31);
  const nextYear = new Date(2027, 0, 5);

  it('stays locked before year end', () => {
    expect(
      isYearlyTitleAiUnlocked({
        periodKey: '2026',
        logCount: 500,
        monthlyTitles: [monthTitle('2026-01'), monthTitle('2026-02'), monthTitle('2026-03')],
        now: midYear,
      })
    ).toBe(false);
  });

  it('unlocks on 3 confirmed monthly titles', () => {
    expect(
      isYearlyTitleAiUnlocked({
        periodKey: '2026',
        logCount: 4,
        monthlyTitles: [monthTitle('2026-01'), monthTitle('2026-02'), monthTitle('2026-03')],
        now: lastDay,
      })
    ).toBe(true);
  });

  it('unlocks on 20 logs even without monthly titles', () => {
    expect(
      isYearlyTitleAiUnlocked({
        periodKey: '2026',
        logCount: YEARLY_AI_MIN_LOGS,
        monthlyTitles: [],
        now: nextYear,
      })
    ).toBe(true);
  });

  it('stays locked below both thresholds', () => {
    expect(
      isYearlyTitleAiUnlocked({
        periodKey: '2026',
        logCount: YEARLY_AI_MIN_LOGS - 1,
        monthlyTitles: [monthTitle('2026-01'), monthTitle('2026-02')],
        now: nextYear,
      })
    ).toBe(false);
  });

  it('ignores unconfirmed and other-year titles', () => {
    expect(
      isYearlyTitleAiUnlocked({
        periodKey: '2026',
        logCount: 3,
        monthlyTitles: [
          monthTitle('2026-01', false),
          monthTitle('2026-02', false),
          monthTitle('2025-03'),
          monthTitle('2025-04'),
          monthTitle('2025-05'),
        ],
        now: nextYear,
      })
    ).toBe(false);
    expect(YEARLY_AI_MIN_CONFIRMED_MONTH_TITLES).toBe(3);
  });
});
