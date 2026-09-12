import { useMutation } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { deliver } from '@/export/deliver';
import { exportFilename, toMarkdown } from '@/export/markdown';
import type { JournalLog, MonthDirection, PeriodSummary } from '@/types';

/**
 * 記録の書き出し.
 *
 * Everything, not a window of it: the years are worked out from the first
 * month anything was ever written in, so an export is the whole thing rather
 * than however far back the screen happens to scroll.
 *
 * Gathered on the device from the same repository the screens read, so this
 * works signed in or not and sends nothing anywhere.
 */
export function useExport() {
  return useMutation({
    mutationFn: async () => {
      const repo = getRepository();
      const now = new Date();
      const first = await repo.firstRecordedPeriod();
      const firstYear = first ? Number(first.slice(0, 4)) : now.getFullYear();
      const years: number[] = [];
      for (let y = firstYear; y <= now.getFullYear(); y += 1) years.push(y);

      const [logsByYear, yearDirections, monthTitles, yearTitles] = await Promise.all([
        Promise.all(years.map((y) => repo.listLogsInYear(y))),
        Promise.all(years.map((y) => repo.getYearDirection(y))),
        repo.listPeriodTitles('month'),
        repo.listPeriodTitles('year'),
      ]);

      const logs: JournalLog[] = logsByYear.flat();

      // Every month that holds anything, so a month with a name and no records
      // still comes out with its name.
      const months = [
        ...new Set([...logs.map((l) => l.periodKey), ...monthTitles.map((t) => t.periodKey)]),
      ];

      const [monthDirections, monthSummaries, yearSummaries] = await Promise.all([
        Promise.all(months.map((key) => repo.getMonthDirection(key))),
        Promise.all(months.map((key) => repo.getSummary('month', key))),
        Promise.all(years.map((y) => repo.getSummary('year', String(y)))),
      ]);

      const isThere = <T,>(value: T | null): value is T => value !== null;

      const markdown = toMarkdown({
        generatedOn: now,
        logs,
        yearDirections: yearDirections.filter(isThere),
        monthDirections: monthDirections.filter(isThere) as MonthDirection[],
        monthTitles,
        yearTitles,
        summaries: [...monthSummaries, ...yearSummaries].filter(isThere) as PeriodSummary[],
      });

      await deliver(exportFilename(now), markdown);
    },
  });
}
