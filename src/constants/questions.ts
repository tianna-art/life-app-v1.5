import type { LogType, MomentTag, ProgressionPattern } from '@/types';

/**
 * The Level 3 question (§11-§13).
 *
 * The purpose is not to make anyone think harder. It is to collect the one
 * piece of evidence the reading is missing and cannot infer — which record
 * came before, what was changed, who it was shown to. Everything here asks
 * about a fact.
 *
 * This table is the floor, not the ceiling: the model may rewrite a question
 * for context, but when it is slow, unreachable, or says something forbidden,
 * the table's answer ships instead. That is why it is exhaustive rather than
 * illustrative — the offline path has to be as good as the online one, and
 * this is the whole question surface of the app.
 */

export interface QuestionRule {
  tag: MomentTag;
  /** Asked when the record came in through this door. */
  byLogType: Record<LogType, string>;
  /** Patterns this question feeds. Used to rank when several tags apply. */
  feeds: readonly ProgressionPattern[];
}

/**
 * One question per (tag, door).
 *
 * The same tag means something different depending on the door — §15's point.
 * "変えてみた" on one's own actions asks what the method was; on a
 * relationship it asks what was done differently with someone.
 */
export const QUESTION_RULES: readonly QuestionRule[] = [
  {
    tag: 'first_time',
    byLogType: {
      self_action: '今回が初めてだったことは？',
      relationship: '初めて話したのは誰？',
      thought: '初めてそう思ったのはいつ？',
    },
    feeds: ['first_act', 'expose'],
  },
  {
    tag: 'changed',
    byLogType: {
      self_action: '前と何を変えた？',
      relationship: '前回と違ったのは？',
      thought: '前とどう考えが変わった？',
    },
    feeds: ['pivot', 'transfer'],
  },
  {
    tag: 'friction',
    byLogType: {
      self_action: '何が一番引っかかった？',
      relationship: '何が一番引っかかった？',
      thought: '何が一番引っかかった？',
    },
    feeds: ['pivot', 'boundary', 'reframe'],
  },
  {
    tag: 'discovered',
    byLogType: {
      self_action: '何が前より分かった？',
      relationship: '相手について何が分かった？',
      thought: '前より何がはっきりした？',
    },
    feeds: ['naming', 'reframe'],
  },
  {
    tag: 'self_decided',
    byLogType: {
      self_action: '何を自分で選んだ？',
      relationship: '誰に対して決めた？',
      thought: '自分で決めたのはどこ？',
    },
    feeds: ['own_call', 'boundary'],
  },
  {
    tag: 'enjoyed',
    byLogType: {
      self_action: '何をしている時が楽しかった？',
      relationship: '誰といる時の自分がよかった？',
      thought: '何に惹かれた？',
    },
    feeds: ['repeat', 'naming'],
  },
  {
    tag: 'tried',
    byLogType: {
      self_action: '何を形にしてみた？',
      relationship: '誰に見せてみた？',
      thought: '何を試そうと思った？',
    },
    feeds: ['first_act', 'repeat', 'expose'],
  },
] as const;

/**
 * Phrases a question must never contain (§12).
 *
 * These are the reflective questions the app took off the person's plate. A
 * question carrying one of them has stopped collecting evidence and started
 * asking for meaning, which is the model's job and not theirs.
 */
export const FORBIDDEN_QUESTION_PHRASES = [
  '学び',
  '意味',
  'なぜ',
  'どうして',
  '感じました',
  '思いました',
  '成長',
  '人生',
  '強み',
  'あなたは',
] as const;

/** Question length that still reads as one tap's worth of work (§11). */
export const MAX_QUESTION_LENGTH = 40;

export function isUsableQuestion(question: string): boolean {
  const trimmed = question.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_QUESTION_LENGTH) return false;
  return !FORBIDDEN_QUESTION_PHRASES.some((phrase) => trimmed.includes(phrase));
}

const RULE_BY_TAG = new Map(QUESTION_RULES.map((r) => [r.tag, r]));

/**
 * The question to ask, chosen without a model.
 *
 * With several tags, the one whose question feeds a watched pattern wins, so
 * someone whose year is about showing their work gets asked who they showed it
 * to rather than what they enjoyed. With no watched pattern to break the tie,
 * the tag order in §10 decides — it runs from the most interpretive to the
 * most concrete, and the concrete question is the more useful one.
 */
export function pickQuestion(input: {
  logType: LogType;
  momentTags: readonly MomentTag[];
  /** Patterns raised in priority by the year's cards. May be empty. */
  watched?: readonly ProgressionPattern[];
}): string | null {
  const watched = new Set(input.watched ?? []);

  const ranked = QUESTION_RULES.filter((rule) => input.momentTags.includes(rule.tag)).sort(
    (a, b) => {
      const aWatched = a.feeds.some((p) => watched.has(p)) ? 1 : 0;
      const bWatched = b.feeds.some((p) => watched.has(p)) ? 1 : 0;
      if (aWatched !== bWatched) return bWatched - aWatched;
      // Later in §10's list is more concrete; ask that one.
      return QUESTION_RULES.indexOf(b) - QUESTION_RULES.indexOf(a);
    }
  );

  const chosen = ranked[0];
  if (!chosen) return null;
  return chosen.byLogType[input.logType];
}

/** The patterns a tag's question is trying to feed, for the prompt. */
export function patternsForTag(tag: MomentTag): readonly ProgressionPattern[] {
  return RULE_BY_TAG.get(tag)?.feeds ?? [];
}
