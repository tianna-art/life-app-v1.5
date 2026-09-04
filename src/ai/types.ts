import type { KeywordCandidate, TitleCandidate } from '@/types';

/** Strict shapes returned by the Edge Functions (spec §9). */
export interface LogAnalysisResult {
  keywords: string[];
  semanticTags: string[];
  tone?: string;
  confidence?: number;
}

export interface CategoryInsightResult {
  insight: string;
  keywords: KeywordCandidate[];
}

export interface TitleCandidatesResult {
  candidates: TitleCandidate[];
}

/** Max keywords surfaced in the review panel (spec §7.3). */
export const MAX_REVIEW_KEYWORDS = 3;

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

/** Defensive parse: an LLM that drifts from the contract must not corrupt state. */
export function parseLogAnalysis(raw: unknown): LogAnalysisResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const keywords = asStringArray(value.keywords, 5);
  const semanticTags = asStringArray(value.semantic_tags ?? value.semanticTags, 8).map((t) =>
    t.toLowerCase().replace(/\s+/g, '_')
  );
  if (keywords.length === 0 && semanticTags.length === 0) return null;
  const confidence = typeof value.confidence === 'number' ? value.confidence : undefined;
  const result: LogAnalysisResult = { keywords, semanticTags };
  if (typeof value.tone === 'string') result.tone = value.tone;
  if (confidence !== undefined) result.confidence = Math.min(1, Math.max(0, confidence));
  return result;
}

export function parseCategoryInsight(raw: unknown): CategoryInsightResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.insight !== 'string' || value.insight.trim().length === 0) return null;
  const keywordsRaw = Array.isArray(value.keywords) ? value.keywords : [];
  const keywords: KeywordCandidate[] = keywordsRaw
    .map((k): KeywordCandidate | null => {
      if (typeof k !== 'object' || k === null) return null;
      const entry = k as Record<string, unknown>;
      if (typeof entry.label !== 'string' || entry.label.trim().length === 0) return null;
      return {
        label: entry.label.trim(),
        confidence:
          typeof entry.confidence === 'number' ? Math.min(1, Math.max(0, entry.confidence)) : 0.5,
        evidenceLogIds: asStringArray(entry.evidence_log_ids ?? entry.evidenceLogIds, 20),
      };
    })
    .filter((k): k is KeywordCandidate => k !== null)
    .slice(0, MAX_REVIEW_KEYWORDS);
  return { insight: value.insight.trim(), keywords };
}

export function parseTitleCandidates(raw: unknown): TitleCandidatesResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const list = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates: TitleCandidate[] = list
    .map((c): TitleCandidate | null => {
      if (typeof c !== 'object' || c === null) return null;
      const entry = c as Record<string, unknown>;
      if (typeof entry.title !== 'string' || entry.title.trim().length === 0) return null;
      return {
        title: entry.title.trim(),
        reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
      };
    })
    .filter((c): c is TitleCandidate => c !== null)
    .slice(0, 3);
  return candidates.length > 0 ? { candidates } : null;
}
