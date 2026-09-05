import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JournalEntry, NewEntryInput } from '@/types';
import { uuid } from '@/utils/id';

/** v2: the queued shape lost its type/category fields with the gain model. */
export const QUEUE_KEY = 'crincran:outbox:v2';

export interface QueuedEntry extends NewEntryInput {
  /** Client-side id; stands in for the row id until the server accepts it. */
  clientId: string;
  occurredAt: string;
  queuedAt: string;
  attempts: number;
}

export async function readQueue(): Promise<QueuedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueEntry(input: NewEntryInput): Promise<QueuedEntry> {
  const item: QueuedEntry = {
    ...input,
    clientId: uuid(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  await writeQueue([...(await readQueue()), item]);
  return item;
}

export async function removeFromQueue(clientId: string): Promise<void> {
  await writeQueue((await readQueue()).filter((i) => i.clientId !== clientId));
}

export async function markAttempt(clientId: string): Promise<void> {
  await writeQueue(
    (await readQueue()).map((i) =>
      i.clientId === clientId ? { ...i, attempts: i.attempts + 1 } : i
    )
  );
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Queued items rendered as optimistic entries so the screens stay honest. */
export function queuedToEntries(items: QueuedEntry[], userId: string): JournalEntry[] {
  return items.map((item) => ({
    id: item.clientId,
    userId,
    occurredAt: item.occurredAt,
    occurredOn: item.occurredAt.slice(0, 10),
    inputCategory: item.inputCategory,
    body: item.body,
    createdAt: item.queuedAt,
  }));
}

export interface FlushResult {
  sent: number;
  remaining: number;
}

/** Drain the outbox. Anything that fails again stays queued for the next try. */
export async function flushQueue(
  send: (input: NewEntryInput) => Promise<JournalEntry>
): Promise<FlushResult> {
  const items = await readQueue();
  let sent = 0;
  for (const item of items) {
    try {
      await send({
        inputCategory: item.inputCategory,
        body: item.body,
        occurredAt: item.occurredAt,
      });
      await removeFromQueue(item.clientId);
      sent += 1;
    } catch {
      await markAttempt(item.clientId);
    }
  }
  return { sent, remaining: (await readQueue()).length };
}
