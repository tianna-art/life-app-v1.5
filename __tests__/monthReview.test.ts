import { UNDECIDED_MONTH, buildLocalMonthReview, progressionLine } from '../src/ai/monthReview';
import type { LogWithAnalysis, MonthProgression, Progression } from '../src/types';

function log(id: string): LogWithAnalysis {
  return {
    id,
    userId: 'u',
    occurredAt: '2026-09-03T09:00:00Z',
    occurredOn: '2026-09-03',
    logType: 'self_action',
    momentTags: ['tried'],
    createdAt: '2026-09-03T09:00:00Z',
  };
}

function item(over: Partial<Progression> = {}, month: Partial<MonthProgression> = {}): MonthProgression {
  return {
    progression: {
      id: 'p',
      userId: 'u',
      type: 'relationship',
      pattern: 'expose',
      title: '人に伝える',
      summary: '',
      maturity: 'evidenced',
      confidence: 0.6,
      goalExternal: false,
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

describe('the month-end reading (§25)', () => {
  it('does not summarise a month with nothing in it', () => {
    expect(
      buildLocalMonthReview({ periodKey: '2026-09', logs: [], progressions: [], gains: [] })
    ).toBeNull();
  });

  it('says two when there were two, rather than padding to three', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      logs: [log('a')],
      progressions: [
        item({ id: 'p1', title: '人に伝える', fromState: '怖い', currentState: '説明できる' }),
        item({ id: 'p2', title: 'つくる', fromState: '完成後に見せる', currentState: '途中で見せる' }),
      ],
      gains: [],
    });
    expect(review?.changed).toHaveLength(2);
  });

  it('states a movement only when both ends are known', () => {
    expect(
      progressionLine({
        ...item().progression,
        fromState: '自分の中だけで考える',
        currentState: '人に見せながら考える',
      })
    ).toBe('「自分の中だけで考える」から「人に見せながら考える」へ。');
    expect(progressionLine({ ...item().progression, fromState: '怖い' })).toBe('');
  });

  it('lets a month stay undecided rather than consoling (§7)', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      logs: [log('a')],
      progressions: [],
      gains: [],
      initialTheme: '外に出してみる',
    });
    expect(review?.whatActuallyHappened).toBe(UNDECIDED_MONTH);
    expect(review?.changed).toEqual([]);
    // §7's forbidden sentence, in every form it could take.
    expect(review?.whatActuallyHappened).not.toContain('意味がありました');
    expect(review?.whatActuallyHappened).not.toContain('予定通り');
  });

  it('keeps what the month set out with, alongside what happened', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      logs: [log('a')],
      progressions: [item({ fromState: 'A', currentState: 'B' })],
      gains: [],
      initialTheme: '外に出してみる',
    });
    expect(review?.initialTheme).toBe('外に出してみる');
  });

  it('only reports gains attached to progressions that moved', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      logs: [log('a')],
      progressions: [item({ id: 'moved', fromState: 'A', currentState: 'B' })],
      gains: [
        { category: 'method', label: '結論から伝える', progressionId: 'moved' },
        { category: 'clarity', label: '別の何か', progressionId: 'elsewhere' },
      ],
    });
    expect(review?.gained).toEqual([{ category: 'method', label: '結論から伝える' }]);
  });

  it('never titles a month with praise', () => {
    const review = buildLocalMonthReview({
      periodKey: '2026-09',
      logs: [log('a')],
      progressions: [item({ fromState: 'A', currentState: 'B' })],
      gains: [],
    });
    for (const banned of ['GREAT', 'SUCCESS', 'GREW', 'WIN']) {
      expect(review?.title).not.toContain(banned);
    }
  });
});
