import type { PeriodTitle } from '@/types';

/**
 * What can be done with a period's 足跡タイトル right now.
 *
 * A title is a name given to time already lived, so the rule is about whether
 * the time is over — not about whether anything was achieved in it, and not
 * about how much was written. A month with no records can still be named.
 *
 *   titled   it already has a name (which can always be rewritten)
 *   hand     it ended before the app was being used — type one in
 *   ready    it has ended, so a name can be made for it
 *   waiting  it is the month you are standing in; it is not over yet
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
  if (periodKey === current) return 'waiting';
  if (firstUsedKey && periodKey < firstUsedKey) return 'hand';
  return 'ready';
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
