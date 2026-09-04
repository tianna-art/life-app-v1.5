/**
 * Meaning links between records: the threshold, the per-record budget, and the
 * rule that an unanalysed record joins nothing.
 */
import { buildSemanticEdges, jaccard, MAX_SEMANTIC_EDGES_PER_LOG, SIMILARITY_THRESHOLD } from '@/utils/similarity';
import type { LogWithAnalysis } from '@/types';

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
