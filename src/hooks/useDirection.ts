import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { AntennaId, MonthDirection, YearDirection } from '@/types';

export function useYearDirection(year: number) {
  return useQuery<YearDirection | null>({
    queryKey: queryKeys.yearDirection(year),
    queryFn: () => getRepository().getYearDirection(year),
  });
}

export function useMonthDirection(periodKey: string) {
  return useQuery<MonthDirection | null>({
    queryKey: queryKeys.monthDirection(periodKey),
    queryFn: () => getRepository().getMonthDirection(periodKey),
  });
}

export function useSaveYearDirection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { year: number; direction: string; keywords?: string[]; answers?: string[] }) =>
      getRepository().saveYearDirection(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['year-direction'] });
    },
  });
}

export function useSaveMonthDirection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodKey: string; antennaIds: AntennaId[] }) =>
      getRepository().saveMonthDirection(input.periodKey, input.antennaIds),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['month-direction'] });
    },
  });
}
