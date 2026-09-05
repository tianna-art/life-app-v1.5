import { analyzeLocally, localEventSummary, localJourneyRole } from '../src/ai/localAnalysis';
import type { EntryWithAnalysis } from '../src/types';

const entry = (id: string, body: string): EntryWithAnalysis => ({
  id,
  userId: 'u1',
  occurredAt: '2026-09-01T21:00:00.000Z',
  occurredOn: '2026-09-01',
  inputCategory: 'moved',
  body,
  createdAt: '2026-09-01T21:00:00.000Z',
});

describe('the reading with no model attached', () => {
  it('leaves a setback as a setback', () => {
    expect(localJourneyRole('friction', '共有した企画に、ほとんど反応がなかった。')).toBe('setback');
  });

  it('quotes the record instead of summarising it', () => {
    expect(localEventSummary('骨組みを書き出した。そのあと少し直した。')).toBe('骨組みを書き出した');
  });

  it('reads nothing into a single ordinary record', () => {
    const result = analyzeLocally({
      logId: 'l1',
      inputCategory: 'moved',
      body: '常設展を見に行った。',
      occurredAt: '2026-09-05T21:00:00.000Z',
      history: [],
    });
    expect(result.gains).toEqual([]);
    expect(result.analysis.gainStatus).toBe('unresolved');
  });

  it('will not turn a first failure into a lesson', () => {
    const result = analyzeLocally({
      logId: 'l1',
      inputCategory: 'friction',
      body: '説明が長くなってしまった。',
      occurredAt: '2026-09-05T21:00:00.000Z',
      history: [],
    });
    expect(result.gains).toEqual([]);
    expect(result.analysis.journeyRole).toBe('neutral');
  });

  it('names a repeated word as a direction, never as a preference about the person', () => {
    const result = analyzeLocally({
      logId: 'l3',
      inputCategory: 'moved',
      body: '小さなチームで作る時間が続いた。',
      occurredAt: '2026-09-05T21:00:00.000Z',
      history: [entry('l1', '小さなチームの打ち合わせ。'), entry('l2', '小さなチームで試作した。')],
    });
    const direction = result.gains.find((g) => g.type === 'direction');
    expect(direction).toBeTruthy();
    expect(direction?.maturity).toBe('emerging');
    expect(direction?.label).not.toContain('好き');
  });

  it('records something that was done as evidence, not as a skill', () => {
    const result = analyzeLocally({
      logId: 'l1',
      inputCategory: 'progress',
      body: 'はじめてイベントを開催した。',
      occurredAt: '2026-09-05T21:00:00.000Z',
      history: [],
    });
    const evidence = result.gains.find((g) => g.type === 'evidence');
    expect(evidence).toBeTruthy();
    expect(evidence?.maturity).toBe('attempt');
    expect(result.gains.some((g) => g.type === 'capability')).toBe(false);
  });
});
