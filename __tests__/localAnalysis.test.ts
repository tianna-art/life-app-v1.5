import { analyzeLocally } from '../src/ai/localAnalysis';
import type { LogWithAnalysis, LogType, MomentTag } from '../src/types';

function log(
  id: string,
  logType: LogType,
  momentTags: MomentTag[],
  day: string,
  answer?: string
): LogWithAnalysis {
  return {
    id,
    userId: 'u',
    occurredAt: `2026-${day}T09:00:00Z`,
    occurredOn: `2026-${day}`,
    logType,
    momentTags,
    optionalAnswer: answer,
    createdAt: `2026-${day}T09:00:00Z`,
  };
}

describe('the offline reading', () => {
  it('leaves the first record as a dot (§31)', () => {
    const result = analyzeLocally({
      logId: 'first',
      logType: 'self_action',
      momentTags: ['first_time'],
      optionalAnswer: '初めて友達に見せた',
      occurredAt: '2026-05-01T09:00:00Z',
      history: [],
    });
    expect(result.progressions).toEqual([]);
  });

  it('finds a pattern the tags actually show, with no model', () => {
    // friction → changed → retry. §18's three points, from taps alone.
    const history = [
      log('a', 'self_action', ['friction'], '04-01'),
      log('b', 'self_action', ['changed'], '05-01'),
    ];
    const result = analyzeLocally({
      logId: 'c',
      logType: 'self_action',
      momentTags: ['tried'],
      optionalAnswer: '結論から説明した',
      occurredAt: '2026-06-01T09:00:00Z',
      history,
    });
    expect(result.progressions).toHaveLength(1);
    expect(result.progressions[0]?.pattern).toBe('pivot');
  });

  it('claims no direction it cannot see', () => {
    const history = [
      log('a', 'self_action', ['friction'], '04-01'),
      log('b', 'self_action', ['changed'], '05-01'),
    ];
    const result = analyzeLocally({
      logId: 'c',
      logType: 'self_action',
      momentTags: ['tried'],
      optionalAnswer: '結論から説明した',
      occurredAt: '2026-06-01T09:00:00Z',
      history,
    });
    // This path matched tags; it did not read anything.
    expect(result.progressions[0]?.summary).toBe('');
    expect(result.analysis.confidence).toBeLessThanOrEqual(0.3);
  });

  it('makes nothing of records that show no pattern', () => {
    const history = [log('a', 'thought', ['enjoyed'], '04-01')];
    const result = analyzeLocally({
      logId: 'b',
      logType: 'thought',
      momentTags: ['enjoyed'],
      optionalAnswer: '楽しかった',
      occurredAt: '2026-05-01T09:00:00Z',
      history,
    });
    // Two enjoyments in a row are not one of the ten shapes.
    expect(result.progressions).toEqual([]);
  });

  it('asserts only the fields the tags themselves carry (§16)', () => {
    const result = analyzeLocally({
      logId: 'x',
      logType: 'thought',
      momentTags: ['discovered'],
      optionalAnswer: '説明力の問題かもしれない',
      occurredAt: '2026-04-01T09:00:00Z',
      history: [],
    });
    expect(result.analysis.discovery).toContain('説明力');
    // Nothing was tagged as friction, so nothing is claimed about friction.
    expect(result.analysis.friction).toBeUndefined();
    expect(result.analysis.choice).toBeUndefined();
  });

  it('records nothing extra when there is no free text', () => {
    const result = analyzeLocally({
      logId: 'x',
      logType: 'self_action',
      momentTags: ['tried'],
      occurredAt: '2026-04-01T09:00:00Z',
      history: [],
    });
    expect(result.analysis.eventSummary).toBe('');
    expect(result.analysis.themes).toEqual([]);
  });
});
