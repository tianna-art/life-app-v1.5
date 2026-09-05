import { buildLocalMonthReview, progressionLine } from '../src/ai/monthReview';
import type { EntryWithAnalysis, MonthProgression, Progression } from '../src/types';

function entry(id: string): EntryWithAnalysis {
  return {
    id,
    userId: 'u',
    occurredAt: '2026-09-03T09:00:00Z',
    occurredOn: '2026-09-03',
    type: 'event',
    body: '企画を見せた',
    subjectiveSignal: 'positive',
    createdAt: '2026-09-03T09:00:00Z',
  };
}

function item(over: Partial<Progression>, month: Partial<MonthProgression> = {}): MonthProgression {
  return {
    progression: {
      id: 'p',
      userId: 'u',
      type: 'relationship',
      title: '人に伝える',
      summary: '',
      maturity: 'evidenced',
      confidence: 0.6,
      firstDetectedAt: '2026-04-01T00:00:00Z',
      lastUpdatedAt: '2026-09-01T00:00:00Z',
      userEdited: false,
      evidenceCount: 4,
      ...over,
    },
    evidenceLogIds: ['a', 'b'],
    isNew: false,
    maturityThen: 'evidenced',
    ...month,
  };
}

describe('the month-end reading (§23)', () => {
  it('does not summarise a month with nothing in it', () => {
    expect(
      buildLocalMonthReview({ periodKey: '2026-09', entries: [], progressions: [] })
    ).toBeNull();
  });

  it('says two when there were two, rather than padding to three', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('a')],
      progressions: [
        item({ id: 'p1', title: '人に伝える', fromState: '怖い', currentState: '説明できる' }),
        item({ id: 'p2', title: 'つくる', fromState: '完成させてから', currentState: '途中で見せる' }),
      ],
    });
    expect(review?.progressions).toHaveLength(2);
  });

  it('states a movement only when both ends are known', () => {
    expect(
      progressionLine({
        ...item({}).progression,
        fromState: '自分の中だけで考える',
        currentState: '人に見せながら考える',
      })
    ).toBe('「自分の中だけで考える」から「人に見せながら考える」へ。');

    // Half a movement is not stated as one.
    expect(progressionLine({ ...item({}).progression, fromState: '怖い' })).toBe('');
  });

  it('leaves the carrying-forward line empty rather than inventing it', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('a')],
      progressions: [item({ fromState: 'A', currentState: 'B' })],
    });
    expect(review?.carryingForward).toBe('');
  });

  it('never titles a month with praise', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('a')],
      progressions: [item({ fromState: 'A', currentState: 'B' })],
    });
    for (const banned of ['GREAT', 'SUCCESS', 'GREW', 'WIN']) {
      expect(review?.title).not.toContain(banned);
    }
  });

  it('gives a month with records but no movement a quiet title, not a blank one', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      entries: [entry('a')],
      progressions: [],
    });
    expect(review?.title).toBe('KEPT');
    expect(review?.progressions).toEqual([]);
  });
});
