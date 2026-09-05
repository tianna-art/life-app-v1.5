import { recentMonths, runBackfill } from '../src/ai/backfill';
import { analyzeLog } from '../src/ai/client';
import type { DailyLog } from '../src/types';

jest.mock('../src/ai/client', () => ({ analyzeLog: jest.fn() }));

const mockAnalyze = analyzeLog as jest.MockedFunction<typeof analyzeLog>;

const log = (id: string, occurredAt: string): DailyLog => ({
  id,
  userId: 'u1',
  occurredAt,
  occurredOn: occurredAt.slice(0, 10),
  logType: 'self_action',
  momentTags: ['tried'],
  createdAt: occurredAt,
});

const outcome = (offline: boolean) =>
  Promise.resolve({
    analysis: { logId: 'x', themes: [], confidence: 0 },
    progressions: [],
    mirror: { logId: 'x', line: '' },
    offline,
  } as unknown as Awaited<ReturnType<typeof analyzeLog>>);

beforeEach(() => {
  mockAnalyze.mockReset();
  mockAnalyze.mockImplementation(() => outcome(false));
});

describe('reading records that were never read', () => {
  it('reads them one at a time, in the order they happened', async () => {
    // §17: STAGE 2 builds progressions as it goes, so a later record must
    // never be read before an earlier one.
    const seen: string[] = [];
    let inFlight = 0;
    mockAnalyze.mockImplementation(async (entry) => {
      expect(inFlight).toBe(0);
      inFlight += 1;
      await Promise.resolve();
      seen.push(entry.id);
      inFlight -= 1;
      return outcome(false);
    });

    await runBackfill([
      log('a', '2026-06-01T09:00:00.000Z'),
      log('b', '2026-07-01T09:00:00.000Z'),
      log('c', '2026-08-01T09:00:00.000Z'),
    ]);

    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('stops between records, never part-way through one', async () => {
    let stop = false;
    mockAnalyze.mockImplementation(async () => {
      stop = true;
      return outcome(false);
    });

    const result = await runBackfill(
      [log('a', '2026-06-01T09:00:00.000Z'), log('b', '2026-07-01T09:00:00.000Z')],
      { shouldStop: () => stop }
    );

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ attempted: 1, read: 1, fellBack: 0, stopped: true });
  });

  it('counts a record that never reached the model separately', async () => {
    // analyzeLog answers locally rather than failing, which is right during a
    // save and misleading here — someone is paying per record.
    mockAnalyze
      .mockImplementationOnce(() => outcome(false))
      .mockImplementationOnce(() => outcome(true));

    const result = await runBackfill([
      log('a', '2026-06-01T09:00:00.000Z'),
      log('b', '2026-07-01T09:00:00.000Z'),
    ]);

    expect(result).toEqual({ attempted: 2, read: 1, fellBack: 1, stopped: false });
  });

  it('reports each record as it goes', async () => {
    const seen: number[] = [];
    await runBackfill([log('a', '2026-06-01T09:00:00.000Z'), log('b', '2026-07-01T09:00:00.000Z')], {
      onProgress: (p) => seen.push(p.done),
    });
    expect(seen).toEqual([1, 2]);
  });

  it('counts the months back from the one we are in', () => {
    expect(recentMonths(4, new Date('2026-09-05T00:00:00Z'))).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });
});
