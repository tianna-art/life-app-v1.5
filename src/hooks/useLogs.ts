import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { enqueueLog, flushQueue, queuedToLogs, readQueue } from '@/offline/queue';
import type { JournalLog, NewLogInput } from '@/types';

/**
 * Queued records first, then what the server has. A record written a moment
 * ago should be at the top of the month whether or not it has been sent.
 */
function merge(server: JournalLog[], queued: JournalLog[]): JournalLog[] {
  const seen = new Set(server.map((l) => l.id));
  return [...queued.filter((l) => !seen.has(l.id)), ...server].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

async function queuedFor(matches: (periodKey: string) => boolean): Promise<JournalLog[]> {
  const queue = await readQueue();
  return queuedToLogs(
    queue.filter((q) => matches(q.periodKey)),
    'pending'
  );
}

export function useMonthLogs(periodKey: string) {
  return useQuery<JournalLog[]>({
    queryKey: queryKeys.monthLogs(periodKey),
    queryFn: async () => {
      const server = await getRepository().listLogs(periodKey);
      return merge(server, await queuedFor((key) => key === periodKey));
    },
  });
}

export function useYearLogs(year: number) {
  return useQuery<JournalLog[]>({
    queryKey: queryKeys.yearLogs(year),
    queryFn: async () => {
      const server = await getRepository().listLogsInYear(year);
      return merge(server, await queuedFor((key) => key.startsWith(String(year))));
    },
  });
}

export function useLogsById(ids: string[]) {
  return useQuery<JournalLog[]>({
    queryKey: queryKeys.logs(ids),
    queryFn: () => getRepository().getLogs(ids),
    enabled: ids.length > 0,
  });
}

export interface CreateLogResult {
  log: JournalLog | null;
  queued: boolean;
}

/**
 * Writing a record.
 *
 * The contract is that the write either lands or is queued — never lost, and
 * never rolled back by something that happens afterwards. Nothing else runs
 * inside this mutation, so there is nothing else that can fail it.
 */
export function useCreateLog() {
  const client = useQueryClient();
  return useMutation<CreateLogResult, Error, NewLogInput>({
    mutationFn: async (input) => {
      try {
        const log = await getRepository().createLog(input);
        return { log, queued: false };
      } catch {
        await enqueueLog(input);
        return { log: null, queued: true };
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useDeleteLog() {
  const client = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => getRepository().deleteLog(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

/** Drains the outbox whenever the connection comes back. */
export function useOutboxSync(): void {
  const client = useQueryClient();
  const flush = useCallback(async () => {
    const result = await flushQueue((input) => getRepository().createLog(input));
    if (result.sent > 0) void client.invalidateQueries({ queryKey: ['logs'] });
  }, [client]);

  useEffect(() => {
    void flush();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flush();
    });
    return () => unsubscribe();
  }, [flush]);
}
