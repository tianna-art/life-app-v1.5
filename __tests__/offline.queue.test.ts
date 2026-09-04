/**
 * Offline: a save that cannot reach the server is kept locally and replayed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearQueue, enqueueLog, flushQueue, queuedToLogs, readQueue } from '@/offline/queue';
import type { JournalLog, NewLogInput } from '@/types';

describe('outbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearQueue();
  });

  it('holds a log until it can be sent', async () => {
    await enqueueLog({ type: 'event', categoryId: 'c1', body: '電波のない場所で書いた' });
    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.body).toBe('電波のない場所で書いた');
    expect(queue[0]?.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('surfaces queued items as optimistic logs', async () => {
    await enqueueLog({ type: 'thought', categoryId: 'c1', body: 'まだ届いていない' });
    const optimistic = queuedToLogs(await readQueue(), 'pending');
    expect(optimistic[0]).toMatchObject({ body: 'まだ届いていない', type: 'thought' });
  });

  it('drains the queue once the send succeeds', async () => {
    await enqueueLog({ type: 'event', categoryId: 'c1', body: '一件目' });
    await enqueueLog({ type: 'event', categoryId: 'c1', body: '二件目' });

    const sent: NewLogInput[] = [];
    const result = await flushQueue(async (input) => {
      sent.push(input);
      return { id: 'server', userId: 'u', createdAt: '', ...input, occurredOn: '2026-09-04' } as JournalLog;
    });

    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(sent.map((s) => s.body)).toEqual(['一件目', '二件目']);
    expect(await readQueue()).toHaveLength(0);
  });

  it('keeps anything that fails again, and counts the attempt', async () => {
    await enqueueLog({ type: 'event', categoryId: 'c1', body: 'まだ送れない' });

    const result = await flushQueue(async () => {
      throw new Error('network');
    });

    expect(result).toEqual({ sent: 0, remaining: 1 });
    const queue = await readQueue();
    expect(queue[0]?.attempts).toBe(1);
    expect(queue[0]?.body).toBe('まだ送れない');
  });
});
