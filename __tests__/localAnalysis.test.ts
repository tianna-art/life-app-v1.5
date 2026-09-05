import { analyzeLocally, surfaceTerms } from '../src/ai/localAnalysis';
import type { EntryWithAnalysis } from '../src/types';

function entry(id: string, body: string, occurredAt: string): EntryWithAnalysis {
  return {
    id,
    userId: 'u',
    occurredAt,
    occurredOn: occurredAt.slice(0, 10),
    type: 'event',
    body,
    subjectiveSignal: 'mixed',
    createdAt: occurredAt,
  };
}

describe('the offline reading', () => {
  it('leaves the first record as a dot (§31)', () => {
    const result = analyzeLocally({
      logId: 'first',
      type: 'event',
      body: '初めて自分の企画を友達に見せた',
      subjectiveSignal: 'positive',
      occurredAt: '2026-05-01T09:00:00Z',
      history: [],
    });
    expect(result.progressions).toEqual([]);
    expect(result.analysis.eventSummary).toContain('企画');
  });

  it('connects a second record that overlaps the first', () => {
    const history = [entry('a', '自分の企画を友達に見せた', '2026-05-01T09:00:00Z')];
    const result = analyzeLocally({
      logId: 'b',
      type: 'event',
      body: '企画を初対面の人にも見せた',
      subjectiveSignal: 'positive',
      occurredAt: '2026-06-01T09:00:00Z',
      history,
    });
    expect(result.progressions).toHaveLength(1);
    expect(result.progressions[0]?.evidence.map((e) => e.logId)).toContain('a');
    expect(result.progressions[0]?.evidence.map((e) => e.logId)).toContain('b');
  });

  it('does not connect two unrelated records', () => {
    const history = [entry('a', '歯医者に行った', '2026-05-01T09:00:00Z')];
    const result = analyzeLocally({
      logId: 'b',
      type: 'event',
      body: '企画書を書いた',
      subjectiveSignal: 'mixed',
      occurredAt: '2026-06-01T09:00:00Z',
      history,
    });
    expect(result.progressions).toEqual([]);
  });

  it('never claims a direction it cannot see', () => {
    const history = [entry('a', '企画を見せた', '2026-05-01T09:00:00Z')];
    const result = analyzeLocally({
      logId: 'b',
      type: 'event',
      body: '企画をまた見せた',
      subjectiveSignal: 'positive',
      occurredAt: '2026-06-01T09:00:00Z',
      history,
    });
    // No from/to and no summary: this path matched strings, it did not read.
    expect(result.progressions[0]?.summary).toBe('');
    expect(result.progressions[0]?.fromState).toBeUndefined();
    expect(result.analysis.confidence).toBeLessThanOrEqual(0.3);
  });

  it('reads a thought as exploration rather than an attempt', () => {
    const result = analyzeLocally({
      logId: 'x',
      type: 'thought',
      body: '人に自分の企画を見せるのが怖い',
      subjectiveSignal: 'negative',
      occurredAt: '2026-04-01T09:00:00Z',
      history: [],
    });
    expect(result.analysis.journeyRole).toBe('setback');
  });
});

describe('surfaceTerms', () => {
  it('drops particles that would relate every record to every other', () => {
    const terms = surfaceTerms('これをしたことがある');
    expect(terms).not.toContain('した');
    expect(terms).not.toContain('こと');
  });
});
