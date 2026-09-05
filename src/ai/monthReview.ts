/**
 * The month-end reading, built without a model.
 *
 * Used when no Edge Function is reachable. Everything here is arithmetic over
 * what the person actually recorded: the changes are the progressions already
 * stored, the gains are the ones already attached to them, and the titles are
 * drawn from a fixed list rather than written.
 *
 * The one thing it refuses to do is the thing §7 warns about. When the month
 * went somewhere other than its theme, it does not say "予定通りではありません
 * でしたが、必ず意味がありました" — it says what actually recurred, or it says
 * that the month can stay undecided.
 */
import type {
  GainCategory,
  LogWithAnalysis,
  MonthProgression,
  MonthReview,
  MonthReviewChange,
  MonthReviewGain,
  Progression,
  ProgressionPattern,
} from '@/types';
import { maturityRank } from './progressionRules';

/** Titles describe what the month's records were, not how the month went. */
const TITLE_BY_PATTERN: Record<ProgressionPattern, string> = {
  naming: '名前がついた月',
  first_act: '初めてやってみた月',
  repeat: 'もう一度やった月',
  solo: 'ひとりでやった月',
  pivot: 'やり方を変えた月',
  expose: '外に出してみた月',
  own_call: '自分で決めた月',
  transfer: '別の場所でも試した月',
  reframe: '見え方が変わった月',
  boundary: '線を引いた月',
};

/**
 * A month with records but no movement yet. Not a failure, just early — which
 * is why it names what is true (records were kept) rather than what is not.
 */
const QUIET_TITLE = '記録の残った月';

/** §7: a month that went nowhere in particular is allowed to say so. */
export const UNDECIDED_MONTH =
  '今月はまだ、この変化の意味を決めなくてよさそうです。';

/**
 * `「Aから」「Bへ」` when both states are known, and nothing when they are not.
 * A half-known movement is left unstated rather than guessed at.
 */
export function progressionLine(progression: Progression): string {
  const { fromState, currentState } = progression;
  if (fromState && currentState) return `「${fromState}」から「${currentState}」へ。`;
  if (currentState) return `いまは「${currentState}」。`;
  return progression.summary;
}

export interface BuildLocalMonthReviewInput {
  periodKey: string;
  logs: readonly LogWithAnalysis[];
  progressions: readonly MonthProgression[];
  gains: readonly { category: GainCategory; label: string; progressionId?: string | undefined }[];
  /** What the month set out with, if anything (§25). */
  initialTheme?: string | undefined;
}

export function buildLocalMonthReview({
  periodKey,
  logs,
  progressions,
  gains,
  initialTheme,
}: BuildLocalMonthReviewInput): MonthReview | null {
  // A month with nothing in it is not summarised, and is not apologised for.
  if (logs.length === 0) return null;

  // Best-supported first: how settled it is, then how much stands behind it.
  const ranked = [...progressions].sort((a, b) => {
    const byMaturity = maturityRank(b.maturityThen) - maturityRank(a.maturityThen);
    if (byMaturity !== 0) return byMaturity;
    return b.evidenceLogIds.length - a.evidenceLogIds.length;
  });

  const top = ranked[0];
  const title = top?.progression.pattern
    ? (TITLE_BY_PATTERN[top.progression.pattern] ?? QUIET_TITLE)
    : QUIET_TITLE;

  const changed: MonthReviewChange[] = ranked.slice(0, 3).flatMap((item) => {
    const line = progressionLine(item.progression);
    // A progression with nothing to say about how it changed is left out
    // rather than printed as a bare title.
    return line.length > 0 ? [{ title: item.progression.title, line }] : [];
  });

  const movedIds = new Set(ranked.map((item) => item.progression.id));
  const gained: MonthReviewGain[] = gains
    .filter((g) => g.progressionId != null && movedIds.has(g.progressionId))
    .slice(0, 3)
    .map((g) => ({ category: g.category, label: g.label }));

  return {
    periodKey,
    initialTheme: initialTheme ?? '',
    // Without a model there is no sentence to write here that would not be
    // invented, so the month says what recurred or says nothing.
    whatActuallyHappened: changed.length > 0 ? changed[0]?.line ?? '' : UNDECIDED_MONTH,
    changed,
    gained,
    // Offering choices needs writing; the fallback picks one and stops.
    titleCandidates: [],
    title,
    subtitle: '',
    createdAt: new Date().toISOString(),
  };
}
