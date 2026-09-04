import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { generateTitleCandidates } from '@/ai/client';
import type { PeriodTitle, PeriodType, TitleCandidate } from '@/types';

export function usePeriodTitle(periodType: PeriodType, periodKey: string) {
  return useQuery<PeriodTitle | null>({
    queryKey: queryKeys.title(periodType, periodKey),
    queryFn: () => getRepository().getTitle(periodType, periodKey),
    enabled: periodKey.length > 0,
  });
}

export function useMonthlyTitles(yearKey: string) {
  return useQuery<PeriodTitle[]>({
    queryKey: queryKeys.titles('month', yearKey),
    queryFn: () => getRepository().listTitles('month', yearKey),
  });
}

export function useSaveTitle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (title: PeriodTitle) => getRepository().upsertTitle(title),
    onSuccess: (title) => {
      void client.invalidateQueries({ queryKey: queryKeys.title(title.periodType, title.periodKey) });
      void client.invalidateQueries({ queryKey: ['titles'] });
    },
  });
}

/** Asks the Edge Function for 3 candidates. The user always confirms. */
export function useTitleCandidates() {
  return useMutation<TitleCandidate[], Error, { periodType: PeriodType; periodKey: string; periodLabel: string }>(
    {
      mutationFn: async (input) => {
        const result = await generateTitleCandidates(input);
        return result.candidates;
      },
    }
  );
}
