import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { MonthlyIntention } from '@/types';

/** Optional. Never required, never evaluated for achievement (spec §5). */
export function useMonthlyIntention(periodKey: string) {
  return useQuery<MonthlyIntention | null>({
    queryKey: queryKeys.intention(periodKey),
    queryFn: () => getRepository().getIntention(periodKey),
    enabled: periodKey.length > 0,
  });
}

export function useYearIntentions(yearKey: string) {
  return useQuery<MonthlyIntention[]>({
    queryKey: ['intentions', yearKey],
    queryFn: () => getRepository().listIntentions(yearKey),
  });
}

export function useSaveIntention() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (intention: MonthlyIntention) => getRepository().upsertIntention(intention),
    onSuccess: (intention) => {
      void client.invalidateQueries({ queryKey: queryKeys.intention(intention.periodKey) });
      void client.invalidateQueries({ queryKey: ['intentions'] });
    },
  });
}
