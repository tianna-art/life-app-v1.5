import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type {
  Gain,
  MonthProgression,
  Progression,
  ProgressionDetail,
  ProgressionVerdict,
} from '@/types';

/** Every progression still standing, most recently moved first. */
export function useProgressions() {
  return useQuery<Progression[]>({
    queryKey: queryKeys.progressions(),
    queryFn: () => getRepository().listProgressions(),
  });
}

/** One month's sky. Exactly one month is ever on screen. */
export function useMonthProgressions(monthKey: string) {
  return useQuery<MonthProgression[]>({
    queryKey: queryKeys.monthProgressions(monthKey),
    queryFn: () => getRepository().listMonthProgressions(monthKey),
    enabled: monthKey.length > 0,
  });
}

/** The path and whatever remains — loaded only when a node is tapped (§23). */
export function useProgressionDetail(id: string | null) {
  return useQuery<ProgressionDetail | null>({
    queryKey: queryKeys.progressionDetail(id ?? ''),
    queryFn: () => getRepository().getProgressionDetail(id as string),
    enabled: Boolean(id),
  });
}

export function useGains() {
  return useQuery<Gain[]>({
    queryKey: queryKeys.gains(),
    queryFn: () => getRepository().listGains(),
  });
}

/**
 * 納得した / 少し違う.
 *
 * The whole feedback surface: a verdict, and — when the person says it is
 * slightly off — their own wording in place of the model's. Asked only when
 * they have opened the detail, never after a save.
 */
export function useProgressionVerdict() {
  const client = useQueryClient();
  return useMutation<
    Progression,
    Error,
    { progressionId: string; verdict: ProgressionVerdict; title?: string; summary?: string }
  >({
    mutationFn: (input) => getRepository().setProgressionVerdict(input),
    onSuccess: (progression) => {
      void client.invalidateQueries({ queryKey: queryKeys.progressions() });
      void client.invalidateQueries({ queryKey: queryKeys.progressionDetail(progression.id) });
    },
  });
}
