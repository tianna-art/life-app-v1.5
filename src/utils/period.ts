/** Period-key arithmetic. A month key is `YYYY-MM`; a year key is `YYYY`. */

export const MONTH_NAMES_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

export const MONTH_NAMES_JA = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
] as const;

export interface MonthKeyParts {
  year: number;
  /** 1-12 */
  month: number;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function yearKey(year: number): string {
  return String(year);
}

export function parseMonthKey(key: string): MonthKeyParts {
  const [y, m] = key.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${key}`);
  }
  return { year, month };
}

export function monthKeyOf(date: Date): string {
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}

export function yearKeyOf(date: Date): string {
  return yearKey(date.getFullYear());
}

/** Shift a month key by `delta` months. Never merges data — it only names a period. */
export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const zeroBased = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(zeroBased / 12);
  const newMonth = (zeroBased % 12 + 12) % 12 + 1;
  return monthKey(newYear, newMonth);
}

export function shiftYearKey(key: string, delta: number): string {
  return String(Number(key) + delta);
}

/** `YYYY-MM-DD` -> `YYYY-MM`. */
export function monthKeyOfDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** `YYYY-MM-DD` -> `YYYY`. */
export function yearKeyOfDate(isoDate: string): string {
  return isoDate.slice(0, 4);
}

/** `YYYY-MM-DD` -> `MM/DD` for the LIST one-liner. */
export function formatShortDate(isoDate: string): string {
  return `${isoDate.slice(5, 7)}/${isoDate.slice(8, 10)}`;
}

/** `SEPTEMBER 2026` */
export function formatMonthEyebrow(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES_EN[month - 1]} ${year}`;
}

export function formatMonthJa(key: string): string {
  const { month } = parseMonthKey(key);
  return MONTH_NAMES_JA[month - 1] ?? `${month}月`;
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** True once the month named by `key` is over, or we are on its final day. */
export function isMonthEndReached(key: string, now: Date = new Date()): boolean {
  const { year, month } = parseMonthKey(key);
  const currentKey = monthKeyOf(now);
  if (key < currentKey) return true;
  if (key > currentKey) return false;
  const lastDay = new Date(year, month, 0).getDate();
  return now.getDate() >= lastDay;
}

/** True once the year named by `key` is over, or we are inside its final day. */
export function isYearEndReached(key: string, now: Date = new Date()): boolean {
  const year = Number(key);
  if (year < now.getFullYear()) return true;
  if (year > now.getFullYear()) return false;
  return now.getMonth() === 11 && now.getDate() === 31;
}

/** Month keys of a year, January to December. */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
}

/** At least the last `count` years, newest first, always including `current`. */
export function selectableYears(current: number, count = 5): number[] {
  const now = new Date().getFullYear();
  const newest = Math.max(now, current);
  const oldest = Math.min(newest - (count - 1), current);
  const years: number[] = [];
  for (let y = newest; y >= oldest; y -= 1) years.push(y);
  return years;
}
