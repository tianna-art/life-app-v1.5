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
    logType: input.logType,
    momentTags: input.momentTags,
    aiQuestion: input.aiQuestion,
    optionalAnswer: input.optionalAnswer,
    createdAt: '2026-05-01T09:00:00Z',
  };
}

describe('the outbox', () => {
  it('keeps the door and the tags, which are the whole record (§16)', async () => {
    await enqueueLog({ logType: 'relationship', momentTags: ['first_time', 'enjoyed'] });
    const [queued] = await readQueue();
    expect(queued).toMatchObject({
      logType: 'relationship',
      momentTags: ['first_time', 'enjoyed'],
    });

    const logs = queuedToLogs(await readQueue(), 'pending');
    expect(logs[0]?.momentTags).toEqual(['first_time', 'enjoyed']);
  });

  it('keeps the question with its answer', async () => {
    await enqueueLog({
      logType: 'self_action',
      momentTags: ['changed'],
      aiQuestion: '前と何を変えた？',
      optionalAnswer: '結論から話した',
    });
    const received: NewLogInput[] = [];
    await flushQueue(async (input) => {
      received.push(input);
      return sent(input);
    });
    expect(received[0]).toMatchObject({
      aiQuestion: '前と何を変えた？',
      optionalAnswer: '結論から話した',
    });
  });

  it('sends a record that has no free text at all', async () => {
    await enqueueLog({ logType: 'thought', momentTags: ['friction'] });
    const result = await flushQueue(async (input) => sent(input));
    expect(result).toEqual({ sent: 1, remaining: 0 });
  });

  it('holds on to a record the server refused', async () => {
    await enqueueLog({ logType: 'self_action', momentTags: ['tried'] });
    const result = await flushQueue(async () => {
      throw new Error('network');
    });
    expect(result).toEqual({ sent: 0, remaining: 1 });
    const [still] = await readQueue();
    expect(still?.attempts).toBe(1);
    expect(still?.momentTags).toEqual(['tried']);
  });

  it('clears', async () => {
    await enqueueLog({ logType: 'thought', momentTags: ['discovered'] });
    await clearQueue();
    expect(await readQueue()).toEqual([]);
  });
});
