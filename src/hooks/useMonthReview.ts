import { useQuery } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { generateMonthReview } from '@/ai/client';
import { buildLocalMonthReview } from '@/ai/monthReview';
import { isMonthEndReached } from '@/utils/period';
import type { MonthReview } from '@/types';

/**
 * The month-end reading (§23).
 *
 * Only ever requested once the month is actually over — nothing is summarised
 * while it is still being lived — and a stored review always wins so the same
 * month reads the same way every time it is opened.
 */
export function useMonthReview(periodKey: string, options: { enabled?: boolean } = {}) {
  const enabled = (options.enabled ?? true) && periodKey.length > 0;

  return useQuery<MonthReview | null>({
    queryKey: queryKeys.monthReview(periodKey),
    enabled,
    queryFn: async () => {
      const repository = getRepository();
      const stored = await repository.getMonthReview(periodKey);
      if (stored) return stored;
      if (!isMonthEndReached(periodKey)) return null;

      const entries = await repository.listEntriesByMonth(periodKey);
      if (entries.length === 0) return null;

      const generated = await generateMonthReview(periodKey);
      if (generated) return repository.saveMonthReview(generated);

      // No model reachable: the local reading is built from the progressions
      // already stored for the month, and says nothing beyond them.
      const local = buildLocalMonthReview({
        periodKey,
        entries,
        progressions: await repository.listMonthProgressions(periodKey),
      });
      return local ? repository.saveMonthReview(local) : null;
    },
  });
}

export function useMonthReviews(yearKey: string) {
  return useQuery<MonthReview[]>({
    queryKey: queryKeys.monthReviews(yearKey),
    queryFn: () => getRepository().listMonthReviews(yearKey),
  });
}
