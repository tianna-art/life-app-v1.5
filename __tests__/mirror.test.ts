import { buildMirror } from '../src/ai/mirror';
import { UNRESOLVED_LINE } from '../src/constants/copy';
import { emptySignals } from '../src/ai/progressionRules';
import type { EntryAnalysis, Progression } from '../src/types';

function analysis(over: Partial<EntryAnalysis> = {}): EntryAnalysis {
  return {
    logId: 'log-1',
    eventSummary: '企画を見せた',
    topics: [],
    actors: [],
    environment: [],
    journeyRole: 'neutral',
    signals: emptySignals(),
    confidence: 0.6,
    ...over,
  };
}

function progression(title: string): Progression {
  return {
    id: 'p1',
    userId: 'u',
    type: 'capability',
    title,
    summary: '',
    maturity: 'signal',
    confidence: 0.4,
    firstDetectedAt: '2026-05-01T00:00:00Z',
    lastUpdatedAt: '2026-05-01T00:00:00Z',
    userEdited: false,
    evidenceCount: 2,
  };
}

describe('the line after a save (§15)', () => {
  it('quotes a hypothesis the person actually wrote', () => {
    const mirror = buildMirror({
      logId: 'log-1',
      analysis: analysis({ hypothesis: 'もっとシンプルにする' }),
      joined: [],
    });
    expect(mirror.line).toContain('もっとシンプルにする');
    expect(mirror.line).toContain('仮説');
  });

  it('says nothing rather than inventing something', () => {
    const mirror = buildMirror({ logId: 'log-1', analysis: analysis(), joined: [] });
    expect(mirror.line).toBe(UNRESOLVED_LINE);
  });

  it('never gives advice, praise or a lesson', () => {
    const lines = [
      buildMirror({ logId: 'l', analysis: analysis(), joined: [] }).line,
      buildMirror({
        logId: 'l',
        analysis: analysis({ hypothesis: '結論から話す' }),
        joined: [],
      }).line,
      buildMirror({
        logId: 'l',
        analysis: analysis({ journeyRole: 'setback', outcome: '伝わらなかった' }),
        joined: [],
      }).line,
    ];
    for (const line of lines) {
      for (const banned of ['あなたは', '成長', '素晴らしい', '次は', 'しましょう', '学び']) {
        expect(line).not.toContain(banned);
      }
    }
  });

  it('leaves a setback as a setback', () => {
    const mirror = buildMirror({
      logId: 'log-1',
      analysis: analysis({ journeyRole: 'setback', outcome: '伝わらなかった' }),
      joined: [],
    });
    expect(mirror.line).toContain('伝わらなかった');
    expect(mirror.line).not.toContain('学び');
  });

  it('names the trail when the entry joined one, and makes it followable', () => {
    const mirror = buildMirror({
      logId: 'log-1',
      analysis: analysis({ hypothesis: '結論から話す' }),
      joined: [progression('人に伝える')],
    });
    expect(mirror.line).toContain('人に伝える');
    expect(mirror.joinedProgression).toEqual({ id: 'p1', title: '人に伝える' });
  });
});
