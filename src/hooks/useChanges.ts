import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { Change, ProgressionVerdict } from '@/types';

/**
 * One month's published changes (§22).
 *
 * The map and the cards under it read from this one query. There is no second
 * hook for "what the map shows": that split is what let a point exist with
 * nothing explaining it, and it is the thing §23 exists to close.
 *
 * An empty array is a real answer and the common one early on (§31).
 */
export function useMonthChanges(monthKey: string) {
  return useQuery<Change[]>({
    queryKey: queryKeys.monthChanges(monthKey),
    queryFn: () => getRepository().listMonthChanges(monthKey),
    enabled: monthKey.length > 0,
  });
}

/**
 * 納得した / 少し違う.
 *
 * The person's answer to a reading, stored beside it rather than over it. It
 * is asked only where the evidence is on screen — agreeing with a claim you
 * cannot see the basis for is not agreement.
 */
export function useChangeVerdict(monthKey: string) {
  const client = useQueryClient();
  return useMutation<Change, Error, { changeId: string; verdict: ProgressionVerdict }>({
    mutationFn: (input) => getRepository().setChangeVerdict(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.monthChanges(monthKey) });
    },
  });
}
