import type { Gain, GainStatus, TodaysGain } from '@/types';
import { UNRESOLVED_LINE } from '@/constants/copy';

/**
 * The one line shown after a save (§8).
 *
 * It is composed here, in code, rather than asked of the model. A model given
 * "write one encouraging line" writes praise; a template given a gain writes
 * a description. The line only ever says what kind of thing was noticed and
 * quotes the label back — never how well the person is doing.
 */
function line(gain: Gain): string {
  const label = gain.label;
  const early = gain.maturity === 'signal' || gain.maturity === 'attempt';

  switch (gain.type) {
    case 'strategy':
      return `次は「${label}」という新しい仮説。`;
    case 'insight':
      return early ? `「${label}」と書いた記録。` : `「${label}」が、何度か出てきている。`;
    case 'capability':
      return early ? `「${label}」を実際にやってみた記録。` : `「${label}」の記録が積み重なっている。`;
    case 'direction':
      return `「${label}」に向いている、小さな兆し。`;
    case 'connection':
      return `「${label}」というつながりの記録。`;
    case 'evidence':
      return `「${label}」という経験が残った。`;
    default:
      return `「${label}」の記録。`;
  }
}

/**
 * Picks at most one gain to show. Nothing is invented: when the reading came
 * back unresolved, or no gain survived clamping, the day is simply left as it
 * is — that is a valid outcome, not a failure to report.
 */
export function buildTodaysGain(input: {
  logId: string;
  gainStatus: GainStatus;
  gains: readonly Gain[];
}): TodaysGain {
  if (input.gainStatus === 'unresolved' || input.gains.length === 0) {
    return { logId: input.logId, line: UNRESOLVED_LINE };
  }

  // The most-supported reading wins; ties break on confidence, then on label
  // so the same save always shows the same line.
  const [best] = [...input.gains].sort(
    (a, b) =>
      Date.parse(b.lastDetectedAt) - Date.parse(a.lastDetectedAt) ||
      b.confidence - a.confidence ||
      a.label.localeCompare(b.label)
  );
  if (!best) return { logId: input.logId, line: UNRESOLVED_LINE };

  return {
    logId: input.logId,
    line: line(best),
    gainId: best.id,
    gainType: best.type,
  };
}
