import {
  CONSOLIDATION_THRESHOLD,
  clampMaturity,
  clampStatus,
  labelSimilarity,
  maturityCeiling,
  nominateConsolidations,
  normalizeLabel,
  parseLogAnalysis,
  type EvidenceSummary,
} from '../src/ai/gainRules';

const summary = (over: Partial<EvidenceSummary> = {}): EvidenceSummary => ({
  distinctLogCount: 1,
  spanDays: 0,
  hasContrast: false,
  roles: [],
  ...over,
});

describe('a gain never outruns its evidence', () => {
  it('calls one quiet record a signal', () => {
    expect(maturityCeiling(summary())).toBe('signal');
  });

  it('calls one record of something actually tried an attempt', () => {
    expect(maturityCeiling(summary({ roles: ['attempt'] }))).toBe('attempt');
    expect(maturityCeiling(summary({ roles: ['setback'] }))).toBe('signal');
  });

  it('needs a second record before anything is emerging', () => {
    expect(maturityCeiling(summary({ distinctLogCount: 2, roles: ['attempt'] }))).toBe('emerging');
  });

  it('needs a difference from before, or a fourth record, to be evidenced', () => {
    expect(maturityCeiling(summary({ distinctLogCount: 3 }))).toBe('emerging');
    expect(maturityCeiling(summary({ distinctLogCount: 3, hasContrast: true }))).toBe('evidenced');
    expect(maturityCeiling(summary({ distinctLogCount: 4 }))).toBe('evidenced');
  });

  it('reserves established for something repeated over months', () => {
    expect(maturityCeiling(summary({ distinctLogCount: 6, spanDays: 40 }))).toBe('evidenced');
    expect(maturityCeiling(summary({ distinctLogCount: 6, spanDays: 120 }))).toBe('established');
  });

  it('refuses the model an established gain after one presentation', () => {
    expect(clampMaturity('established', summary({ roles: ['attempt'] }))).toBe('attempt');
  });

  it('leaves a modest proposal alone', () => {
    expect(clampMaturity('signal', summary({ distinctLogCount: 9, spanDays: 400 }))).toBe('signal');
  });

  it('will not let one record confirm anything', () => {
    expect(clampStatus('confirmed', 1)).toBe('possible');
    expect(clampStatus('confirmed', 2)).toBe('confirmed');
    expect(clampStatus('unresolved', 5)).toBe('unresolved');
  });
});

describe('labels', () => {
  it('folds away quoting and spacing but not wording', () => {
    expect(normalizeLabel(' 「早く人に見せる」。 ')).toBe('早く人に見せる');
    expect(normalizeLabel('小さな  チーム')).toBe('小さな チーム');
  });

  it('scores near-duplicates high enough to be asked about', () => {
    expect(labelSimilarity('人前で説明する', '人前で説明すること')).toBeGreaterThan(
      CONSOLIDATION_THRESHOLD
    );
  });

  it('does not nominate two unrelated gains', () => {
    expect(labelSimilarity('早く人に見せる', '小さなチーム')).toBeLessThan(
      CONSOLIDATION_THRESHOLD
    );
  });

  it('nominates only within one gain type, best-supported absorbing the other', () => {
    const pairs = nominateConsolidations([
      { id: 'a', type: 'capability', label: '人前で説明する', evidenceCount: 5 },
      { id: 'b', type: 'capability', label: '人前で説明すること', evidenceCount: 1 },
      { id: 'c', type: 'insight', label: '人前で説明する', evidenceCount: 9 },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ sourceId: 'b', targetId: 'a' });
  });
});

describe('the model output is never trusted as-is', () => {
  it('drops a link to a record the model was not shown', () => {
    const parsed = parseLogAnalysis(
      {
        event_summary: 'あ',
        journey_role: 'attempt',
        gain_status: 'possible',
        gains: [],
        semantic_tags: [],
        possible_links: [
          { previous_log_id: 'known', relation: 'progression', confidence: 0.8 },
          { previous_log_id: 'invented', relation: 'progression', confidence: 0.9 },
        ],
      },
      ['known']
    );
    expect(parsed.possibleLinks).toHaveLength(1);
    expect(parsed.possibleLinks[0]?.previousLogId).toBe('known');
  });

  it('degrades a nonsense response to "nothing could be read"', () => {
    const parsed = parseLogAnalysis('not json at all');
    expect(parsed.gainStatus).toBe('unresolved');
    expect(parsed.gains).toEqual([]);
    expect(parsed.journeyRole).toBe('neutral');
  });

  it('drops a gain with an unknown type and keeps the rest', () => {
    const parsed = parseLogAnalysis({
      gains: [
        { type: 'vibes', label: 'なにか', maturity: 'signal', confidence: 0.5 },
        { type: 'strategy', label: '  「先に見せる」 ', maturity: 'emerging', confidence: 2 },
      ],
    });
    expect(parsed.gains).toHaveLength(1);
    expect(parsed.gains[0]).toMatchObject({
      type: 'strategy',
      label: '先に見せる',
      confidence: 1,
    });
  });

  it('treats the same gain proposed twice as one gain', () => {
    const parsed = parseLogAnalysis({
      gains: [
        { type: 'insight', label: '短く話す', maturity: 'signal', confidence: 0.4 },
        { type: 'insight', label: '短く話す', maturity: 'evidenced', confidence: 0.9 },
      ],
    });
    expect(parsed.gains).toHaveLength(1);
  });

  it('ignores an existing gain id that was never offered', () => {
    const parsed = parseLogAnalysis(
      {
        gains: [
          {
            type: 'insight',
            label: '短く話す',
            maturity: 'signal',
            confidence: 0.4,
            existing_gain_id: 'made-up',
          },
        ],
      },
      [],
      ['real-gain']
    );
    expect(parsed.gains[0]?.existingGainId).toBeUndefined();
  });
});
