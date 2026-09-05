import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QUEUE_KEY,
  clearQueue,
  enqueueEntry,
  flushQueue,
  queuedToEntries,
  readQueue,
} from '../src/offline/queue';
import type { JournalEntry, NewEntryInput } from '../src/types';

beforeEach(async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
});

function sent(input: NewEntryInput): JournalEntry {
  return {
    id: 'server-id',
    userId: 'u',
    occurredAt: input.occurredAt ?? '2026-05-01T09:00:00Z',
    occurredOn: (input.occurredAt ?? '2026-05-01').slice(0, 10),
    type: input.type,
    body: input.body,
    subjectiveSignal: input.subjectiveSignal,
    createdAt: '2026-05-01T09:00:00Z',
  };
}

describe('the outbox', () => {
  it('keeps the drawer and the mark, not just the text', async () => {
    await enqueueEntry({ type: 'thought', body: '怖い', subjectiveSignal: 'negative' });
    const [queued] = await readQueue();
    expect(queued).toMatchObject({ type: 'thought', subjectiveSignal: 'negative' });

    const entries = queuedToEntries(await readQueue(), 'pending');
    expect(entries[0]).toMatchObject({ type: 'thought', subjectiveSignal: 'negative' });
  });

  it('sends everything it kept', async () => {
    await enqueueEntry({ type: 'event', body: '見せた', subjectiveSignal: 'positive' });
    const received: NewEntryInput[] = [];

    const result = await flushQueue(async (input) => {
      received.push(input);
      return sent(input);
    });

    expect(result).toEqual({ sent: 1, remaining: 0 });
    expect(received[0]).toMatchObject({
      type: 'event',
      body: '見せた',
      subjectiveSignal: 'positive',
    });
  });

  it('holds on to a record the server refused', async () => {
    await enqueueEntry({ type: 'event', body: '見せた', subjectiveSignal: 'mixed' });

    const result = await flushQueue(async () => {
      throw new Error('network');
    });

    expect(result).toEqual({ sent: 0, remaining: 1 });
    const [still] = await readQueue();
    expect(still?.attempts).toBe(1);
    expect(still?.body).toBe('見せた');
  });

  it('clears', async () => {
    await enqueueEntry({ type: 'event', body: 'x', subjectiveSignal: 'mixed' });
    await clearQueue();
    expect(await readQueue()).toEqual([]);
  });
});
