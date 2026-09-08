import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QUEUE_KEY,
  clearQueue,
  enqueueLog,
  flushQueue,
  queuedToLogs,
  readQueue,
} from '../src/offline/queue';
import type { DailyLog, NewLogInput } from '../src/types';

beforeEach(async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
});

function sent(input: NewLogInput): DailyLog {
  return {
    id: 'server-id',
    userId: 'u',
    occurredAt: input.occurredAt ?? '2026-05-01T09:00:00Z',
    occurredOn: (input.occurredAt ?? '2026-05-01').slice(0, 10),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.detailId ? { detailId: input.detailId } : {}),
    ...(input.body ? { body: input.body } : {}),
    inputMethod: input.inputMethod ?? 'category',
    classificationSource: 'user',
    classificationStatus: input.categoryId ? 'confirmed' : 'unclassified',
    aiSignals: [],
    createdAt: '2026-05-01T09:00:00Z',
  };
}

describe('the outbox', () => {
  it('keeps the category and the detail, which are the whole record', async () => {
    await enqueueLog({ categoryId: 'progress_did', detailId: 'first_time' });
    const [queued] = await readQueue();
    expect(queued).toMatchObject({ categoryId: 'progress_did', detailId: 'first_time' });

    const logs = queuedToLogs(await readQueue(), 'pending');
    expect(logs[0]).toMatchObject({ categoryId: 'progress_did', detailId: 'first_time' });
  });

  it('keeps what was written with it', async () => {
    await enqueueLog({ categoryId: 'progress_tried', body: '結論から話した' });
    const received: NewLogInput[] = [];
    await flushQueue(async (input) => {
      received.push(input);
      return sent(input);
    });
    expect(received[0]).toMatchObject({
      categoryId: 'progress_tried',
      body: '結論から話した',
    });
  });

  it('sends a record that has no free text at all', async () => {
    await enqueueLog({ categoryId: 'progress_tried' });
    const result = await flushQueue(async (input) => sent(input));
    expect(result).toEqual({ sent: 1, remaining: 0 });
  });

  it('holds on to a record the server refused', async () => {
    await enqueueLog({ categoryId: 'progress_tried' });
    const result = await flushQueue(async () => {
      throw new Error('network');
    });
    expect(result).toEqual({ sent: 0, remaining: 1 });
    const [still] = await readQueue();
    expect(still?.attempts).toBe(1);
    expect(still?.categoryId).toBe('progress_tried');
  });

  it('clears', async () => {
    await enqueueLog({ categoryId: 'progress_tried' });
    await clearQueue();
    expect(await readQueue()).toEqual([]);
  });
});
