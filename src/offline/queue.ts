import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JournalLog, NewLogInput } from '@/types';
import { uuid } from '@/utils/id';
import { todayIso } from '@/utils/period';

export const QUEUE_KEY = 'crincran:outbox:v1';

export interface QueuedLog extends NewLogInput {
  /** Client-side id; becomes the optimistic log id until the server accepts it. */
  clientId: string;
  occurredOn: string;
  queuedAt: string;
  attempts: number;
}

export async function readQueue(): Promise<QueuedLog[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedLog[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedLog[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueLog(input: NewLogInput): Promise<QueuedLog> {
  const item: QueuedLog = {
    ...input,
    clientId: uuid(),
    occurredOn: input.occurredOn ?? todayIso(),
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

/** Queued items rendered as optimistic logs so the LOG/LIST screens stay honest. */
export function queuedToLogs(items: QueuedLog[], userId: string): JournalLog[] {
  return items.map((item) => ({
    id: item.clientId,
    userId,
    occurredOn: item.occurredOn,
    type: item.type,
    categoryId: item.categoryId,
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
  send: (input: NewLogInput) => Promise<JournalLog>
): Promise<FlushResult> {
  const items = await readQueue();
  let sent = 0;
  for (const item of items) {
    try {
      await send({ type: item.type, categoryId: item.categoryId, body: item.body, occurredOn: item.occurredOn });
      await removeFromQueue(item.clientId);
      sent += 1;
    } catch {
      await markAttempt(item.clientId);
    }
  }
  return { sent, remaining: (await readQueue()).length };
}
