/**
 * The radial graph: 自分 at the centre, only the categories actually used, and
 * leaves that appear only once a branch is opened.
 */
import { buildGraph } from '@/map/graph';
import { buildSemanticClusters } from '@/utils/similarity';
import { buildCategoryArticle } from '@/ai/article';
import { fallbackIcon } from '@/constants/icons';
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
  icon: fallbackIcon(`slug-${index}`),
  promptExamples: [],
}));

function log(
  id: string,
  categoryId: string,
  occurredOn: string,
  tags: string[] = [],
  body = `本文 ${id}`
): LogWithAnalysis {
  return {
    id,
    userId: 'u',
    occurredOn,
    type: 'event',
    categoryId,
    body,
    createdAt: `${occurredOn}T09:00:00.000Z`,
    analysis: { logId: id, keywords: tags, semanticTags: tags },
  };
}

const september = [
  log('s1', 'cat-0', '2026-09-02'),
  log('s2', 'cat-1', '2026-09-05'),
  log('s3', 'cat-1', '2026-09-11'),
];

const base = { periodKey: '2026-09', width: 340, height: 460, categories };

describe('buildGraph', () => {
  it('puts 自分 at the centre with the used categories hanging off it', () => {
    const graph = buildGraph({ ...base, logs: september, expanded: new Set() });
    const self = graph.nodes.find((n) => n.kind === 'self');

    expect(self).toBeDefined();
    expect(self?.x).toBeCloseTo(170);
    expect(self?.y).toBeCloseTo(230);

    const names = graph.nodes.filter((n) => n.kind === 'category').map((n) => n.label).sort();
    expect(names).toEqual(['できたこと', '楽しかったこと']);
    expect(names).not.toContain('学び');

    // Every category is joined to the centre, and to nothing else.
    const treeEdges = graph.edges.filter((e) => e.kind === 'tree');
    expect(treeEdges).toHaveLength(2);
    expect(treeEdges.every((e) => e.from === 'self')).toBe(true);
  });

  it('keeps records hidden until their branch is opened', () => {
    const closed = buildGraph({ ...base, logs: september, expanded: new Set() });
    expect(closed.nodes.filter((n) => n.kind === 'log')).toHaveLength(0);

    const open = buildGraph({ ...base, logs: september, expanded: new Set(['cat-1']) });
    const leaves = open.nodes.filter((n) => n.kind === 'log').map((n) => n.logId);
    expect(leaves.sort()).toEqual(['s2', 's3']);
    // The other branch stays closed.
    expect(leaves).not.toContain('s1');
  });

  it('sizes a category by how much was written, not by count alone', () => {
    const wordy = [
      log('a', 'cat-0', '2026-09-01', [], 'x'.repeat(400)),
      log('b', 'cat-1', '2026-09-02', [], 'x'.repeat(10)),
    ];
    const graph = buildGraph({ ...base, logs: wordy, expanded: new Set() });
    const big = graph.nodes.find((n) => n.categoryId === 'cat-0');
    const small = graph.nodes.find((n) => n.categoryId === 'cat-1');
    expect(big!.r).toBeGreaterThan(small!.r);
  });

  it('is deterministic, so the same period settles into the same figure', () => {
    const args = { ...base, logs: september, expanded: new Set(['cat-1']) };
    const a = buildGraph(args);
    const b = buildGraph(args);
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });

  it('draws an empty figure for a period with no records', () => {
    const graph = buildGraph({ ...base, periodKey: '2026-10', logs: [], expanded: new Set() });
    expect(graph.nodes.filter((n) => n.kind !== 'self')).toHaveLength(0);
  });

  it('keeps every node inside the canvas', () => {
    const many = Array.from({ length: 24 }, (_, i) =>
      log(`m${i}`, `cat-${i % 5}`, `2026-09-${String((i % 27) + 1).padStart(2, '0')}`)
    );
    const graph = buildGraph({
      ...base,
      logs: many,
      expanded: new Set(['cat-0', 'cat-1', 'cat-2', 'cat-3', 'cat-4']),
    });
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(340);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(460);
    }
  });
});

describe('buildSemanticClusters', () => {
  it('groups records that keep circling the same tags', () => {
    const logs = [
      log('c1', 'cat-0', '2026-09-01', ['autonomy', 'creative_work']),
      log('c2', 'cat-0', '2026-09-02', ['autonomy', 'creative_work']),
      log('c3', 'cat-0', '2026-09-03', ['unrelated_a', 'unrelated_b']),
    ];
    const clusters = buildSemanticClusters(logs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.logIds.sort()).toEqual(['c1', 'c2']);
    expect(clusters[0]!.sharedTags).toContain('autonomy');
  });

  it('never reports a single record as a pattern', () => {
    const logs = [log('only', 'cat-0', '2026-09-01', ['alone'])];
    expect(buildSemanticClusters(logs)).toEqual([]);
  });
});

describe('buildCategoryArticle', () => {
  it('reads as a document and states only what was counted', () => {
    const article = buildCategoryArticle({
      categoryName: 'できたこと',
      periodLabel: 'SEPTEMBER 2026',
      insight: null,
      logs: september,
    });
    expect(article).toContain('## できたこと');
    expect(article).toContain('### SEPTEMBER 2026');
    expect(article).toContain('3 件の記録');
    expect(article).toContain('まだ確かではありませんが');
    // No verdict about the person.
    expect(article).not.toContain('あなたは');
  });

  it('uses the model insight when there is one', () => {
    const article = buildCategoryArticle({
      categoryName: 'できたこと',
      periodLabel: 'SEPTEMBER 2026',
      insight: {
        id: 'i1',
        periodType: 'month',
        periodKey: '2026-09',
        categoryId: 'cat-1',
        insight: '試作して人に見せた記録が何度か続いています。',
        keywords: [],
        status: 'pending',
      },
      logs: september,
    });
    expect(article).toContain('試作して人に見せた記録が何度か続いています。');
  });

  it('says so plainly when a period holds nothing', () => {
    const article = buildCategoryArticle({
      categoryName: '学び',
      periodLabel: 'OCTOBER 2026',
      insight: null,
      logs: [],
    });
    expect(article).toContain('まだ記録がありません');
    expect(article).not.toContain('足りません');
  });
});
