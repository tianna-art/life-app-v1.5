import type { PeriodTitle } from '@/types';
import { isMonthEndReached, isYearEndReached } from './period';

/** Minimum logs before the month's AI title button appears (spec §4.5). */
export const MONTHLY_AI_MIN_LOGS = 5;
/** Either of these unlocks the yearly AI title (spec §4.6). */
export const YEARLY_AI_MIN_CONFIRMED_MONTH_TITLES = 3;
export const YEARLY_AI_MIN_LOGS = 20;

export interface MonthlyUnlockInput {
  periodKey: string;
  logCount: number;
  now?: Date;
}

/**
 * Manual titling is always available; this only governs the AI button.
 * Locked is not an error state and is never explained as "not enough records".
 */
export function isMonthlyTitleAiUnlocked({
  periodKey,
  logCount,
  now = new Date(),
}: MonthlyUnlockInput): boolean {
  return isMonthEndReached(periodKey, now) && logCount >= MONTHLY_AI_MIN_LOGS;
}

export interface YearlyUnlockInput {
  periodKey: string;
  logCount: number;
  monthlyTitles: PeriodTitle[];
  now?: Date;
}

export function confirmedMonthlyTitleCount(
  monthlyTitles: PeriodTitle[],
  yearKeyValue: string
): number {
  return monthlyTitles.filter(
    (t) => t.periodType === 'month' && t.isConfirmed && t.periodKey.startsWith(`${yearKeyValue}-`)
  ).length;
}

export function isYearlyTitleAiUnlocked({
  periodKey,
  logCount,
  monthlyTitles,
  now = new Date(),
}: YearlyUnlockInput): boolean {
  if (!isYearEndReached(periodKey, now)) return false;
  const confirmed = confirmedMonthlyTitleCount(monthlyTitles, periodKey);
  return confirmed >= YEARLY_AI_MIN_CONFIRMED_MONTH_TITLES || logCount >= YEARLY_AI_MIN_LOGS;
}
