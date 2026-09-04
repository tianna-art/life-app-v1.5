/**
 * Evidence-only fallback used when no Edge Function is reachable (local store
 * mode / offline). It is NOT a model: it only counts what the user actually
 * wrote, and it never asserts anything about the person.
 */
import type { CategoryInsight, LogWithAnalysis } from '@/types';
import { uuid } from '@/utils/id';
import type { CategoryInsightResult, LogAnalysisResult, TitleCandidatesResult } from './types';

const STOPWORDS = new Set([
  'こと', 'もの', 'それ', 'これ', 'ため', 'よう', 'そう', 'した', 'して', 'ある', 'いる',
  'なる', 'から', 'まで', 'ない', 'でも', 'たい', 'です', 'ます', 'the', 'and', 'for',
]);

/** Naive segmentation: keeps kanji/katakana runs and latin words. */
export function extractTerms(text: string): string[] {
  const matches = text.match(/[一-鿿]{2,}|[゠-ヿ]{2,}|[A-Za-z]{3,}/g) ?? [];
  return matches.map((m) => m.trim()).filter((m) => m.length > 1 && !STOPWORDS.has(m));
}

export function localAnalyzeLog(body: string): LogAnalysisResult {
  const terms = extractTerms(body);
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);
  const keywords = ranked.slice(0, 3);
  return {
    keywords,
    semanticTags: keywords.map((k) => `t_${k.toLowerCase()}`),
    tone: 'unspecified',
    // Deliberately low: this is a word count, not an interpretation.
    confidence: keywords.length > 0 ? 0.3 : 0,
  };
}

export function localCategoryInsight(
  categoryName: string,
  logs: LogWithAnalysis[]
): CategoryInsightResult {
  const counts = new Map<string, string[]>();
  for (const log of logs) {
    const terms = log.analysis?.keywords?.length
      ? log.analysis.keywords
      : extractTerms(log.body).slice(0, 3);
    for (const term of terms) {
      const ids = counts.get(term) ?? [];
      if (!ids.includes(log.id)) ids.push(log.id);
      counts.set(term, ids);
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 3);

  const insight =
    ranked.length > 0 && (ranked[0]?.[1].length ?? 0) > 1
      ? `この期間の「${categoryName}」では、${ranked
          .filter(([, ids]) => ids.length > 1)
          .map(([label]) => `「${label}」`)
          .join('と')}に関する記録が何度か現れています。`
      : `この期間の「${categoryName}」には ${logs.length} 件の記録が残っています。まだ確かではありませんが、いくつかの場面に記録が集まっています。`;

  return {
    insight,
    keywords: ranked.map(([label, ids]) => ({
      label,
      confidence: Math.min(0.6, 0.25 + ids.length * 0.1),
      evidenceLogIds: ids,
    })),
  };
}

export function localTitleCandidates(periodLabel: string): TitleCandidatesResult {
  return {
    candidates: [
      {
        title: `${periodLabel} — まだ言葉になっていない期間`,
        reason: 'AIに接続していないため、記録の件数だけを手がかりにした控えめな案です。',
      },
      {
        title: `${periodLabel} — 点を置き続けた期間`,
        reason: '残された記録があることだけを根拠にしています。',
      },
      {
        title: `${periodLabel}`,
        reason: '評価を含まない、期間そのものの呼び名です。',
      },
    ],
  };
}

export function makeLocalInsight(
  periodType: CategoryInsight['periodType'],
  periodKey: string,
  categoryId: string,
  categoryName: string,
  logs: LogWithAnalysis[]
): CategoryInsight {
  const result = localCategoryInsight(categoryName, logs);
  return {
    id: uuid(),
    periodType,
    periodKey,
    categoryId,
    insight: result.insight,
    keywords: result.keywords,
    status: 'pending',
  };
}
