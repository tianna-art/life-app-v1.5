import type { PeriodTitle } from '@/types';

/**
 * What can be done with a period's 足跡タイトル right now.
 *
 * A title is a name given to time already lived, so the rule is about whether
 * the time is over — not about whether anything was achieved in it, and not
 * about how much was written. A month with no records can still be named.
 *
 * "Over" includes the last day of the month you are standing in. A month is
 * finished being what it was once there is no more of it to come, and making
 * someone wait until the first of the next month to name it means naming it
 * from outside, when the month has already stopped being the present.
 *
 *   titled   it already has a name (which can always be rewritten)
 *   hand     it ended before the app was being used — type one in
 *   ready    it is over, or it is its last day, so a name can be made
 *   waiting  it is still running; `daysUntilNameable` says for how much longer
 *   future   it has not happened
 */
export type FootprintState = 'titled' | 'hand' | 'ready' | 'waiting' | 'future';

export interface FootprintInput {
  /** `YYYY-MM` or `YYYY`. */
  periodKey: string;
  today: Date;
  hasTitle: boolean;
  /**
   * The first period the person ever recorded in. Anything before it ended
   * without the app, so its name can only be typed in by hand.
   */
  firstUsedKey?: string | undefined;
}

export function footprintState({
  periodKey,
  today,
  hasTitle,
  firstUsedKey,
}: FootprintInput): FootprintState {
  if (hasTitle) return 'titled';

  const current = periodKey.length === 4 ? String(today.getFullYear()) : monthKey(today);
  if (periodKey > current) return 'future';
  // The period you are standing in: nameable on its final day, waiting before.
  if (periodKey === current) return daysUntilNameable(periodKey, today) === 0 ? 'ready' : 'waiting';
  if (firstUsedKey && periodKey < firstUsedKey) return 'hand';
  return 'ready';
}

/**
 * How many days until this period can be named. 0 means today.
 *
 * The wait is shown rather than hidden — knowing what happens and when is what
 * makes waiting bearable, and a control that is simply absent teaches nothing.
 */
export function daysUntilNameable(periodKey: string, today: Date): number {
  if (periodKey.length === 4) {
    const endOfYear = new Date(Number(periodKey), 11, 31);
    return Math.max(0, daysBetween(today, endOfYear));
  }
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(year, month, 0);
  return Math.max(0, daysBetween(today, lastDay));
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The months to show, newest last: this month and the two years behind it.
 * Further back than that is not browsing, it is archaeology.
 */
export function monthStrip(today: Date, yearsBack = 2): string[] {
  const keys: string[] = [];
  const start = new Date(today.getFullYear() - yearsBack, 0, 1);
  const cursor = new Date(start);
  while (
    cursor.getFullYear() < today.getFullYear() ||
    (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() <= today.getMonth())
  ) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export function yearStrip(today: Date, yearsBack = 2): string[] {
  const years: string[] = [];
  for (let y = today.getFullYear() - yearsBack; y <= today.getFullYear(); y += 1) {
    years.push(String(y));
  }
  return years;
}

export function titleOf(titles: PeriodTitle[], periodKey: string): PeriodTitle | undefined {
  return titles.find((t) => t.periodKey === periodKey);
}

/** `2026-09` → `9月`, `2026` → `2026`. */
export function periodLabel(periodKey: string): string {
  if (periodKey.length === 4) return periodKey;
  return `${Number(periodKey.slice(5, 7))}月`;
}
