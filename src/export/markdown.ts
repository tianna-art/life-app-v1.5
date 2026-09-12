import { antenna, categoryById } from '@/constants/antennas';
import { summaryText } from '@/types';
import type {
  JournalLog,
  MonthDirection,
  PeriodSummary,
  PeriodTitle,
  YearDirection,
} from '@/types';

/**
 * 記録の書き出し — everything the person wrote, in a file they can keep.
 *
 * Three decisions, all of them the same decision.
 *
 * It is Markdown, not CSV. The point of taking your writing out is to still be
 * able to read it; a spreadsheet of rows is for a program, and the thing being
 * carried here is sentences.
 *
 * Their own summary wins over the reading's, through summaryText() — the same
 * rule the screen follows. A file that quietly restores the machine's version
 * of a month the person rewrote would be the app having the last word on the
 * way out the door.
 *
 * And the readings are marked as readings. 見えてきたこと and the comparison
 * are not exported at all: they belong to the app, they can be regenerated,
 * and a file that mixes them with what somebody actually wrote makes it
 * impossible later to tell which sentences were theirs.
 */

export interface ExportInput {
  generatedOn: Date;
  logs: JournalLog[];
  yearDirections: YearDirection[];
  monthDirections: MonthDirection[];
  monthTitles: PeriodTitle[];
  yearTitles: PeriodTitle[];
  summaries: PeriodSummary[];
}

export function exportFilename(on: Date): string {
  return `crincran-${iso(on)}.md`;
}

/** Newest first — which is the order the person remembers them in. */
export function toMarkdown(input: ExportInput): string {
  const out: string[] = ['# crincran', '', `書き出し: ${iso(input.generatedOn)}`, ''];

  const byMonth = new Map<string, JournalLog[]>();
  for (const log of input.logs) {
    const list = byMonth.get(log.periodKey);
    if (list) list.push(log);
    else byMonth.set(log.periodKey, [log]);
  }

  // Every month that holds anything at all — a record, a direction, a name.
  // A month with a name and no records still happened.
  const months = new Set<string>([
    ...byMonth.keys(),
    ...input.monthDirections.map((d) => d.periodKey),
    ...input.monthTitles.map((t) => t.periodKey),
  ]);
  const years = new Set<string>([
    ...[...months].map((m) => m.slice(0, 4)),
    ...input.yearDirections.map((d) => String(d.year)),
    ...input.yearTitles.map((t) => t.periodKey),
  ]);

  for (const year of [...years].sort().reverse()) {
    out.push(`## ${year}年`, '');

    const yearDirection = input.yearDirections.find((d) => String(d.year) === year);
    if (yearDirection?.direction) out.push(`年の方向: ${yearDirection.direction}`, '');

    const yearTitle = input.yearTitles.find((t) => t.periodKey === year);
    if (yearTitle) out.push(`足跡タイトル: ${yearTitle.title}`, '');

    const yearSummary = input.summaries.find(
      (s) => s.periodType === 'year' && s.periodKey === year
    );
    pushSummary(out, yearSummary);

    for (const month of [...months].filter((m) => m.startsWith(year)).sort().reverse()) {
      out.push(`### ${Number(month.slice(5, 7))}月`, '');

      const direction = input.monthDirections.find((d) => d.periodKey === month);
      const antennas = (direction?.antennaIds ?? []).map((id) => antenna(id)?.title ?? id);
      if (antennas.length > 0) out.push(`月の方向: ${antennas.join(' / ')}`, '');

      const title = input.monthTitles.find((t) => t.periodKey === month);
      if (title) out.push(`足跡タイトル: ${title.title}`, '');

      pushSummary(
        out,
        input.summaries.find((s) => s.periodType === 'month' && s.periodKey === month)
      );

      const logs = byMonth.get(month) ?? [];
      if (logs.length === 0) {
        // Said, not omitted. A month with nothing in it is part of the record.
        out.push('記録はありません。', '');
        continue;
      }
      for (const log of logs) {
        const kind = log.categoryId ? categoryById(log.categoryId)?.label : undefined;
        out.push(`- ${day(log)}${kind ? ` [${kind}]` : ''} ${log.body}`);
      }
      out.push('');
    }
  }

  return out.join('\n');
}

/**
 * A summary is labelled by whose it is. The person's own words are theirs; the
 * reading's are marked as the app's, so a file read years later does not hand
 * somebody a sentence about themselves that they never wrote.
 */
function pushSummary(out: string[], summary: PeriodSummary | undefined): void {
  if (!summary) return;
  const text = summaryText(summary);
  if (text.trim().length === 0) return;
  out.push(summary.bodyUser?.trim() ? '要約（自分の言葉）:' : '要約（アプリが書いたもの）:');
  out.push(text, '');
}

/** A record with no day is shown by its month. Inventing one is not an option. */
function day(log: JournalLog): string {
  if (!log.occurredOn) return `${Number(log.periodKey.slice(5, 7))}月`;
  const [, month, date] = log.occurredOn.split('-');
  return `${Number(month)}/${Number(date)}`;
}

function iso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
