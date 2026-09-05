import type { LogAnalysis, MomentTag, Mirror, Progression } from '@/types';
import { momentTagLabel } from '@/constants/log';
import { JOINED_LINE, EMERGED_LINE } from '@/constants/copy';

export interface BuildMirrorInput {
  logId: string;
  momentTags: readonly MomentTag[];
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
 * was just left, named back plainly. It has to work with no free text at all,
 * which is the common case in v4 — so the tags the person tapped are what it
 * says back, in their own words.
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
 * With free text, it quotes the person. Without it, it names the drawer they
 * put the day in — 「『モヤモヤ』として残しました。」 says nothing the person
 * did not say, which is the point.
 */
function mirrorLine(input: BuildMirrorInput): string {
  const answer = input.analysis?.discovery ?? input.analysis?.eventSummary ?? '';

  if (input.momentTags.includes('first_time')) {
    return answer ? `初めて${trim(answer)}という記録。` : '初めての記録がひとつ残りました。';
  }
  if (answer) return `「${trim(answer)}」という記録。`;

  const tags = input.momentTags;
  if (tags.length === 0) return '記録がひとつ残りました。';
  if (tags.length === 1) {
    return `「${momentTagLabel(tags[0] as MomentTag)}」がひとつ残りました。`;
  }
  // Two or three tags: name them in the order they were tapped, and stop.
  return `「${tags.map((t) => momentTagLabel(t)).join('」「')}」として残しました。`;
}

function trim(value: string): string {
  return value.replace(/[。．.]+$/u, '').trim().slice(0, 40);
}
