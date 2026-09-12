import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { VisionItem, VisionWord } from '@/types';

export interface Vision {
  items: VisionItem[];
  words: VisionWord[];
}

export function useVision() {
  return useQuery<Vision>({
    queryKey: queryKeys.vision(),
    queryFn: async () => {
      const repository = getRepository();
      const [items, words] = await Promise.all([
        repository.listVisionItems(),
        repository.listVisionWords(),
      ]);
      return { items, words };
    },
  });
}

export function useVisionMutations() {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.vision() });
  };

  const addItem = useMutation({
    mutationFn: (text: string) => getRepository().addVisionItem(text),
    onSuccess: invalidate,
  });
  const addWord = useMutation({
    mutationFn: (text: string) => getRepository().addVisionWord(text),
    onSuccess: invalidate,
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => getRepository().removeVisionItem(id),
    onSuccess: invalidate,
  });
  const removeWord = useMutation({
    mutationFn: (id: string) => getRepository().removeVisionWord(id),
    onSuccess: invalidate,
  });

  return { addItem, addWord, removeItem, removeWord };
}
