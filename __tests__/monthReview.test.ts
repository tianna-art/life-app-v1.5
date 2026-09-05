import { buildLocalMonthReview } from '../src/ai/monthReview';
import type { MonthGain } from '../src/data/repository';
import type { EntryWithAnalysis, GainType, InputCategory } from '../src/types';

let counter = 0;
const entry = (inputCategory: InputCategory, day = 1): EntryWithAnalysis => {
  counter += 1;
  return {
    id: `l${counter}`,
    userId: 'u1',
    occurredAt: `2026-09-${String(day).padStart(2, '0')}T21:00:00.000Z`,
    occurredOn: `2026-09-${String(day).padStart(2, '0')}`,
    inputCategory,
    body: `記録 ${counter}`,
    createdAt: '2026-09-01T21:00:00.000Z',
  };
};

const monthGain = (id: string, type: GainType, label: string, evidence: number): MonthGain => ({
  gain: {
    id,
    userId: 'u1',
    type,
    label,
    maturity: 'emerging',
    confidence: 0.5,
    firstDetectedAt: '2026-09-02T00:00:00.000Z',
    lastDetectedAt: '2026-09-20T00:00:00.000Z',
  },
  evidenceLogIds: Array.from({ length: evidence }, (_, i) => `e${i}`),
  isNew: true,
});

describe('the month-end reading', () => {
  it('reads nothing into an empty month', () => {
    expect(
      buildLocalMonthReview({
        periodKey: '2026-09',
        entries: [],
        previousEntries: [],
        monthGains: [],
      })
    ).toBeNull();
  });

  it('shows at most three gains, best-supported first', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('progress')],
      previousEntries: [],
      monthGains: [
        monthGain('a', 'evidence', 'イベントを開催した', 1),
        monthGain('b', 'strategy', '先に人に見せる', 5),
        monthGain('c', 'insight', '短く伝える', 3),
        monthGain('d', 'direction', '小さなチーム', 2),
      ],
    });
    expect(review?.gains).toEqual(['先に人に見せる', '短く伝える', '小さなチーム']);
  });

  it('says nothing about change when there is nothing to compare against', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('progress'), entry('progress'), entry('moved')],
      previousEntries: [entry('friction')],
      monthGains: [],
    });
    expect(review?.oneChange).toBe('');
  });

  it('compares two months as counts, without judging either', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('progress'), entry('progress'), entry('progress'), entry('moved')],
      previousEntries: [entry('friction'), entry('friction'), entry('friction'), entry('moved')],
      monthGains: [],
    });
    expect(review?.oneChange).toContain('進んだ');
    for (const banned of ['成長', '素晴らしい', 'あなたは', '達成']) {
      expect(review?.oneChange).not.toContain(banned);
    }
  });

  it('titles the month after what the records were, not how it went', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('progress')],
      previousEntries: [],
      monthGains: [monthGain('a', 'evidence', 'ポートフォリオを公開した', 2)],
    });
    expect(review?.title).toBe('OUT INTO THE WORLD');
    expect(review?.subtitle).not.toContain('成功');
  });
});
