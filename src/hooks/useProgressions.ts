import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type {
  Clarification,
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

/** One month's sky. Exactly one month is ever on screen (§24). */
export function useMonthProgressions(monthKey: string) {
  return useQuery<MonthProgression[]>({
    queryKey: queryKeys.monthProgressions(monthKey),
    queryFn: () => getRepository().listMonthProgressions(monthKey),
    enabled: monthKey.length > 0,
  });
}

/** The path and whatever remains — loaded only when a node is tapped (§21). */
export function useProgressionDetail(id: string | null) {
  return useQuery<ProgressionDetail | null>({
    queryKey: queryKeys.progressionDetail(id ?? ''),
    queryFn: () => getRepository().getProgressionDetail(id as string),
    enabled: Boolean(id),
  });
}

/**
 * 納得した / 少し違う (§28).
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
      void client.invalidateQueries({
        queryKey: queryKeys.progressionDetail(progression.id),
      });
    },
  });
}

/**
 * The one optional question (§14).
 *
 * At most one is ever outstanding, and skipping counts as answering, so the
 * same question never comes back.
 */
export function usePendingClarification() {
  return useQuery<Clarification | null>({
    queryKey: queryKeys.clarification(),
    queryFn: () => getRepository().getPendingClarification(),
  });
}

export function useAnswerClarification() {
  const client = useQueryClient();
  return useMutation<void, Error, { id: string; answer: string | null }>({
    mutationFn: (input) => getRepository().answerClarification(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.clarification() });
      void client.invalidateQueries({ queryKey: queryKeys.progressions() });
    },
  });
}
