import type { EntryAnalysis, Mirror, Progression } from '@/types';
import { JOINED_PROGRESSION_LINE, UNRESOLVED_LINE } from '@/constants/copy';

export interface BuildMirrorInput {
  logId: string;
  analysis: EntryAnalysis;
  /** Progressions this entry joined, if any. */
  joined: readonly Progression[];
  /** True when this entry was the one that turned dots into a line (§32). */
  emerged?: boolean;
}

/**
 * The line shown right after a save (§15).
 *
 * One record never produces a progression, so this is small by design: the one
 * thing that can be said about what was just written, and — if it happened to
 * land on a trail that already existed — that it did.
 *
 * What it must never be: advice, praise, a lesson, or a trajectory invented to
 * make the save feel rewarding. When nothing can honestly be said, the day is
 * allowed to stay unread.
 */
export function buildMirror(input: BuildMirrorInput): Mirror {
  const joined = input.joined[0];

  if (joined) {
    return {
      logId: input.logId,
      line: JOINED_PROGRESSION_LINE.replace('{title}', joined.title),
      joinedProgression: { id: joined.id, title: joined.title },
    };
  }

  return { logId: input.logId, line: mirrorLine(input.analysis) };
}

/**
 * One sentence built only from what the record itself contains.
 *
 * Each branch quotes something the person actually wrote — a hypothesis they
 * formed, an intention they stated, a first time they named — rather than
 * summarising it back at them with meaning attached.
 */
function mirrorLine(analysis: EntryAnalysis): string {
  if (analysis.hypothesis) return `「${trim(analysis.hypothesis)}」という仮説が残りました。`;
  if (analysis.futureIntention) return `「${trim(analysis.futureIntention)}」と書いた日。`;
  if (analysis.journeyRole === 'attempt' && analysis.action) {
    return `${trim(analysis.action)}日。`;
  }
  if (analysis.journeyRole === 'setback' && analysis.outcome) {
    return `${trim(analysis.outcome)}という記録。`;
  }
  // Nothing quotable: say so rather than reaching for something.
  return UNRESOLVED_LINE;
}

function trim(value: string): string {
  return value.replace(/[。．.]+$/u, '').trim().slice(0, 40);
}
