import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readMonthInsights, readMonthSummary } from '@/ai/client';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { MonthHypothesis, MonthInsight, PeriodSummary, PeriodType } from '@/types';

/**
 * What the records suggest. Read only — an Edge Function writes these, and
 * nothing in the app is allowed to invent one.
 */
export function useMonthInsights(periodKey: string) {
  return useQuery<MonthInsight[]>({
    queryKey: queryKeys.monthInsights(periodKey),
    queryFn: () => getRepository().listMonthInsights(periodKey),
  });
}

export function useMonthHypothesis(periodKey: string) {
  return useQuery<MonthHypothesis | null>({
    queryKey: queryKeys.monthHypothesis(periodKey),
    queryFn: () => getRepository().getMonthHypothesis(periodKey),
  });
}

export function useSummary(periodType: PeriodType, periodKey: string) {
  return useQuery<PeriodSummary | null>({
    queryKey: queryKeys.summary(periodType, periodKey),
    queryFn: () => getRepository().getSummary(periodType, periodKey),
    enabled: periodKey.length > 0,
  });
}

/**
 * Rewriting a summary in your own words.
 *
 * This is the one thing in the reading a person may change, and it is a
 * separate field rather than an edit of what the reading wrote — so
 * regenerating the reading later does not silently discard it.
 */
export function useSaveOwnSummary() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodType: PeriodType; periodKey: string; bodyUser: string }) =>
      getRepository().saveOwnSummary(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['reading'] });
    },
  });
}

/**
 * Asking for the reading.
 *
 * This is the only path from the app to the Edge Functions, and it exists
 * because without it `src/ai/client.ts` was a module nothing reached: the
 * readers were written, deployed and tested, and no screen could ask them for
 * anything. Generation is a thing the person starts, not something that
 * happens to them — 「今月の地図が生成できます（クリックで生成）」 is a button
 * in the preview, and it is a button here.
 *
 * Insights first, then the summary, because the summary is allowed to lean on
 * what the insights found. Either may come back with nothing; that is an
 * answer, not a failure, and the screen simply stays as it was.
 */
export function useGenerateReading() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { periodType: PeriodType; periodKey: string }) => {
      if (input.periodType === 'month') await readMonthInsights(input.periodKey);
      await readMonthSummary(input.periodKey);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['reading'] });
    },
  });
}
