/**
 * MAP: only categories used in the period appear, periods never merge, and
 * semantic links stay within their budget.
 */
import { buildMonthlyLayout, buildYearlyLayout, MAX_REPRESENTATIVE_LOGS_PER_MONTH } from '@/map/layout';
import { buildSemanticEdges, jaccard, MAX_SEMANTIC_EDGES_PER_LOG, SIMILARITY_THRESHOLD } from '@/utils/similarity';
import { shiftMonthKey, shiftYearKey, monthKeyOfDate } from '@/utils/period';
import type { Category, LogWithAnalysis } from '@/types';

const categories: Category[] = [
  '楽しかったこと',
  'できたこと',
  '学び',
  'モヤモヤ',
  '人間関係',
  'その他',
].map((name, index) => ({
  id: `cat-${index}`,
  name,
  slug: `slug-${index}`,
  sortOrder: index,
  isActive: true,
  isDefault: true,
  promptExamples: [],
}));

function log(
  id: string,
  categoryId: string,
  occurredOn: string,
  tags: string[] = [],
  type: 'event' | 'thought' = 'event'
): LogWithAnalysis {
  return {
    id,
    userId: 'u',
    occurredOn,
    type,
    categoryId,
    body: `本文 ${id}`,
    createdAt: `${occurredOn}T09:00:00.000Z`,
    analysis: { logId: id, keywords: tags, semanticTags: tags },
  };
}

describe('monthly map', () => {
  const september = [
    log('s1', 'cat-0', '2026-09-02'),
    log('s2', 'cat-1', '2026-09-05'),
    log('s3', 'cat-1', '2026-09-11'),
    log('s4', 'cat-4', '2026-09-20'),
  ];

  it('shows only the categories that were actually used', () => {
    const layout = buildMonthlyLayout({
      periodKey: '2026-09',
      width: 340,
      height: 420,
      categories,
      logs: september,
    });

    const shown = layout.categoryNodes.map((n) => n.name).sort();
    expect(shown).toEqual(['楽しかったこと', '人間関係', 'できたこと'].sort());
    // 教訓 / ひっかかり / その他 were not used, so they never appear.
    expect(shown).not.toContain('学び');
    expect(shown).not.toContain('モヤモヤ');
    expect(shown).not.toContain('その他');
  });

  it('draws one membership edge per log', () => {
    const layout = buildMonthlyLayout({
      periodKey: '2026-09',
      width: 340,
      height: 420,
      categories,
      logs: september,
    });
    expect(layout.logNodes).toHaveLength(september.length);
    expect(layout.edges.filter((e) => e.variant === 'membership')).toHaveLength(september.length);
  });

  it('renders an empty sky for a month with no logs, without borrowing another month', () => {
    const layout = buildMonthlyLayout({
      periodKey: '2026-10',
      width: 340,
      height: 420,
      categories,
      logs: [],
    });
    expect(layout.categoryNodes).toHaveLength(0);
    expect(layout.logNodes).toHaveLength(0);
  });

  it('is deterministic for the same period and logs', () => {
    const args = { periodKey: '2026-09', width: 340, height: 420, categories, logs: september };
    const a = buildMonthlyLayout(args);
    const b = buildMonthlyLayout(args);
    expect(a.categoryNodes.map((n) => [n.x, n.y])).toEqual(b.categoryNodes.map((n) => [n.x, n.y]));
  });
});

describe('period swiping never merges data', () => {
  const all = [
    log('a1', 'cat-0', '2026-08-31'),
    log('a2', 'cat-0', '2026-09-01'),
    log('a3', 'cat-1', '2026-09-30'),
    log('a4', 'cat-1', '2026-10-01'),
  ];

  function forMonth(key: string) {
    return all.filter((l) => monthKeyOfDate(l.occurredOn) === key);
  }

  it('a month shows only its own logs, including at the boundaries', () => {
    expect(forMonth('2026-09').map((l) => l.id)).toEqual(['a2', 'a3']);
    expect(forMonth('2026-08').map((l) => l.id)).toEqual(['a1']);
    expect(forMonth('2026-10').map((l) => l.id)).toEqual(['a4']);
  });

  it('swiping moves exactly one period at a time', () => {
    expect(shiftMonthKey('2026-09', -1)).toBe('2026-08');
    expect(shiftMonthKey('2026-09', 1)).toBe('2026-10');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftYearKey('2026', -1)).toBe('2025');
  });

  it('two adjacent months produce disjoint maps', () => {
    const sep = buildMonthlyLayout({
      periodKey: '2026-09',
      width: 340,
      height: 420,
      categories,
      logs: forMonth('2026-09'),
    });
    const oct = buildMonthlyLayout({
      periodKey: '2026-10',
      width: 340,
      height: 420,
      categories,
      logs: forMonth('2026-10'),
    });

    const sepIds = sep.logNodes.map((n) => n.logId);
    const octIds = oct.logNodes.map((n) => n.logId);
    expect(sepIds).toEqual(['a2', 'a3']);
    expect(octIds).toEqual(['a4']);
    expect(sepIds.some((id) => octIds.includes(id))).toBe(false);
  });
});

describe('yearly map', () => {
  it('caps representative logs at 3 per month per category', () => {
    const logs = Array.from({ length: 7 }, (_, i) =>
      log(`y${i}`, 'cat-1', `2026-03-${String(i + 1).padStart(2, '0')}`)
    );
    const layout = buildYearlyLayout({
      periodKey: '2026',
      width: 340,
      height: 460,
      categories,
      logs,
    });

    expect(layout.monthNodes).toHaveLength(1);
    expect(layout.logNodes.length).toBeLessThanOrEqual(MAX_REPRESENTATIVE_LOGS_PER_MONTH);
    expect(layout.logNodes).toHaveLength(3);
  });

  it('only shows categories used during the year', () => {
    const layout = buildYearlyLayout({
      periodKey: '2026',
      width: 340,
      height: 460,
      categories,
      logs: [log('y1', 'cat-2', '2026-05-02')],
    });
    expect(layout.categoryNodes.map((n) => n.name)).toEqual(['学び']);
  });
});

describe('semantic links', () => {
  it('computes Jaccard similarity', () => {
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(jaccard(['a', 'b'], ['c'])).toBe(0);
    expect(jaccard([], [])).toBe(0);
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'd'])).toBeCloseTo(0.5);
  });

  it('connects only pairs at or above the threshold', () => {
    const near = [
      log('n1', 'cat-0', '2026-09-01', ['autonomy', 'creative_work', 'progress_signal']),
      log('n2', 'cat-0', '2026-09-02', ['autonomy', 'creative_work', 'other']),
    ];
    const far = [
      log('f1', 'cat-0', '2026-09-01', ['autonomy', 'a', 'b', 'c']),
      log('f2', 'cat-0', '2026-09-02', ['autonomy', 'd', 'e', 'f']),
    ];

    expect(jaccard(near[0]!.analysis!.semanticTags, near[1]!.analysis!.semanticTags)).toBeGreaterThanOrEqual(
      SIMILARITY_THRESHOLD
    );
    expect(buildSemanticEdges(near)).toHaveLength(1);
    expect(jaccard(far[0]!.analysis!.semanticTags, far[1]!.analysis!.semanticTags)).toBeLessThan(
      SIMILARITY_THRESHOLD
    );
    expect(buildSemanticEdges(far)).toHaveLength(0);
  });

  it('gives each log at most two semantic edges', () => {
    const tags = ['x', 'y', 'z'];
    const logs = Array.from({ length: 6 }, (_, i) =>
      log(`m${i}`, 'cat-0', `2026-09-0${i + 1}`, tags)
    );
    const edges = buildSemanticEdges(logs);

    const used = new Map<string, number>();
    for (const edge of edges) {
      used.set(edge.sourceLogId, (used.get(edge.sourceLogId) ?? 0) + 1);
      used.set(edge.targetLogId, (used.get(edge.targetLogId) ?? 0) + 1);
    }
    for (const count of used.values()) {
      expect(count).toBeLessThanOrEqual(MAX_SEMANTIC_EDGES_PER_LOG);
    }
  });

  it('ignores logs with no analysis yet', () => {
    const withoutAnalysis: LogWithAnalysis = {
      id: 'p1',
      userId: 'u',
      occurredOn: '2026-09-01',
      type: 'event',
      categoryId: 'cat-0',
      body: '未解析',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    expect(buildSemanticEdges([withoutAnalysis, log('p2', 'cat-0', '2026-09-02', ['a'])])).toHaveLength(0);
  });
});
