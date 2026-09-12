/**
 * Period keys. A month key is `YYYY-MM`; a year key is `YYYY`.
 *
 * This file used to hold twenty-five helpers — month names in two languages,
 * key arithmetic in both directions, half a dozen date formatters — and two of
 * them were called. The rest were the retired model's, left behind when it was
 * taken out. A file of plausible utilities nobody uses is not free: the next
 * person writing a date function finds five that nearly do it and has to read
 * all of them to learn that none is load-bearing.
 *
 * Formatting a period for the screen belongs to the screen that shows it, and
 * the footprint arithmetic lives in utils/footprint.ts, where it is tested.
 */

/** `YYYY-MM` from a year and a 1-12 month. */
export function monthKey(year: number, month: number): string {
  return `${year}-${month < 10 ? `0${month}` : month}`;
}

/** The month a date falls in, in the device's own day rather than UTC. */
export function monthKeyOf(date: Date): string {
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}
