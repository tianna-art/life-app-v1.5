import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { LocalRepository } from '@/data/localRepository';
import { queryKeys } from '@/lib/queryClient';
import { generateCategoryInsight } from '@/ai/client';
import type {
  CategoryInsight,
  KeywordCandidate,
  LogWithAnalysis,
  PeriodType,
  ReviewStatus,
} from '@/types';

export interface InsightArgs {
  periodType: PeriodType;
  periodKey: string;
  categoryId: string;
  categoryName: string;
  logs: LogWithAnalysis[];
  enabled?: boolean;
}

/**
 * Category insight for one period. Cached rows win; otherwise the Edge Function
 * generates one. Only ever requested when the user taps a category node.
 */
export function useCategoryInsight(args: InsightArgs) {
  const { periodType, periodKey, categoryId, categoryName, logs, enabled = true } = args;

  return useQuery<CategoryInsight | null>({
    queryKey: queryKeys.insight(periodType, periodKey, categoryId),
    enabled: enabled && categoryId.length > 0,
    queryFn: async () => {
      const repository = getRepository();
      const cached = await repository.getInsight(periodType, periodKey, categoryId);
      if (cached) return cached;
      if (logs.length === 0) return null;
      const generated = await generateCategoryInsight({
        periodType,
        periodKey,
        categoryId,
        categoryName,
        logs,
      });
      if (repository instanceof LocalRepository) {
        await repository.saveInsight(generated);
      }
      return generated;
    },
  });
}

export function useKeywordReview() {
  const client = useQueryClient();
  return useMutation<
    CategoryInsight,
    Error,
    {
      insight: CategoryInsight;
      status: Exclude<ReviewStatus, 'pending'>;
      finalKeywords: KeywordCandidate[];
    }
  >({
    mutationFn: async ({ insight, status, finalKeywords }) => {
      const repository = getRepository();
      return repository.saveKeywordReview({
        insightId: insight.id,
        status,
        finalKeywords: finalKeywords.slice(0, 3),
      });
    },
    onSuccess: (insight) => {
      void client.invalidateQueries({
        queryKey: queryKeys.insight(insight.periodType, insight.periodKey, insight.categoryId),
      });
    },
  });
}
