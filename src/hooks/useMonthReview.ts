import { useQuery } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { invokeEdgeFunction } from '@/ai/client';
import { buildLocalMonthReview } from '@/ai/monthReview';
import { isMonthEndReached } from '@/utils/period';
import type { MonthReview, MonthReviewChange, MonthReviewGain, YearReview } from '@/types';
import { isGainCategory } from '@/ai/progressionRules';

function readChanges(value: unknown): MonthReviewChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const c = item as Record<string, unknown>;
    const title = typeof c.title === 'string' ? c.title.trim() : '';
    if (title.length === 0) return [];
    return [{ title, line: typeof c.line === 'string' ? c.line.trim() : '' }];
  });
}

function readGains(value: unknown): MonthReviewGain[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const g = item as Record<string, unknown>;
    const label = typeof g.label === 'string' ? g.label.trim() : '';
    // A gain with no category is not storable: guessing one would put a word
    // in the person's mouth about what kind of thing they now have (§20).
    if (label.length === 0 || !isGainCategory(g.category)) return [];
    return [{ category: g.category, label }];
  });
}

function readStrings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

/**
 * The month-end reading (§25).
 *
 * Only ever requested once the month is actually over — nothing is summarised
 * while it is still being lived — and a stored reading always wins so the same
 * month reads the same way every time it is opened.
 */
export function useMonthReview(periodKey: string, options: { enabled?: boolean } = {}) {
  const enabled = (options.enabled ?? true) && periodKey.length > 0;

  return useQuery<MonthReview | null>({
    queryKey: queryKeys.monthReview(periodKey),
    enabled,
    queryFn: async () => {
      const repository = getRepository();
      const stored = await repository.getMonthReview(periodKey);
      if (stored) return stored;
      if (!isMonthEndReached(periodKey)) return null;

      const logs = await repository.listLogsByMonth(periodKey);
      if (logs.length === 0) return null;

      try {
        const raw = await invokeEdgeFunction<Record<string, unknown>>('month-review', {
          period_key: periodKey,
        });
        const title = typeof raw.title === 'string' ? raw.title.trim() : '';
        if (title.length > 0) {
          return repository.saveMonthReview({
            periodKey,
            initialTheme: typeof raw.initial_theme === 'string' ? raw.initial_theme : '',
            whatActuallyHappened:
              typeof raw.what_actually_happened === 'string'
                ? raw.what_actually_happened.trim()
                : '',
            changed: readChanges(raw.changed).slice(0, 3),
            gained: readGains(raw.gained).slice(0, 3),
            titleCandidates: readStrings(raw.title_candidates, 3),
            title,
            subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '',
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Fall through: the local reading says less, and says it honestly.
      }

      const [progressions, gains, theme] = await Promise.all([
        repository.listMonthProgressions(periodKey),
        repository.listGains(),
        repository.getMonthTheme(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7))),
      ]);

      const local = buildLocalMonthReview({
        periodKey,
        logs,
        progressions,
        gains,
        initialTheme: theme?.initialTheme,
      });
      return local ? repository.saveMonthReview(local) : null;
    },
  });
}

export function useMonthReviews(yearKey: string) {
  return useQuery<MonthReview[]>({
    queryKey: queryKeys.monthReviews(yearKey),
    queryFn: () => getRepository().listMonthReviews(yearKey),
  });
}

/**
 * The year-end reading (§26).
 *
 * Never generated locally: comparing what a year was expected to be with what
 * it became is writing, and a fallback that produced it from templates would
 * be putting words in someone's mouth about their year.
 */
export function useYearReview(year: number, options: { enabled?: boolean } = {}) {
  return useQuery<YearReview | null>({
    queryKey: queryKeys.yearReview(year),
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const repository = getRepository();
      const stored = await repository.getYearReview(year);
      if (stored) return stored;

      try {
        const raw = await invokeEdgeFunction<Record<string, unknown>>('year-review', { year });
        const actualStory = typeof raw.actual_story === 'string' ? raw.actual_story.trim() : '';
        if (actualStory.length === 0) return null;
        return repository.saveYearReview({
          year,
          initialTheme: typeof raw.initial_theme === 'string' ? raw.initial_theme : '',
          actualStory,
          progressions: readChanges(raw.progressions),
          gained: readGains(raw.gained),
          titleCandidates: readStrings(raw.title_candidates, 3),
          createdAt: new Date().toISOString(),
        });
      } catch {
        return null;
      }
    },
  });
}
