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

const asEntry = (input: NewEntryInput): JournalEntry => ({
  id: 'server-id',
  userId: 'u1',
  occurredAt: input.occurredAt ?? '2026-09-05T12:00:00.000Z',
  occurredOn: (input.occurredAt ?? '2026-09-05T12:00:00.000Z').slice(0, 10),
  inputCategory: input.inputCategory,
  body: input.body,
  createdAt: '2026-09-05T12:00:00.000Z',
});

describe('the text is never lost', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
  });

  it('keeps a record that could not be sent', async () => {
    await enqueueEntry({ inputCategory: 'friction', body: '反応がなかった。' });
    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ inputCategory: 'friction', body: '反応がなかった。' });
  });

  it('shows queued records on screen as if they were saved', async () => {
    await enqueueEntry({
      inputCategory: 'progress',
      body: '骨組みを書いた。',
      occurredAt: '2026-09-05T21:00:00.000Z',
    });
    const [entry] = queuedToEntries(await readQueue(), 'pending');
    expect(entry?.occurredOn).toBe('2026-09-05');
    expect(entry?.body).toBe('骨組みを書いた。');
  });

  it('sends what it can and keeps what it cannot', async () => {
    await enqueueEntry({ inputCategory: 'progress', body: 'ひとつめ' });
    await enqueueEntry({ inputCategory: 'moved', body: 'ふたつめ' });

    const result = await flushQueue(async (input) => {
      if (input.body === 'ふたつめ') throw new Error('network');
      return asEntry(input);
    });

    expect(result).toEqual({ sent: 1, remaining: 1 });
    const queue = await readQueue();
    expect(queue[0]).toMatchObject({ body: 'ふたつめ', attempts: 1 });
  });

  it('survives a corrupted store rather than throwing at the person', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, 'not json');
    expect(await readQueue()).toEqual([]);
  });

  it('empties on request', async () => {
    await enqueueEntry({ inputCategory: 'moved', body: 'あ' });
    await clearQueue();
    expect(await readQueue()).toEqual([]);
  });
});
