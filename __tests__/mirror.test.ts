import { buildMirror } from '../src/ai/mirror';
import type { LogAnalysis, Progression } from '../src/types';

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
  it('works with no free text at all — the common case', () => {
    // The category is the person's own word for the day. Saying it back is
    // not a reading of anything: it is what they just tapped.
    const mirror = buildMirror({ logId: 'l', categoryId: 'self_hard', joined: [] });
    expect(mirror.line).toBe('「しんどかった」がひとつ残りました。');
  });

  it('says something plain when nothing has filed the record yet', () => {
    // A free-text entry has no category until a reading gives it one, and
    // naming one here would be the app filing it on the person's behalf.
    const mirror = buildMirror({ logId: 'l', joined: [] });
    expect(mirror.line).toBe('記録がひとつ残りました。');
  });

  it('quotes the person when they wrote something', () => {
    const mirror = buildMirror({
      logId: 'l',
      categoryId: 'self_hard',
      analysis: analysis({ discovery: '結論から話した方が伝わる' }),
      joined: [],
    });
    expect(mirror.line).toContain('結論から話した方が伝わる');
  });

  it('leaves friction as friction (§10, §30)', () => {
    const mirror = buildMirror({
      logId: 'l',
      categoryId: 'self_hard',
      analysis: analysis({ eventSummary: '伝わらなかった' }),
      joined: [],
    });
    expect(mirror.line).toContain('伝わらなかった');
    expect(mirror.line).not.toContain('学び');
    expect(mirror.line).not.toContain('成長');
  });

  it('never advises, praises or draws a lesson', () => {
    const lines = [
      buildMirror({ logId: 'l', categoryId: 'self_hard', joined: [] }).line,
      buildMirror({ logId: 'l', categoryId: 'self_hard', joined: [] }).line,
      buildMirror({
        logId: 'l',
        categoryId: 'progress_did',
        analysis: analysis({ eventSummary: '初対面の人に説明した' }),
        joined: [],
      }).line,
      buildMirror({ logId: 'l', categoryId: 'self_hard', joined: [progression('人に伝える')] })
        .line,
    ];
    for (const line of lines) {
      for (const banned of BANNED) expect(line).not.toContain(banned);
    }
  });

  it('names the trail when the record joined one, and makes it followable', () => {
    const mirror = buildMirror({
      logId: 'l',
      categoryId: 'self_hard',
      joined: [progression('人に伝える')],
    });
    expect(mirror.line).toContain('人に伝える');
    expect(mirror.joinedProgression).toEqual({ id: 'p1', title: '人に伝える' });
  });

  it('announces emergence over joining, quietly (§32)', () => {
    const mirror = buildMirror({
      logId: 'l',
      categoryId: 'self_hard',
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
