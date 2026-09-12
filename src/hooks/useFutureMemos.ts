import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { FutureMemo, NewFutureMemoInput } from '@/types';

export function useFutureMemos() {
  return useQuery<FutureMemo[]>({
    queryKey: queryKeys.futureMemos(),
    queryFn: () => getRepository().listFutureMemos(),
  });
}

export function useFutureMemoMutations() {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.futureMemos() });
  };

  const create = useMutation({
    mutationFn: (input: NewFutureMemoInput) => getRepository().createFutureMemo(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; patch: Partial<FutureMemo> }) =>
      getRepository().updateFutureMemo(input.id, input.patch),
    onSuccess: invalidate,
  });

  return { create, update };
}
