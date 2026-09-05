import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { MonthGain } from '@/data/repository';
import type { Gain, GainDetail, GainVerdict } from '@/types';

/** Every gain still standing, newest sighting first. */
export function useGains() {
  return useQuery<Gain[]>({
    queryKey: queryKeys.gains(),
    queryFn: () => getRepository().listGains(),
  });
}

/** One month's sky. Exactly one month is ever on screen (§18). */
export function useMonthGains(monthKey: string) {
  return useQuery<MonthGain[]>({
    queryKey: queryKeys.monthGains(monthKey),
    queryFn: () => getRepository().listMonthGains(monthKey),
    enabled: monthKey.length > 0,
  });
}

/** Gain plus the path that formed it — loaded only when a node is tapped. */
export function useGainDetail(gainId: string | null) {
  return useQuery<GainDetail | null>({
    queryKey: queryKeys.gainDetail(gainId ?? ''),
    queryFn: () => getRepository().getGainDetail(gainId as string),
    enabled: Boolean(gainId),
  });
}

/**
 * 納得した / 少し違う (§27). The whole feedback surface: a verdict, and — when
 * the person says it is slightly off — their own wording in place of the label.
 */
export function useGainVerdict() {
  const client = useQueryClient();
  return useMutation<Gain, Error, { gainId: string; verdict: GainVerdict; label?: string }>({
    mutationFn: (input) => getRepository().setGainVerdict(input),
    onSuccess: (gain) => {
      void client.invalidateQueries({ queryKey: queryKeys.gains() });
      void client.invalidateQueries({ queryKey: queryKeys.gainDetail(gain.id) });
    },
  });
}
