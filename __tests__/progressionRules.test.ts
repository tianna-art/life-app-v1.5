import {
  CONSOLIDATION_THRESHOLD,
  clampMaturity,
  maturityCeiling,
  nominateConsolidations,
  normalizeTitle,
  parseCrossTimeReading,
  parseEntryAnalysis,
  phraseForMaturity,
  qualifiesAsProgression,
  summariseEvidencePath,
  titleSimilarity,
} from '../src/ai/progressionRules';
import type { ProgressionEvidenceRole } from '../src/types';

function path(
  entries: [role: ProgressionEvidenceRole, occurredAt: string][]
): { logId: string; role: ProgressionEvidenceRole; occurredAt: string }[] {
  return entries.map(([role, occurredAt], i) => ({ logId: `log-${i}`, role, occurredAt }));
}

describe('the two-record floor (§9, §31)', () => {
  it('does not let one record be a progression', () => {
    const summary = summariseEvidencePath(path([['current', '2026-04-01T00:00:00Z']]));
    expect(qualifiesAsProgression(summary)).toBe(false);
    expect(maturityCeiling(summary)).toBe('signal');
  });

  it('lets two records be a signal and no more', () => {
    const summary = summariseEvidencePath(
      path([
        ['origin', '2026-04-01T00:00:00Z'],
        ['current', '2026-04-08T00:00:00Z'],
      ])
    );
    expect(qualifiesAsProgression(summary)).toBe(true);
    expect(maturityCeiling(summary)).toBe('signal');
  });
});

describe('the maturity ceiling (§12)', () => {
  it('needs a before and an after to reach evidenced', () => {
    // Three records that all say the same thing: a theme, not a movement.
    const flat = summariseEvidencePath(
      path([
        ['evidence', '2026-04-01T00:00:00Z'],
        ['evidence', '2026-04-10T00:00:00Z'],
        ['evidence', '2026-04-20T00:00:00Z'],
      ])
    );
    expect(maturityCeiling(flat)).toBe('emerging');

    const changed = summariseEvidencePath(
      path([
        ['setback', '2026-04-01T00:00:00Z'],
        ['attempt', '2026-04-10T00:00:00Z'],
        ['adaptation', '2026-04-20T00:00:00Z'],
      ])
    );
    expect(maturityCeiling(changed)).toBe('evidenced');
  });

  it('needs time and repetition to reach established', () => {
    const short = summariseEvidencePath(
      path([
        ['origin', '2026-04-01T00:00:00Z'],
        ['setback', '2026-04-05T00:00:00Z'],
        ['adaptation', '2026-04-10T00:00:00Z'],
        ['current', '2026-04-15T00:00:00Z'],
      ])
    );
    expect(maturityCeiling(short)).toBe('evidenced');

    const long = summariseEvidencePath(
      path([
        ['origin', '2026-04-01T00:00:00Z'],
        ['setback', '2026-05-05T00:00:00Z'],
        ['adaptation', '2026-06-10T00:00:00Z'],
        ['current', '2026-07-15T00:00:00Z'],
      ])
    );
    expect(maturityCeiling(long)).toBe('established');
  });

  it('overrules the model rather than trusting it', () => {
    const summary = summariseEvidencePath(
      path([
        ['origin', '2026-04-01T00:00:00Z'],
        ['current', '2026-04-02T00:00:00Z'],
      ])
    );
    expect(clampMaturity('established', summary)).toBe('signal');
  });
});

describe('wording is bound to the rung (§12)', () => {
  it('speaks tentatively at signal and only repeats itself at established', () => {
    expect(phraseForMaturity('signal', '人に伝える')).toContain('兆し');
    expect(phraseForMaturity('emerging', '人に伝える')).toContain('増えています');
    expect(phraseForMaturity('evidenced', '人に伝える')).toContain('以前');
    expect(phraseForMaturity('established', '人に伝える')).toContain('繰り返し');
  });

  it('never claims the person changed (§13)', () => {
    for (const maturity of ['signal', 'emerging', 'evidenced', 'established'] as const) {
      const line = phraseForMaturity(maturity, 'つくる');
      expect(line).not.toContain('あなたは');
      expect(line).not.toContain('成長');
    }
  });
});

describe('STAGE 1 parsing (§6)', () => {
  it('drops a role the model was not confident about (§7)', () => {
    const parsed = parseEntryAnalysis(
      { event_summary: '展示会に行った', journey_role: 'turning_point', confidence: 0.1 },
      '展示会に行った'
    );
    expect(parsed.journeyRole).toBe('neutral');
  });

  it('keeps a role the model was confident about', () => {
    const parsed = parseEntryAnalysis(
      { event_summary: '初めて友達に見せた', journey_role: 'attempt', confidence: 0.8 },
      '初めて友達に見せた'
    );
    expect(parsed.journeyRole).toBe('attempt');
  });

  it('survives a completely malformed answer', () => {
    const parsed = parseEntryAnalysis(null, '本文がここにある');
    expect(parsed.eventSummary).toBe('本文がここにある');
    expect(parsed.journeyRole).toBe('neutral');
    expect(parsed.topics).toEqual([]);
    expect(parsed.signals.capability).toEqual([]);
  });
});

describe('STAGE 2 parsing (§8)', () => {
  const allowed = ['log-a', 'log-b'];

  it('refuses evidence the model was never shown', () => {
    const reading = parseCrossTimeReading(
      {
        progressions: [
          {
            action: 'create',
            type: 'capability',
            title: '人に伝える',
            maturity: 'signal',
            confidence: 0.5,
            evidence: [
              { log_id: 'log-a', role: 'origin' },
              { log_id: 'invented', role: 'current' },
            ],
          },
        ],
      },
      allowed,
      []
    );
    expect(reading.proposals[0]?.evidence.map((e) => e.logId)).toEqual(['log-a']);
  });

  it('turns an update naming an unknown progression into a create', () => {
    const reading = parseCrossTimeReading(
      {
        progressions: [
          {
            action: 'update',
            progression_id: 'not-ours',
            type: 'strategy',
            title: 'やり方',
            maturity: 'signal',
            confidence: 0.4,
            evidence: [{ log_id: 'log-a', role: 'origin' }],
          },
        ],
      },
      allowed,
      ['known-id']
    );
    expect(reading.proposals[0]?.action).toBe('create');
  });

  it('drops a clarification with nothing to choose between (§14)', () => {
    const reading = parseCrossTimeReading(
      { progressions: [], clarification: { question: 'どちらが近い？', options: ['ひとつだけ'] } },
      allowed,
      []
    );
    expect(reading.clarification).toBeUndefined();
  });

  it('keeps a clarification with real options', () => {
    const reading = parseCrossTimeReading(
      {
        progressions: [],
        clarification: {
          question: 'どちらが近い？',
          options: ['仕事内容そのもの', '評価されたこと'],
        },
      },
      allowed,
      []
    );
    expect(reading.clarification?.options).toHaveLength(2);
  });
});

describe('consolidation (§30)', () => {
  it('nominates only same-type near-duplicates', () => {
    const candidates = nominateConsolidations([
      { id: 'a', type: 'capability', title: '人に伝える', evidenceCount: 4 },
      { id: 'b', type: 'capability', title: '人に伝える）', evidenceCount: 1 },
      { id: 'c', type: 'direction', title: '人に伝える', evidenceCount: 9 },
    ]);
    expect(candidates).toHaveLength(1);
    // The better-supported one keeps its identity.
    expect(candidates[0]).toMatchObject({ sourceId: 'b', targetId: 'a' });
  });

  it('leaves a progression the person rewrote alone', () => {
    const candidates = nominateConsolidations([
      { id: 'a', type: 'capability', title: '人に伝える', evidenceCount: 4, userEdited: true },
      { id: 'b', type: 'capability', title: '人に伝える', evidenceCount: 1 },
    ]);
    expect(candidates).toEqual([]);
  });

  it('does not nominate two genuinely different movements', () => {
    expect(titleSimilarity('人に伝える', '働き方')).toBeLessThan(CONSOLIDATION_THRESHOLD);
  });
});

describe('title normalising', () => {
  it('folds width and trailing punctuation only', () => {
    expect(normalizeTitle('  人に伝える。 ')).toBe('人に伝える');
    expect(normalizeTitle('ＭＡＫＩＮＧ')).toBe('MAKING');
  });
});
