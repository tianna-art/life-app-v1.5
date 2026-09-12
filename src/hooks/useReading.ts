import { useQuery } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { MonthHypothesis, MonthInsight, MonthSummary } from '@/types';

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

export function useMonthSummary(periodKey: string) {
  return useQuery<MonthSummary | null>({
    queryKey: queryKeys.monthSummary(periodKey),
    queryFn: () => getRepository().getMonthSummary(periodKey),
  });
}
