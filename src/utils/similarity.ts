import type { LogWithAnalysis } from '@/types';

/** Spec §10.1. */
export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const intersection = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Connection threshold. Never surfaced to the user. */
export const SIMILARITY_THRESHOLD = 0.34;
/** Hard cap so the sky does not turn into a mesh. */
export const MAX_SEMANTIC_EDGES_PER_LOG = 2;

export interface SemanticEdge {
  sourceLogId: string;
  targetLogId: string;
  /** Internal only — must not be rendered or read out. */
  similarity: number;
}

/**
 * Build the "meaning" edges between logs of one period.
 *
 * Greedy by descending similarity, so the strongest pairs win the limited
 * budget of 2 edges per log. Deterministic for a given input order.
 */
export function buildSemanticEdges(
  logs: LogWithAnalysis[],
  options: { threshold?: number; maxPerLog?: number } = {}
): SemanticEdge[] {
  const threshold = options.threshold ?? SIMILARITY_THRESHOLD;
  const maxPerLog = options.maxPerLog ?? MAX_SEMANTIC_EDGES_PER_LOG;

  const candidates: SemanticEdge[] = [];
  for (let i = 0; i < logs.length; i += 1) {
    for (let j = i + 1; j < logs.length; j += 1) {
      const a = logs[i];
      const b = logs[j];
      if (!a || !b) continue;
      const tagsA = a.analysis?.semanticTags ?? [];
      const tagsB = b.analysis?.semanticTags ?? [];
      if (tagsA.length === 0 || tagsB.length === 0) continue;
      const similarity = jaccard(tagsA, tagsB);
      if (similarity >= threshold) {
        candidates.push({ sourceLogId: a.id, targetLogId: b.id, similarity });
      }
    }
  }

  candidates.sort((x, y) =>
    y.similarity - x.similarity ||
    x.sourceLogId.localeCompare(y.sourceLogId) ||
    x.targetLogId.localeCompare(y.targetLogId)
  );

  const used = new Map<string, number>();
  const accepted: SemanticEdge[] = [];
  for (const edge of candidates) {
    const usedSource = used.get(edge.sourceLogId) ?? 0;
    const usedTarget = used.get(edge.targetLogId) ?? 0;
    if (usedSource >= maxPerLog || usedTarget >= maxPerLog) continue;
    accepted.push(edge);
    used.set(edge.sourceLogId, usedSource + 1);
    used.set(edge.targetLogId, usedTarget + 1);
  }
  return accepted;
}
