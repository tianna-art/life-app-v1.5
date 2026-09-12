import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  vision: () => ['vision'] as const,
  yearDirection: (year: number) => ['year-direction', year] as const,
  yearDirectionHistory: (year: number) => ['year-direction', year, 'history'] as const,
  monthDirection: (periodKey: string) => ['month-direction', periodKey] as const,
  categories: () => ['categories'] as const,
  monthLogs: (periodKey: string) => ['logs', 'month', periodKey] as const,
  yearLogs: (year: number) => ['logs', 'year', year] as const,
  logs: (ids: string[]) => ['logs', 'by-id', ...ids] as const,
  futureMemos: () => ['future-memos'] as const,
  lastFlowSession: () => ['flow', 'last'] as const,
  monthSummary: (periodKey: string) => ['reading', 'summary', periodKey] as const,
  monthInsights: (periodKey: string) => ['reading', 'insights', periodKey] as const,
  monthHypothesis: (periodKey: string) => ['reading', 'hypothesis', periodKey] as const,
  periodTitles: (periodType: 'month' | 'year') => ['period-titles', periodType] as const,
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
