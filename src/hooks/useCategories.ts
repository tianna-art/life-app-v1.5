import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { Category } from '@/types';

export function useCategories(includeInactive = false) {
  return useQuery<Category[]>({
    queryKey: queryKeys.categories(includeInactive),
    queryFn: () => getRepository().listCategories(includeInactive),
  });
}

export function useCategoryMutations() {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['categories'] });
  };

  const create = useMutation({
    mutationFn: (input: { name: string; promptExamples?: string[] }) =>
      getRepository().createCategory(input),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      getRepository().renameCategory(input.id, input.name),
    onSuccess: invalidate,
  });

  /** Hide / show. Never a hard delete — history keeps the row alive. */
  const setActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      getRepository().setCategoryActive(input.id, input.isActive),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => getRepository().reorderCategories(orderedIds),
    onSuccess: invalidate,
  });

  return { create, rename, setActive, reorder };
}

/** Map of every category, active or not, so historic logs still render a name. */
export function useCategoryLookup() {
  const { data } = useCategories(true);
  const map = new Map<string, Category>();
  for (const category of data ?? []) map.set(category.id, category);
  return map;
}
