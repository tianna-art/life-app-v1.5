import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { analyzeLog } from '@/ai/client';
import { LocalRepository } from '@/data/localRepository';
import { analyzeLogText } from '@/ai/client';
import { enqueueLog, flushQueue, queuedToLogs, readQueue } from '@/offline/queue';
import { monthKeyOfDate, yearKeyOfDate } from '@/utils/period';
import type { JournalLog, LogWithAnalysis, NewLogInput } from '@/types';

function mergeQueued(
  serverLogs: LogWithAnalysis[],
  queued: LogWithAnalysis[]
): LogWithAnalysis[] {
  const seen = new Set(serverLogs.map((l) => l.id));
  return [...queued.filter((l) => !seen.has(l.id)), ...serverLogs].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
  );
}

async function readQueuedFor(predicate: (occurredOn: string) => boolean) {
  const queue = await readQueue();
  return queuedToLogs(
    queue.filter((q) => predicate(q.occurredOn)),
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
  log: JournalLog;
  queued: boolean;
  analysisFailed: boolean;
}

/**
 * Save a log.
 *
 * Contract (spec §3.6 / §17):
 *  - the write succeeds or is queued; the user always keeps their text
 *  - AI analysis runs afterwards, asynchronously
 *  - an AI failure NEVER rolls the log back
 */
export function useCreateLog() {
  const client = useQueryClient();

  return useMutation<CreateLogResult, Error, NewLogInput>({
    mutationFn: async (input) => {
      const repository = getRepository();
      let log: JournalLog;
      let queued = false;

      try {
        log = await repository.createLog(input);
      } catch (error) {
        // Network / server failure: keep the text in the durable outbox.
        const item = await enqueueLog(input);
        if (!isNetworkError(error)) {
          // Anything else is still queued, but surfaced for diagnostics.
          console.warn('[crincran] log save deferred to outbox:', error);
        }
        return {
          log: {
            id: item.clientId,
            userId: 'pending',
            occurredOn: item.occurredOn,
            type: item.type,
            categoryId: item.categoryId,
            body: item.body,
            createdAt: item.queuedAt,
          },
          queued: true,
          analysisFailed: false,
        };
      }

      let analysisFailed = false;
      try {
        const repo = repository;
        if (repo instanceof LocalRepository) {
          const analysis = await analyzeLogText(log.body);
          await repo.saveAnalysis(log.id, { logId: log.id, ...analysis });
        } else {
          const result = await analyzeLog(log.id);
          analysisFailed = result === null;
        }
      } catch {
        analysisFailed = true; // The log stays saved.
      }

      return { log, queued, analysisFailed };
    },
    onSuccess: (result) => {
      const month = monthKeyOfDate(result.log.occurredOn);
      const year = yearKeyOfDate(result.log.occurredOn);
      void client.invalidateQueries({ queryKey: queryKeys.monthLogs(month) });
      void client.invalidateQueries({ queryKey: queryKeys.yearLogs(year) });
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
