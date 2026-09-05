/**
 * The month-end reading, built without a model.
 *
 * Used when no Edge Function is reachable. Everything here is arithmetic over
 * what the person actually wrote: the title names the shape of the month's
 * records, the three gains are the best-supported ones already stored, and the
 * one change is a comparison of two counts. Nothing is asserted about who they
 * are, and when there is nothing to compare, the change line stays empty.
 */
import type { EntryWithAnalysis, GainType, InputCategory, MonthReview } from '@/types';
import type { MonthGain } from '@/data/repository';
import { inputCategoryLabel } from '@/constants/inputCategories';

interface TitleShape {
  title: string;
  subtitle: string;
}

/** Titles describe what the month's records were, not how the month went. */
const TITLE_BY_GAIN_TYPE: Record<GainType, TitleShape> = {
  evidence: { title: 'OUT INTO THE WORLD', subtitle: '外に出し始めた月' },
  strategy: { title: 'A DIFFERENT WAY', subtitle: 'やり方を変えてみた月' },
  insight: { title: 'WHAT BECAME CLEAR', subtitle: '分かったことが増えた月' },
  capability: { title: 'DONE AGAIN', subtitle: '繰り返した月' },
  direction: { title: 'A BEARING', subtitle: '向きが見えてきた月' },
  connection: { title: 'ALONGSIDE OTHERS', subtitle: '人と重なった月' },
};

const TITLE_BY_INPUT_CATEGORY: Record<InputCategory, TitleShape> = {
  progress: { title: 'SMALL MOVES', subtitle: '少しずつ動かした月' },
  friction: { title: 'HELD UP', subtitle: 'ひっかかりが多かった月' },
  moved: { title: 'THINGS THAT CAUGHT', subtitle: '心が動いた記録が多い月' },
};

export interface LocalMonthReviewInput {
  periodKey: string;
  entries: readonly EntryWithAnalysis[];
  previousEntries: readonly EntryWithAnalysis[];
  monthGains: readonly MonthGain[];
}

function dominantInputCategory(entries: readonly EntryWithAnalysis[]): InputCategory | null {
  const counts = new Map<InputCategory, number>();
  for (const entry of entries) {
    counts.set(entry.inputCategory, (counts.get(entry.inputCategory) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0];
  if (!top) return null;
  // A tie says nothing about the month, so it names nothing.
  if (ranked[1] && ranked[1][1] === top[1]) return null;
  return top[0];
}

function share(entries: readonly EntryWithAnalysis[], category: InputCategory): number {
  if (entries.length === 0) return 0;
  return entries.filter((e) => e.inputCategory === category).length / entries.length;
}

/**
 * A comparison, not a verdict: it says which kind of record grew, and only
 * when the difference is large enough that it is not noise.
 */
function oneChange(
  entries: readonly EntryWithAnalysis[],
  previous: readonly EntryWithAnalysis[]
): string {
  if (entries.length < 3 || previous.length < 3) return '';

  const categories: InputCategory[] = ['progress', 'friction', 'moved'];
  let best: { category: InputCategory; delta: number } | null = null;
  for (const category of categories) {
    const delta = share(entries, category) - share(previous, category);
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { category, delta };
  }
  if (!best || Math.abs(best.delta) < 0.2) return '';

  const label = inputCategoryLabel(best.category);
  return best.delta > 0
    ? `先月にくらべて、「${label}」として残した記録が増えています。`
    : `先月にくらべて、「${label}」として残した記録は減っています。`;
}

export function buildLocalMonthReview(input: LocalMonthReviewInput): MonthReview | null {
  if (input.entries.length === 0) return null;

  const ranked = [...input.monthGains].sort(
    (a, b) =>
      b.evidenceLogIds.length - a.evidenceLogIds.length ||
      b.gain.confidence - a.gain.confidence ||
      a.gain.label.localeCompare(b.gain.label)
  );

  const topType = ranked[0]?.gain.type;
  const shape =
    (topType ? TITLE_BY_GAIN_TYPE[topType] : undefined) ??
    (() => {
      const category = dominantInputCategory(input.entries);
      return category ? TITLE_BY_INPUT_CATEGORY[category] : null;
    })() ??
    { title: 'A MONTH OF RECORDS', subtitle: '記録の残った月' };

  return {
    periodKey: input.periodKey,
    title: shape.title,
    subtitle: shape.subtitle,
    gains: ranked.slice(0, 3).map((g) => g.gain.label),
    oneChange: oneChange(input.entries, input.previousEntries),
    createdAt: new Date().toISOString(),
  };
}
