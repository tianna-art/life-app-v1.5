import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { analyzeEntry } from '@/ai/client';
import { buildTodaysGain } from '@/ai/todaysGain';
import { enqueueEntry, flushQueue, queuedToEntries, readQueue } from '@/offline/queue';
import { monthKeyOfDate, yearKeyOfDate } from '@/utils/period';
import type { EntryWithAnalysis, JournalEntry, NewEntryInput, TodaysGain } from '@/types';

function mergeQueued(
  serverEntries: EntryWithAnalysis[],
  queued: EntryWithAnalysis[]
): EntryWithAnalysis[] {
  const seen = new Set(serverEntries.map((e) => e.id));
  return [...queued.filter((e) => !seen.has(e.id)), ...serverEntries].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
  );
}

async function readQueuedFor(predicate: (occurredOn: string) => boolean) {
  const queue = await readQueue();
  return queuedToEntries(
    queue.filter((q) => predicate(q.occurredAt.slice(0, 10))),
    'pending'
  ) as EntryWithAnalysis[];
}

export function useMonthEntries(monthKey: string) {
  return useQuery<EntryWithAnalysis[]>({
    queryKey: queryKeys.monthEntries(monthKey),
    queryFn: async () => {
      const [server, queued] = await Promise.all([
        getRepository().listEntriesByMonth(monthKey),
        readQueuedFor((d) => monthKeyOfDate(d) === monthKey),
      ]);
      return mergeQueued(server, queued);
    },
  });
}

export function useYearEntries(yearKey: string) {
  return useQuery<EntryWithAnalysis[]>({
    queryKey: queryKeys.yearEntries(yearKey),
    queryFn: async () => {
      const [server, queued] = await Promise.all([
        getRepository().listEntriesByYear(yearKey),
        readQueuedFor((d) => yearKeyOfDate(d) === yearKey),
      ]);
      return mergeQueued(server, queued);
    },
  });
}

export function useEntry(id: string) {
  return useQuery<EntryWithAnalysis | null>({
    queryKey: queryKeys.entry(id),
    queryFn: () => getRepository().getEntry(id),
    enabled: id.length > 0,
  });
}

export interface CreateEntryResult {
  entry: JournalEntry;
  queued: boolean;
  todaysGain: TodaysGain | null;
}

/**
 * Save an entry.
 *
 * Contract: the write succeeds or is queued, so the person always keeps their
 * text; the reading runs afterwards and its failure never rolls the entry back.
 */
export function useCreateEntry() {
  const client = useQueryClient();

  return useMutation<CreateEntryResult, Error, NewEntryInput>({
    mutationFn: async (input) => {
      const repository = getRepository();
      let entry: JournalEntry;

      try {
        entry = await repository.createEntry(input);
      } catch (error) {
        // Network or server failure: keep the text in the durable outbox.
        const item = await enqueueEntry(input);
        if (!isNetworkError(error)) {
          console.warn('[crincran] entry save deferred to outbox:', error);
        }
        return {
          entry: {
            id: item.clientId,
            userId: 'pending',
            occurredAt: item.occurredAt,
            occurredOn: item.occurredAt.slice(0, 10),
            inputCategory: item.inputCategory,
            body: item.body,
            createdAt: item.queuedAt,
          },
          queued: true,
          todaysGain: null,
        };
      }

      try {
        const outcome = await analyzeEntry(entry);
        return { entry, queued: false, todaysGain: outcome.todaysGain };
      } catch {
        // The entry stays saved; the day simply goes unread for now.
        return {
          entry,
          queued: false,
          todaysGain: buildTodaysGain({
            logId: entry.id,
            gainStatus: 'unresolved',
            gains: [],
          }),
        };
      }
    },
    onSuccess: (result) => {
      const month = monthKeyOfDate(result.entry.occurredOn);
      const year = yearKeyOfDate(result.entry.occurredOn);
      void client.invalidateQueries({ queryKey: queryKeys.monthEntries(month) });
      void client.invalidateQueries({ queryKey: queryKeys.yearEntries(year) });
      void client.invalidateQueries({ queryKey: queryKeys.gains() });
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
    const result = await flushQueue((input) => repository.createEntry(input));
    if (result.sent > 0) {
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: queryKeys.gains() });
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
