import type { CategoryId, LogAnalysis, Mirror, Progression } from '@/types';
import { categoryLabel } from '@/constants/log';
import { JOINED_LINE, EMERGED_LINE } from '@/constants/copy';

export interface BuildMirrorInput {
  logId: string;
  /** What the person filed it under. Absent on an unclassified free entry. */
  categoryId?: CategoryId | undefined;
  analysis?: LogAnalysis | undefined;
  /** Progressions this record joined, if any. */
  joined: readonly Progression[];
  /** Set when this save is what turned separate points into a line (§32). */
  emerged?: { progression: Progression; count: number } | undefined;
}

/**
 * The line shown right after a save (§31).
 *
 * One record never produces a progression, so this is small by design: what
 * was just left, named back plainly. It has to work with no free text at all —
 * so the category the person chose is what it says back, in their own words.
 *
 * What it must never be: advice, praise, a lesson, or a trajectory invented to
 * make the save feel rewarding.
 */
export function buildMirror(input: BuildMirrorInput): Mirror {
  // The one moment worth interrupting for: separate points becoming a line.
  if (input.emerged) {
    return {
      logId: input.logId,
      line: EMERGED_LINE.replace('{count}', String(input.emerged.count)),
      emergedProgression: {
        id: input.emerged.progression.id,
        title: input.emerged.progression.title,
        count: input.emerged.count,
      },
    };
  }

  const joined = input.joined[0];
  if (joined) {
    return {
      logId: input.logId,
      line: JOINED_LINE.replace('{title}', joined.title),
      joinedProgression: { id: joined.id, title: joined.title },
    };
  }

  return { logId: input.logId, line: mirrorLine(input) };
}

/**
 * One sentence built only from what the record itself contains.
 *
 * With free text, it quotes the person. Without it, it names the category they
 * put the day in — 「『しんどかった』がひとつ残りました。」 says nothing the
 * person did not say, which is the point.
 */
function mirrorLine(input: BuildMirrorInput): string {
  const answer = input.analysis?.discovery ?? input.analysis?.eventSummary ?? '';

  if (input.categoryId === 'progress_did' && !answer) {
    return '「できた」がひとつ残りました。';
  }
  if (answer) return `「${trim(answer)}」という記録。`;

  const label = categoryLabel(input.categoryId);
  if (!label) return '記録がひとつ残りました。';
  return `「${label}」がひとつ残りました。`;
}

function trim(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}
