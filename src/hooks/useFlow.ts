import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { FlowSession, FlowStage } from '@/types';

export function useLastFlowSession() {
  return useQuery<FlowSession | null>({
    queryKey: queryKeys.lastFlowSession(),
    queryFn: () => getRepository().lastFlowSession(),
  });
}

export function useSaveFlowSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entries: Partial<Record<FlowStage, string>>) =>
      getRepository().saveFlowSession(entries),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.lastFlowSession() });
    },
  });
}
