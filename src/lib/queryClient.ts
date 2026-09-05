import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  monthEntries: (monthKey: string) => ['entries', 'month', monthKey] as const,
  yearEntries: (yearKey: string) => ['entries', 'year', yearKey] as const,
  entry: (id: string) => ['entry', id] as const,
  progressions: () => ['progressions'] as const,
  monthProgressions: (monthKey: string) => ['progressions', 'month', monthKey] as const,
  progressionDetail: (id: string) => ['progressions', 'detail', id] as const,
  clarification: () => ['clarification'] as const,
  monthReview: (periodKey: string) => ['review', periodKey] as const,
  monthReviews: (yearKey: string) => ['review', 'year', yearKey] as const,
  outbox: () => ['outbox'] as const,
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}
