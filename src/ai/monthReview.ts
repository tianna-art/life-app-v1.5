/**
 * The month-end reading, built without a model.
 *
 * Used when no Edge Function is reachable. Everything here is arithmetic over
 * what the person actually wrote: the title names the shape of the month's
 * records, the progressions are the best-supported ones already stored, and
 * each line is assembled from the two states the progression already holds.
 *
 * Nothing is asserted about who they are, and nothing is invented to fill a
 * slot: §23 says a month with two movements says two.
 */
import type {
  EntryWithAnalysis,
  MonthProgression,
  MonthReview,
  MonthReviewProgression,
  ProgressionType,
} from '@/types';
import { maturityRank } from './progressionRules';

interface TitleShape {
  title: string;
  subtitle: string;
}

/** Titles describe what the month's records were, not how the month went. */
const TITLE_BY_TYPE: Record<ProgressionType, TitleShape> = {
  capability: { title: 'DONE AGAIN', subtitle: '繰り返した月' },
  strategy: { title: 'A DIFFERENT WAY', subtitle: 'やり方を変えてみた月' },
  interest: { title: 'WHAT PULLED', subtitle: '気になるものが動いた月' },
  direction: { title: 'A BEARING', subtitle: '向きが見えてきた月' },
  relationship: { title: 'OUT INTO THE WORLD', subtitle: '外に出し始めた月' },
  perspective: { title: 'SEEN DIFFERENTLY', subtitle: '見え方が変わった月' },
};

/** A month with records but no movement yet. Not a failure, just early. */
const QUIET_MONTH: TitleShape = { title: 'KEPT', subtitle: '残しつづけた月' };

/**
 * `「Aから」「Bへ」` when both states are known, and nothing at all when they
 * are not. A half-known movement is left unstated rather than guessed at.
 */
export function progressionLine(progression: MonthProgression['progression']): string {
  const { fromState, currentState } = progression;
  if (fromState && currentState) return `「${fromState}」から「${currentState}」へ。`;
  if (currentState) return `いまは「${currentState}」。`;
  return progression.summary;
}

export interface BuildLocalMonthReviewInput {
  periodKey: string;
  entries: readonly EntryWithAnalysis[];
  progressions: readonly MonthProgression[];
}

export function buildLocalMonthReview({
  periodKey,
  entries,
  progressions,
}: BuildLocalMonthReviewInput): MonthReview | null {
  // A month with nothing in it is not summarised, and is not apologised for.
  if (entries.length === 0) return null;

  // Best-supported first: how settled it is, then how much stands behind it.
  const ranked = [...progressions].sort((a, b) => {
    const byMaturity =
      maturityRank(b.maturityThen) - maturityRank(a.maturityThen);
    if (byMaturity !== 0) return byMaturity;
    return b.evidenceLogIds.length - a.evidenceLogIds.length;
  });

  const top = ranked[0];
  const shape = top ? (TITLE_BY_TYPE[top.progression.type] ?? QUIET_MONTH) : QUIET_MONTH;

  const lines: MonthReviewProgression[] = ranked.slice(0, 3).flatMap((item) => {
    const line = progressionLine(item.progression);
    // A progression with nothing to say about how it changed is left out
    // rather than printed as a bare title.
    return line.length > 0 ? [{ title: item.progression.title, line }] : [];
  });

  return {
    periodKey,
    title: shape.title,
    subtitle: shape.subtitle,
    progressions: lines,
    // Without a model there is nothing honest to say here, so it stays empty
    // and the screen simply omits the section.
    carryingForward: '',
    createdAt: new Date().toISOString(),
  };
}
