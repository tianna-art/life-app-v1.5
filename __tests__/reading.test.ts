/**
 * What a reading is allowed to be.
 *
 * These are not tests of the model. They are tests of the gate the model's
 * answer has to pass through, which is the only part of this that can be
 * relied on: a prompt is a request, and the interesting cases here are all
 * ones where a model has ignored it.
 */
import {
  CARDS_FOR_HYPOTHESIS,
  EVIDENCE_FOR_PATTERN,
  MAX_CARDS,
  acceptInsights,
  checkSummary,
  checkTitles,
  hypothesisIsHedged,
  mayOfferHypothesis,
  type ProposedInsight,
} from '@/ai/reading';
import type { AntennaId } from '@/types';

const LOGS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
const MONTH: AntennaId[] = ['progress', 'values'];

function card(over: Partial<ProposedInsight> = {}): ProposedInsight {
  return {
    antennaId: 'progress',
    label: '積み上がったこと',
    text: '会社でも試せる選択肢が増えた',
    evidenceLogIds: ['l1', 'l2'],
    ...over,
  };
}

describe('a card has to stand on records that exist', () => {
  it('drops one with no evidence at all', () => {
    const { accepted, rejected } = acceptInsights([card({ evidenceLogIds: [] })], LOGS, MONTH);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toMatch(/no evidence/);
  });

  it('drops one whose records were invented', () => {
    const { accepted } = acceptInsights(
      [card({ evidenceLogIds: ['made-up', 'also-made-up'] })],
      LOGS,
      MONTH
    );
    expect(accepted).toHaveLength(0);
  });

  it('keeps only the ids that are real, and counts those', () => {
    const { accepted } = acceptInsights(
      [card({ evidenceLogIds: ['l1', 'ghost', 'l2'] })],
      LOGS,
      MONTH
    );
    expect(accepted[0]?.evidenceLogIds).toEqual(['l1', 'l2']);
  });

  it('does not count the same record twice to clear the bar', () => {
    const { accepted } = acceptInsights([card({ evidenceLogIds: ['l1', 'l1'] })], LOGS, MONTH);
    expect(accepted[0]?.evidenceLogIds).toEqual(['l1']);
    expect(accepted[0]?.label).toBe('手がかり');
  });
});

describe('one record is not a pattern', () => {
  it('demotes a single-record card to 手がかり, whatever it was called', () => {
    const { accepted } = acceptInsights(
      [card({ label: '大切にしたいもの', evidenceLogIds: ['l1'] })],
      LOGS,
      MONTH
    );
    expect(accepted[0]?.label).toBe('手がかり');
  });

  it('keeps it rather than throwing it away — noticing once is worth having', () => {
    const { accepted } = acceptInsights([card({ evidenceLogIds: ['l1'] })], LOGS, MONTH);
    expect(accepted).toHaveLength(1);
  });

  it('lets a card with two records keep its label', () => {
    const { accepted } = acceptInsights(
      [card({ label: '大切にしたいもの', evidenceLogIds: ['l1', 'l2'] })],
      LOGS,
      MONTH
    );
    expect(accepted[0]?.label).toBe('大切にしたいもの');
    expect(EVIDENCE_FOR_PATTERN).toBe(2);
  });
});

describe('a card answers to what the month was watching', () => {
  it('drops one about an アンテナ nobody chose', () => {
    const { accepted, rejected } = acceptInsights([card({ antennaId: 'spark' })], LOGS, MONTH);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toMatch(/アンテナ/);
  });

  it('accepts anything when the month set no direction', () => {
    const { accepted } = acceptInsights([card({ antennaId: 'spark' })], LOGS, []);
    expect(accepted).toHaveLength(1);
  });

  it('replaces a label it does not recognise rather than showing it', () => {
    const { accepted } = acceptInsights([card({ label: 'すごいところ' })], LOGS, MONTH);
    expect(accepted[0]?.label).toBe('手がかり');
  });
});

describe('how many cards survive', () => {
  it('keeps four at most, strongest first', () => {
    const many = [
      card({ evidenceLogIds: ['l1'] }),
      card({ evidenceLogIds: ['l1', 'l2', 'l3'] }),
      card({ evidenceLogIds: ['l1', 'l2'] }),
      card({ evidenceLogIds: ['l4'] }),
      card({ evidenceLogIds: ['l5'] }),
      card({ evidenceLogIds: ['l6'] }),
    ];
    const { accepted } = acceptInsights(many, LOGS, MONTH);
    expect(accepted).toHaveLength(MAX_CARDS);
    expect(accepted[0]?.evidenceLogIds).toHaveLength(3);
  });

  it('leaves a month with nothing behind it empty', () => {
    const { accepted } = acceptInsights([], LOGS, MONTH);
    expect(accepted).toEqual([]);
  });
});

describe('今の仮説', () => {
  const strong = (n: number) =>
    Array.from({ length: n }, () => card({ evidenceLogIds: ['l1', 'l2'] }));

  it('is withheld until two cards each stand on two records', () => {
    const { accepted } = acceptInsights(strong(1), LOGS, MONTH);
    expect(mayOfferHypothesis(accepted)).toBe(false);
    expect(CARDS_FOR_HYPOTHESIS).toBe(2);
  });

  it('is allowed once two such cards exist', () => {
    const { accepted } = acceptInsights(
      [card({ evidenceLogIds: ['l1', 'l2'] }), card({ evidenceLogIds: ['l3', 'l4'] })],
      LOGS,
      MONTH
    );
    expect(mayOfferHypothesis(accepted)).toBe(true);
  });

  it('is not allowed on two 手がかり', () => {
    const { accepted } = acceptInsights(
      [card({ evidenceLogIds: ['l1'] }), card({ evidenceLogIds: ['l2'] })],
      LOGS,
      MONTH
    );
    expect(mayOfferHypothesis(accepted)).toBe(false);
  });

  it('has to suggest, not state', () => {
    expect(hypothesisIsHedged('気持ちが動いているのかもしれません')).toBe(true);
    expect(hypothesisIsHedged('気持ちが動いている')).toBe(false);
    expect(hypothesisIsHedged('間違いなくそうですと言えるかもしれません')).toBe(false);
  });
});

describe('月次サマリー', () => {
  // 100–150 characters, two sentences, ending 「〜月。」 — the shape the rule
  // asks for, written out so the test reads as an example of a good one.
  const body =
    'ひとりで動く時間が増えて、決める前に一度書き出してから進めるやり方が、少しずつ自分の手に馴染んできたのが分かる。' +
    '会社の中で試せる範囲を探りながら、外での活動も細い頻度のまま、途切れさせずに続けていた月。';

  it('accepts three words and two sentences ending 「〜月。」', () => {
    expect(checkSummary(['整理', '裁量', '継続'], body)).toEqual({ ok: true, problems: [] });
  });

  it('refuses a fourth word, or a repeated one', () => {
    expect(checkSummary(['a', 'b', 'c', 'd'], body).ok).toBe(false);
    expect(checkSummary(['a', 'a', 'b'], body).problems).toContain('keywords: repeated');
  });

  it('refuses a body that runs long — a retelling is where rewriting creeps in', () => {
    const long = `${body}${'あ'.repeat(80)}月。`;
    expect(checkSummary(['a', 'b', 'c'], long).ok).toBe(false);
  });

  it('refuses one that does not end 「〜月。」', () => {
    const wrong = body.replace(/月。$/, 'こと。');
    expect(checkSummary(['a', 'b', 'c'], wrong).problems).toContain('body: does not end 「〜月。」');
  });

  it('refuses one that turns the month into a lesson', () => {
    const rescued =
      'うまくいかないことが続いたけれど、そこから成長できたと言える出来事のほうが多く重なっていたのが分かる。' +
      '振り返ってみれば、前に進むために必要だった時間だったと納得できる月。';
    expect(checkSummary(['a', 'b', 'c'], rescued).ok).toBe(false);
  });
});

describe('足跡タイトル candidates', () => {
  it('wants three different ones', () => {
    expect(checkTitles(['問いが変わった月', '速さを落とした月', '手元に残った月']).ok).toBe(true);
    expect(checkTitles(['同じ', '同じ', '別']).problems).toContain('titles: repeated');
    expect(checkTitles(['ひとつ']).ok).toBe(false);
  });

  it('refuses a name that grades the month', () => {
    const verdict = checkTitles(['目標を達成した月', '速さを落とした月', '手元に残った月']);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join()).toMatch(/judges/);
  });
});
