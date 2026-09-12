import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { PeriodTitle, PeriodType } from '@/types';

/** The month the person started, so earlier ones are offered a typed name. */
export function useFirstRecordedPeriod() {
  return useQuery<string | null>({
    queryKey: queryKeys.firstRecorded(),
    queryFn: () => getRepository().firstRecordedPeriod(),
  });
}

export function usePeriodTitles(periodType: PeriodType) {
  return useQuery<PeriodTitle[]>({
    queryKey: queryKeys.periodTitles(periodType),
    queryFn: () => getRepository().listPeriodTitles(periodType),
  });
}

export function useSavePeriodTitle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      periodType: PeriodType;
      periodKey: string;
      title: string;
      source?: 'manual' | 'ai';
    }) => getRepository().savePeriodTitle(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['period-titles'] });
    },
  });
}
