import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { analyzeLog } from '@/ai/client';
import { buildMirror } from '@/ai/mirror';
import { enqueueLog, flushQueue, queuedToLogs, readQueue } from '@/offline/queue';
import { monthKeyOfDate, yearKeyOfDate } from '@/utils/period';
import type { DailyLog, LogWithAnalysis, Mirror, NewLogInput } from '@/types';

function mergeQueued(server: LogWithAnalysis[], queued: LogWithAnalysis[]): LogWithAnalysis[] {
  const seen = new Set(server.map((l) => l.id));
  return [...queued.filter((l) => !seen.has(l.id)), ...server].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
  );
}

async function readQueuedFor(predicate: (occurredOn: string) => boolean) {
  const queue = await readQueue();
  return queuedToLogs(
    queue.filter((q) => predicate(q.occurredAt.slice(0, 10))),
    'pending'
  ) as LogWithAnalysis[];
}

export function useMonthLogs(monthKey: string) {
  return useQuery<LogWithAnalysis[]>({
    queryKey: queryKeys.monthLogs(monthKey),
    queryFn: async () => {
      const [server, queued] = await Promise.all([
        getRepository().listLogsByMonth(monthKey),
        readQueuedFor((d) => monthKeyOfDate(d) === monthKey),
      ]);
      return mergeQueued(server, queued);
    },
  });
}

export function useYearLogs(yearKey: string) {
  return useQuery<LogWithAnalysis[]>({
    queryKey: queryKeys.yearLogs(yearKey),
    queryFn: async () => {
      const [server, queued] = await Promise.all([
        getRepository().listLogsByYear(yearKey),
        readQueuedFor((d) => yearKeyOfDate(d) === yearKey),
      ]);
      return mergeQueued(server, queued);
    },
  });
}

export function useLog(id: string) {
  return useQuery<LogWithAnalysis | null>({
    queryKey: queryKeys.log(id),
    queryFn: () => getRepository().getLog(id),
    enabled: id.length > 0,
  });
}

export interface CreateLogResult {
  log: DailyLog;
  queued: boolean;
  mirror: Mirror | null;
}

/**
 * Save a record.
 *
 * Contract: the write succeeds or is queued, so the person always keeps what
 * they tapped; the reading runs afterwards and its failure never rolls the
 * record back.
 */
export function useCreateLog() {
  const client = useQueryClient();

  return useMutation<CreateLogResult, Error, NewLogInput>({
    mutationFn: async (input) => {
      const repository = getRepository();
      let log: DailyLog;

      try {
        log = await repository.createLog(input);
      } catch (error) {
        // Network or server failure: keep it in the durable outbox.
        const item = await enqueueLog(input);
        if (!isNetworkError(error)) {
          console.warn('[crincran] log save deferred to outbox:', error);
        }
        return {
          log: {
            id: item.clientId,
            userId: 'pending',
            occurredAt: item.occurredAt,
            occurredOn: item.occurredAt.slice(0, 10),
            logType: item.logType,
            momentTags: item.momentTags,
            aiQuestion: item.aiQuestion,
            optionalAnswer: item.optionalAnswer,
            createdAt: item.queuedAt,
          },
          queued: true,
          mirror: null,
        };
      }

      try {
        const outcome = await analyzeLog(log);
        return { log, queued: false, mirror: outcome.mirror };
      } catch {
        // The record stays saved; the day simply goes unread for now. The
        // mirror still works, because it only needs the tags.
        return {
          log,
          queued: false,
          mirror: buildMirror({ logId: log.id, momentTags: log.momentTags, joined: [] }),
        };
      }
    },
    onSuccess: (result) => {
      const month = monthKeyOfDate(result.log.occurredOn);
      const year = yearKeyOfDate(result.log.occurredOn);
      void client.invalidateQueries({ queryKey: queryKeys.monthLogs(month) });
      void client.invalidateQueries({ queryKey: queryKeys.yearLogs(year) });
      void client.invalidateQueries({ queryKey: queryKeys.progressions() });
    },
  });
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|offline|Failed to fetch/i.test(message);
}

/** Drains the outbox whenever connectivity returns. */
export function useOutboxSync() {
  const client = useQueryClient();

  const flush = useCallback(async () => {
    const repository = getRepository();
    const result = await flushQueue((input) => repository.createLog(input));
    if (result.sent > 0) {
      void client.invalidateQueries({ queryKey: ['logs'] });
      void client.invalidateQueries({ queryKey: queryKeys.progressions() });
    }
    return result;
  }, [client]);

  useEffect(() => {
    void flush();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flush();
    });
    return () => unsubscribe();
  }, [flush]);

  return { flush };
}
