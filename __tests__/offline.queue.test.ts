/**
 * The outbox. A record written with no connection is still a record: it is
 * shown in its month straight away and sent when the connection returns.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QUEUE_KEY,
  clearQueue,
  enqueueLog,
  flushQueue,
  queuedToLogs,
  readQueue,
} from '../src/offline/queue';
import type { JournalLog, NewLogInput } from '../src/types';

beforeEach(async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
});

function input(overrides: Partial<NewLogInput> = {}): NewLogInput {
  return {
    body: '知らない街を歩いた',
    occurredOn: '2026-09-12',
    periodKey: '2026-09',
    ...overrides,
  };
}

function sent(payload: NewLogInput): JournalLog {
  return {
    id: 'server-id',
    userId: 'u',
    occurredOn: payload.occurredOn,
    periodKey: payload.periodKey,
    body: payload.body,
    categoryId: payload.categoryId ?? null,
    detailId: payload.detailId ?? null,
    inputMethod: payload.inputMethod ?? 'typed',
    source: payload.source ?? 'manual',
    sourceId: payload.sourceId ?? null,
    createdAt: '2026-09-12T09:00:00Z',
  };
}

describe('the outbox', () => {
  it('keeps the body, the period and the tag that was chosen', async () => {
    await enqueueLog(input({ categoryId: 'progress_did', detailId: 'first_time' }));
    const [queued] = await readQueue();
    expect(queued).toMatchObject({
      body: '知らない街を歩いた',
      periodKey: '2026-09',
      categoryId: 'progress_did',
      detailId: 'first_time',
    });
  });

  it('shows a queued record in its month before it has been sent', async () => {
    await enqueueLog(input());
    const logs = queuedToLogs(await readQueue(), 'pending');
    expect(logs[0]?.periodKey).toBe('2026-09');
    expect(logs[0]?.body).toBe('知らない街を歩いた');
  });

  it('carries a record that has no day — only the month it belongs to', async () => {
    await enqueueLog(input({ occurredOn: null, periodKey: '2025-03' }));
    const logs = queuedToLogs(await readQueue(), 'pending');
    expect(logs[0]?.occurredOn).toBeNull();
    expect(logs[0]?.periodKey).toBe('2025-03');
  });

  it('sends what was queued, and empties as it goes', async () => {
    await enqueueLog(input({ body: 'ひとつめ' }));
    await enqueueLog(input({ body: 'ふたつめ' }));

    const received: NewLogInput[] = [];
    const result = await flushQueue(async (payload) => {
      received.push(payload);
      return sent(payload);
    });

    expect(received.map((r) => r.body)).toEqual(['ひとつめ', 'ふたつめ']);
    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(await readQueue()).toHaveLength(0);
  });

  it('does not send the bookkeeping the queue keeps for itself', async () => {
    await enqueueLog(input());
    const received: NewLogInput[] = [];
    await flushQueue(async (payload) => {
      received.push(payload);
      return sent(payload);
    });
    expect(received[0]).not.toHaveProperty('clientId');
    expect(received[0]).not.toHaveProperty('queuedAt');
    expect(received[0]).not.toHaveProperty('attempts');
  });

  it('keeps anything that failed, and counts the attempt', async () => {
    await enqueueLog(input());
    const result = await flushQueue(async () => {
      throw new Error('offline');
    });
    expect(result).toEqual({ sent: 0, remaining: 1 });
    expect((await readQueue())[0]?.attempts).toBe(1);
  });

  it('can be emptied', async () => {
    await enqueueLog(input());
    await clearQueue();
    expect(await readQueue()).toHaveLength(0);
  });
});
