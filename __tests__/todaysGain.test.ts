import { buildTodaysGain } from '../src/ai/todaysGain';
import { UNRESOLVED_LINE } from '../src/constants/copy';
import type { Gain } from '../src/types';

const gain = (over: Partial<Gain> = {}): Gain => ({
  id: 'g1',
  userId: 'u1',
  type: 'strategy',
  label: '先に人に見せる',
  maturity: 'signal',
  confidence: 0.4,
  firstDetectedAt: '2026-09-01T00:00:00.000Z',
  lastDetectedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe("today's gain", () => {
  it('says nothing was decided when nothing could be read', () => {
    expect(buildTodaysGain({ logId: 'l1', gainStatus: 'unresolved', gains: [] }).line).toBe(
      UNRESOLVED_LINE
    );
  });

  it('does not invent a line when the reading found no gain', () => {
    expect(buildTodaysGain({ logId: 'l1', gainStatus: 'possible', gains: [] }).line).toBe(
      UNRESOLVED_LINE
    );
  });

  it('quotes the gain back rather than judging it', () => {
    const result = buildTodaysGain({
      logId: 'l1',
      gainStatus: 'possible',
      gains: [gain()],
    });
    expect(result.line).toContain('先に人に見せる');
    expect(result.gainId).toBe('g1');
  });

  it('stays descriptive for an early capability instead of claiming a skill', () => {
    const line = buildTodaysGain({
      logId: 'l1',
      gainStatus: 'possible',
      gains: [gain({ type: 'capability', label: 'プレゼン', maturity: 'attempt' })],
    }).line;
    expect(line).toContain('やってみた');
    expect(line).not.toContain('身についた');
  });

  it('never praises, scores or generalises about the person', () => {
    const forbidden = ['素晴らしい', '成長', 'あなたは', '%', '点'];
    for (const type of ['capability', 'insight', 'strategy', 'direction', 'connection', 'evidence'] as const) {
      for (const maturity of ['signal', 'established'] as const) {
        const line = buildTodaysGain({
          logId: 'l1',
          gainStatus: 'possible',
          gains: [gain({ type, maturity })],
        }).line;
        for (const phrase of forbidden) expect(line).not.toContain(phrase);
        expect(Array.from(line).length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('shows one gain, not a list', () => {
    const result = buildTodaysGain({
      logId: 'l1',
      gainStatus: 'possible',
      gains: [
        gain({ id: 'a', label: 'あ', lastDetectedAt: '2026-09-01T00:00:00.000Z' }),
        gain({ id: 'b', label: 'い', lastDetectedAt: '2026-09-05T00:00:00.000Z' }),
      ],
    });
    expect(result.gainId).toBe('b');
    expect(result.line).not.toContain('あ');
  });
});
