/**
 * Turns a category's period into a Markdown article.
 *
 * The wording stays observational throughout: counts of what the user actually
 * wrote, never a claim about who they are. Anything the model produced arrives
 * as `insight`; everything else here is arithmetic over their own records.
 */
import type { CategoryInsight, LogWithAnalysis } from '@/types';
import { buildSemanticClusters } from '@/utils/similarity';
import { formatShortDate } from '@/utils/period';

export interface ArticleInput {
  categoryName: string;
  periodLabel: string;
  insight: CategoryInsight | null;
  logs: LogWithAnalysis[];
}

export function buildCategoryArticle({
  categoryName,
  periodLabel,
  insight,
  logs,
}: ArticleInput): string {
  const events = logs.filter((l) => l.type === 'event').length;
  const thoughts = logs.length - events;

  const parts: string[] = [];

  parts.push(`## ${categoryName}`);
  parts.push(`### ${periodLabel}`);

  if (insight?.insight) {
    parts.push(insight.insight);
  } else if (logs.length > 0) {
    parts.push(
      `この期間の「${categoryName}」には ${logs.length} 件の記録が残っています。まだ確かではありませんが、いくつかの場面に記録が集まっています。`
    );
  } else {
    parts.push(`この期間の「${categoryName}」には、まだ記録がありません。`);
  }

  if (logs.length > 0) {
    parts.push('### のこしたもの');
    const shape: string[] = [];
    if (events > 0) shape.push(`- 出来事 ${events} 件`);
    if (thoughts > 0) shape.push(`- つぶやき ${thoughts} 件`);
    parts.push(shape.join('\n'));
  }

  const clusters = buildSemanticClusters(logs);
  if (clusters.length > 0) {
    const byId = new Map(logs.map((l) => [l.id, l]));
    parts.push('### 近くにある記録');
    parts.push(
      'ことばの重なりから、近い場所にある記録をまとめています。意味づけではなく、並べているだけです。'
    );
    clusters.slice(0, 3).forEach((cluster) => {
      const lines = cluster.logIds
        .map((id) => byId.get(id))
        .filter((l): l is LogWithAnalysis => Boolean(l))
        .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
        .map((l) => `- ${formatShortDate(l.occurredOn)}　${l.body}`);
      parts.push(lines.join('\n'));
    });
  }

  if (logs.length > 0) {
    parts.push('### この期間の記録');
    parts.push(
      [...logs]
        .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
        .map((l) => `- ${formatShortDate(l.occurredOn)}　${l.body}`)
        .join('\n')
    );
  }

  return parts.join('\n\n');
}
