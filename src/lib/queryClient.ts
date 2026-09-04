import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  categories: (includeInactive: boolean) => ['categories', includeInactive] as const,
  monthLogs: (monthKey: string) => ['logs', 'month', monthKey] as const,
  yearLogs: (yearKey: string) => ['logs', 'year', yearKey] as const,
  log: (id: string) => ['log', id] as const,
  title: (periodType: string, periodKey: string) => ['title', periodType, periodKey] as const,
  titles: (periodType: string, yearKey: string) => ['titles', periodType, yearKey] as const,
  intention: (periodKey: string) => ['intention', periodKey] as const,
  insight: (periodType: string, periodKey: string, categoryId: string) =>
    ['insight', periodType, periodKey, categoryId] as const,
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
