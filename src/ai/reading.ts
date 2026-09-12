/**
 * What a reading is allowed to be.
 *
 * These rules are not prompt instructions. A prompt is a request, and a model
 * that ignores one produces a card with nothing behind it, a hypothesis from a
 * single afternoon, or a summary that turns a bad week into a lesson. So the
 * model proposes and this module disposes: everything it returns passes
 * through here, and anything that fails is dropped rather than shown.
 *
 * The same file runs in the Edge Function (which writes) and in the app (which
 * can check what it was given), so there is one statement of the rules and a
 * parity test that fails if the two ever diverge.
 *
 * @declares-forbidden-register — these rules reject those phrasings, so they
 * have to name them.
 */
import type { AntennaId, InsightLabel } from '@/types';

export const INSIGHT_LABELS: readonly InsightLabel[] = [
  '積み上がったこと',
  '力が出る条件',
  '大切にしたいもの',
  '自分に合う進み方',
  '続けやすい方法',
  '心が向く方向',
  '思っていたこととの違い',
  '手がかり',
];

/** A card needs this many records before it stops being a 手がかり. */
export const EVIDENCE_FOR_PATTERN = 2;
/** 今の仮説 needs this many cards that each cleared the bar above. */
export const CARDS_FOR_HYPOTHESIS = 2;
export const MAX_CARDS = 4;
export const SUMMARY_WORDS = 3;
export const SUMMARY_MIN_CHARS = 100;
export const SUMMARY_MAX_CHARS = 150;

export interface ProposedInsight {
  antennaId: AntennaId;
  label: string;
  text: string;
  why?: string;
  note?: string;
  evidenceLogIds: string[];
}

export interface AcceptedInsight extends ProposedInsight {
  label: InsightLabel;
  why: string;
  note: string;
}

export interface RejectedInsight {
  proposal: ProposedInsight;
  reason: string;
}

export interface InsightVerdict {
  accepted: AcceptedInsight[];
  rejected: RejectedInsight[];
}

/**
 * Sifts what the model proposed.
 *
 * The interesting case is a card with exactly one record. It is not thrown
 * away — noticing something once is worth keeping — but it is demoted to
 * 手がかり, because presenting it as a pattern would tell the person something
 * about themselves that one afternoon cannot support.
 */
export function acceptInsights(
  proposals: ProposedInsight[],
  knownLogIds: readonly string[],
  monthAntennas: readonly AntennaId[]
): InsightVerdict {
  const known = new Set(knownLogIds);
  const antennas = new Set(monthAntennas);
  const accepted: AcceptedInsight[] = [];
  const rejected: RejectedInsight[] = [];

  for (const proposal of proposals) {
    const reject = (reason: string) => rejected.push({ proposal, reason });

    if (!proposal.text?.trim()) {
      reject('empty text');
      continue;
    }

    // Evidence must be records that exist, in this month. A model asked for
    // ids will sometimes produce plausible ones.
    const evidence = [...new Set(proposal.evidenceLogIds ?? [])].filter((id) => known.has(id));
    if (evidence.length === 0) {
      reject('no evidence among this period’s records');
      continue;
    }

    if (antennas.size > 0 && !antennas.has(proposal.antennaId)) {
      reject('not one of the アンテナ this month is watching');
      continue;
    }

    const label = INSIGHT_LABELS.includes(proposal.label as InsightLabel)
      ? (proposal.label as InsightLabel)
      : '手がかり';

    accepted.push({
      ...proposal,
      // One record is a 手がかり whatever the model called it.
      label: evidence.length < EVIDENCE_FOR_PATTERN ? '手がかり' : label,
      text: proposal.text.trim(),
      why: proposal.why?.trim() ?? '',
      note: proposal.note?.trim() ?? '',
      evidenceLogIds: evidence,
    });
  }

  // Strongest first, so the four that survive the cut are the best supported.
  accepted.sort((a, b) => b.evidenceLogIds.length - a.evidenceLogIds.length);
  return { accepted: accepted.slice(0, MAX_CARDS), rejected };
}

/**
 * Whether 今の仮説 may be offered at all.
 *
 * Two separate cards, each standing on two or more records. Below that there
 * is a story to tell but nothing to tell it about, and a hypothesis is the one
 * place this product comes closest to saying what someone is like.
 */
export function mayOfferHypothesis(accepted: AcceptedInsight[]): boolean {
  return (
    accepted.filter((card) => card.evidenceLogIds.length >= EVIDENCE_FOR_PATTERN).length >=
    CARDS_FOR_HYPOTHESIS
  );
}

/** Phrasings that assert rather than suggest. A hypothesis may not use them. */
const ASSERTIONS = ['に違いない', '間違いなく', 'はっきりと', '確実に'];
const HEDGES = ['かもしれません', 'かもしれない', 'ように見えます', 'そうです'];

export function hypothesisIsHedged(text: string): boolean {
  if (!HEDGES.some((hedge) => text.includes(hedge))) return false;
  return !ASSERTIONS.some((assertion) => text.includes(assertion));
}

/**
 * Turning what happened into a lesson about it. The month is allowed to have
 * been bad; nothing here is permitted to make it mean something.
 */
export const RESCUE_PHRASES = [
  '成長',
  '学びになりました',
  '意味がありました',
  '無駄ではありません',
  '前向きに',
  '次に活かせ',
] as const;

export interface Verdict {
  ok: boolean;
  problems: string[];
}

/**
 * 月次サマリー: three words, and two sentences that end 「〜月。」
 *
 * The shape is checked because the shape is the restraint. A summary allowed
 * to run long turns into a retelling of the month, and a retelling is where
 * the rewriting creeps in — the bad week that becomes a lesson.
 */
export function checkSummary(keywords: string[], body: string): Verdict {
  const problems: string[] = [];

  if (keywords.length !== SUMMARY_WORDS) {
    problems.push(`keywords: expected ${SUMMARY_WORDS}, got ${keywords.length}`);
  }
  if (keywords.some((k) => k.trim().length === 0)) problems.push('keywords: blank entry');
  if (new Set(keywords).size !== keywords.length) problems.push('keywords: repeated');

  const text = body.trim();
  const length = [...text].length;
  if (length < SUMMARY_MIN_CHARS || length > SUMMARY_MAX_CHARS) {
    problems.push(`body: ${length} characters, expected ${SUMMARY_MIN_CHARS}–${SUMMARY_MAX_CHARS}`);
  }
  if (!text.endsWith('月。')) problems.push('body: does not end 「〜月。」');

  const sentences = text.split('。').filter((s) => s.trim().length > 0);
  if (sentences.length !== 2) problems.push(`body: ${sentences.length} sentences, expected 2`);

  for (const banned of RESCUE_PHRASES) {
    if (text.includes(banned)) problems.push(`body: rescues — 「${banned}」`);
  }

  return { ok: problems.length === 0, problems };
}

/**
 * 足跡タイトル candidates: three, each from a different angle, none a verdict.
 * The three angles themselves are named in PERIOD_TITLE_SYSTEM and stated
 * once, there — a second list here would be a second place to change them.
 */
export const TITLE_COUNT = 3;
const JUDGEMENTS = ['達成', 'ゴール', '目標を', '成功', '失敗した'] as const;

export function checkTitles(titles: string[]): Verdict {
  const problems: string[] = [];
  if (titles.length !== TITLE_COUNT) {
    problems.push(`titles: expected ${TITLE_COUNT}, got ${titles.length}`);
  }
  if (new Set(titles).size !== titles.length) problems.push('titles: repeated');
  for (const title of titles) {
    if (title.trim().length === 0) problems.push('titles: blank');
    // A name for a road walked, not a report card on it.
    for (const banned of JUDGEMENTS) {
      if (title.includes(banned)) problems.push(`titles: judges — 「${banned}」`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/* ------------------------------------------------------------------------ *
 * 先月からの変化 / 去年との違い
 * ------------------------------------------------------------------------ */

export type ChangeKind = 'progression' | 'clarification' | 'continuity';
export const CHANGE_KINDS: readonly ChangeKind[] = [
  'progression',
  'clarification',
  'continuity',
];

/** Below this on either side there is not enough of a period to compare. */
export const CHANGE_MIN_PER_SIDE = 2;
/**
 * How lopsided the two sides may be.
 *
 * This is the rule the whole comparison rests on. One record beside five, and
 * 「増えた」 writes itself — but nothing about the person changed; one of the
 * two months is simply thinner on the page. A reading cannot tell those apart,
 * and neither can the person reading it afterwards, so when the sides are that
 * unequal no comparison is made at all. Three to one is the line: enough room
 * for months that genuinely differ in how much happened, not enough to call
 * a quiet month a change.
 */
export const CHANGE_MAX_IMBALANCE = 3;

/**
 * Counting. A comparison is about what the records say, never about how many
 * there are — and every one of these words is a way of reporting the second
 * thing while sounding like the first.
 */
const COUNTING = [
  '増え',
  '減っ',
  '減り',
  '回数',
  '頻度',
  '件数',
  'より多く',
  'より少な',
  '多くなり',
  '少なくなり',
] as const;

export interface ProposedChange {
  kind: string;
  title: string;
  summary: string;
  previousLogIds: string[];
  currentLogIds: string[];
  note?: string;
}

export interface AcceptedChange extends ProposedChange {
  kind: ChangeKind;
  note: string;
}

export interface ChangeVerdict {
  accepted: AcceptedChange | null;
  problems: string[];
}

/**
 * Whether these two periods may be compared at all — before a model is asked
 * anything.
 *
 * Checked first because the honest answer to a thin period is silence, and
 * asking for a comparison that will have to be thrown away invites a good one
 * to be written for the wrong reasons.
 */
export function sidesAreComparable(previousCount: number, currentCount: number): boolean {
  if (previousCount < CHANGE_MIN_PER_SIDE || currentCount < CHANGE_MIN_PER_SIDE) return false;
  const [few, many] =
    previousCount < currentCount ? [previousCount, currentCount] : [currentCount, previousCount];
  return many <= few * CHANGE_MAX_IMBALANCE;
}

/**
 * Sifts the comparison the model proposed.
 *
 * Unlike 見えてきたこと there is no demotion here: a comparison is either
 * supported or it is not said. Half a comparison — one side quoted, the other
 * asserted — reads exactly like a whole one.
 */
export function acceptChange(
  proposal: ProposedChange,
  previousLogIds: readonly string[],
  currentLogIds: readonly string[]
): ChangeVerdict {
  const problems: string[] = [];
  const previousKnown = new Set(previousLogIds);
  const currentKnown = new Set(currentLogIds);

  if (!sidesAreComparable(previousLogIds.length, currentLogIds.length)) {
    problems.push(
      `sides: ${previousLogIds.length} and ${currentLogIds.length} records — one period is` +
        ' too thin to hold a comparison'
    );
  }

  const kind = CHANGE_KINDS.includes(proposal.kind as ChangeKind)
    ? (proposal.kind as ChangeKind)
    : null;
  if (!kind) problems.push(`kind: 「${proposal.kind}」 is not one of ${CHANGE_KINDS.join(', ')}`);

  const title = (proposal.title ?? '').trim();
  const summary = (proposal.summary ?? '').trim();
  if (title.length === 0) problems.push('title: blank');
  if (summary.length === 0) problems.push('summary: blank');

  const previous = [...new Set(proposal.previousLogIds ?? [])].filter((id) => previousKnown.has(id));
  const current = [...new Set(proposal.currentLogIds ?? [])].filter((id) => currentKnown.has(id));
  if (previous.length === 0) problems.push('evidence: nothing quoted from the earlier period');
  if (current.length === 0) problems.push('evidence: nothing quoted from the later period');

  const words = `${title}${summary}`;
  for (const banned of COUNTING) {
    if (words.includes(banned)) problems.push(`counts rather than reads — 「${banned}」`);
  }
  // A period is allowed to have been what it was. Nothing here turns the
  // earlier one into the worse one.
  for (const banned of RESCUE_PHRASES) {
    if (words.includes(banned)) problems.push(`rescues — 「${banned}」`);
  }

  if (problems.length > 0 || !kind) return { accepted: null, problems };

  return {
    accepted: {
      kind,
      title,
      summary,
      previousLogIds: previous,
      currentLogIds: current,
      note: (proposal.note ?? '').trim(),
    },
    problems: [],
  };
}
