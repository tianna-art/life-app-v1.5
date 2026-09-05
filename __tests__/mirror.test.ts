import { buildMirror } from '../src/ai/mirror';
import type { LogAnalysis, MomentTag, Progression } from '../src/types';

function analysis(over: Partial<LogAnalysis> = {}): LogAnalysis {
  return { logId: 'log-1', eventSummary: '', themes: [], people: [], confidence: 0.5, ...over };
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
    goalExternal: false,
    firstDetectedAt: '2026-05-01T00:00:00Z',
    lastUpdatedAt: '2026-05-01T00:00:00Z',
    userEdited: false,
    evidenceCount: 2,
  };
}

const BANNED = ['あなたは', '成長', '素晴らしい', '次は', 'しましょう', '学び', '意味'];

describe('the line after a save (§31)', () => {
  it('works with no free text at all — the common case in v4', () => {
    const mirror = buildMirror({ logId: 'l', momentTags: ['friction'], joined: [] });
    expect(mirror.line).toBe('「モヤモヤ」がひとつ残りました。');
  });

  it('names several tags in the order they were tapped', () => {
    const tags: MomentTag[] = ['first_time', 'enjoyed'];
    const mirror = buildMirror({ logId: 'l', momentTags: tags, joined: [] });
    expect(mirror.line).toContain('初めて');
  });

  it('quotes the person when they wrote something', () => {
    const mirror = buildMirror({
      logId: 'l',
      momentTags: ['discovered'],
      analysis: analysis({ discovery: '結論から話した方が伝わる' }),
      joined: [],
    });
    expect(mirror.line).toContain('結論から話した方が伝わる');
  });

  it('leaves friction as friction (§10, §30)', () => {
    const mirror = buildMirror({
      logId: 'l',
      momentTags: ['friction'],
      analysis: analysis({ eventSummary: '伝わらなかった' }),
      joined: [],
    });
    expect(mirror.line).toContain('伝わらなかった');
    expect(mirror.line).not.toContain('学び');
    expect(mirror.line).not.toContain('成長');
  });

  it('never advises, praises or draws a lesson', () => {
    const lines = [
      buildMirror({ logId: 'l', momentTags: ['friction'], joined: [] }).line,
      buildMirror({ logId: 'l', momentTags: ['enjoyed', 'tried'], joined: [] }).line,
      buildMirror({
        logId: 'l',
        momentTags: ['first_time'],
        analysis: analysis({ eventSummary: '初対面の人に説明した' }),
        joined: [],
      }).line,
      buildMirror({ logId: 'l', momentTags: ['changed'], joined: [progression('人に伝える')] })
        .line,
    ];
    for (const line of lines) {
      for (const banned of BANNED) expect(line).not.toContain(banned);
    }
  });

  it('names the trail when the record joined one, and makes it followable', () => {
    const mirror = buildMirror({
      logId: 'l',
      momentTags: ['tried'],
      joined: [progression('人に伝える')],
    });
    expect(mirror.line).toContain('人に伝える');
    expect(mirror.joinedProgression).toEqual({ id: 'p1', title: '人に伝える' });
  });

  it('announces emergence over joining, quietly (§32)', () => {
    const mirror = buildMirror({
      logId: 'l',
      momentTags: ['tried'],
      joined: [progression('人に伝える')],
      emerged: { progression: progression('人に伝える'), count: 3 },
    });
    expect(mirror.line).toBe('3つの記録が、ひとつの変化としてつながりました。');
    expect(mirror.emergedProgression?.count).toBe(3);
    // No exclamation, no celebration wording (§32).
    expect(mirror.line).not.toContain('！');
    expect(mirror.line).not.toContain('おめでとう');
  });
});
