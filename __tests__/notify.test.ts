/**
 * 通知.
 *
 * Two moments, and the arithmetic for the one that moves. The last day of a
 * month is 28, 29, 30 or 31 depending on which month and which year, which is
 * why it cannot be a repeating rule and has to be scheduled ahead.
 */
import { MONTH_ENDS_AHEAD, NOTIFY_TEXT, monthEndDates } from '@/lib/notify';
import { FORBIDDEN_PHRASES } from '@/constants/copy';

describe('the month ends', () => {
  it('lands on the last day of each month, whatever length it is', () => {
    const dates = monthEndDates(new Date(2026, 0, 1, 9, 0), 4, 21, 0);
    expect(dates.map((d) => `${d.getMonth() + 1}/${d.getDate()}`)).toEqual([
      '1/31',
      '2/28',
      '3/31',
      '4/30',
    ]);
  });

  it('gets February right in a leap year without being told', () => {
    const dates = monthEndDates(new Date(2028, 1, 1, 9, 0), 1, 21, 0);
    expect(dates[0]?.getDate()).toBe(29);
  });

  it('uses the chosen time', () => {
    const [first] = monthEndDates(new Date(2026, 8, 1, 9, 0), 1, 7, 0);
    expect(first?.getHours()).toBe(7);
    expect(first?.getMinutes()).toBe(0);
  });

  it('skips a moment that has already gone by today', () => {
    // The last day of September, at 22:00, asked for at 23:00 on that day.
    const dates = monthEndDates(new Date(2026, 8, 30, 23, 0), 1, 22, 0);
    expect(dates).toHaveLength(0);
  });

  it('schedules a year ahead, because these cannot repeat on their own', () => {
    expect(monthEndDates(new Date(2026, 0, 1, 0, 0), MONTH_ENDS_AHEAD, 21, 0)).toHaveLength(12);
  });
});

describe('what a notification says', () => {
  it('announces what became possible, and never what is owed', () => {
    for (const { title, body } of Object.values(NOTIFY_TEXT)) {
      for (const banned of FORBIDDEN_PHRASES) {
        expect(`${title}${body}`).not.toContain(banned);
      }
    }
  });

  it('is only ever about the two edges of a month', () => {
    // No daily 「今日の記録は？」. A reminder that notices you did not write is
    // a reminder that you are behind, and nothing here may say that.
    expect(Object.keys(NOTIFY_TEXT)).toEqual(['monthStart', 'monthEnd']);
  });
});
