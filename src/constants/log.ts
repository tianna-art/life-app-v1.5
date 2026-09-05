import type { LogType, MomentTag } from '@/types';

/**
 * Level 1 (§9).
 *
 * Where the record is being left from, not what kind of information it is. The
 * three overlap on purpose: a conversation that changed someone's mind could
 * go in any of them, and whichever door they pick is itself a small piece of
 * evidence about what the moment was to them.
 */
export interface LogTypeDef {
  id: LogType;
  label: string;
  /** What belongs here. Used for the accessibility hint and the prompt. */
  covers: readonly string[];
}

export const LOG_TYPES: readonly LogTypeDef[] = [
  {
    id: 'self_action',
    label: '自分の行動',
    covers: ['試した', '作った', '行った', '応募した', '断った', '話した'],
  },
  {
    id: 'relationship',
    label: '人との関わり',
    covers: ['会話', '出会い', '共同作業', '助けてもらった', '相談した', '衝突した'],
  },
  {
    id: 'thought',
    label: 'つぶやき',
    covers: ['気づき', '考え', '違和感', '興味', 'まだ言葉にならない思考'],
  },
] as const;

/**
 * Level 2 (§10).
 *
 * Seven, and more than one may be true at once. Each carries an internal
 * reading that STAGE 2 matches on; none of them is a verdict.
 *
 * The two that are easiest to get wrong are noted where they are defined:
 * `enjoyed` is not "progress", and `friction` is not "growth". Both only
 * become evidence of a direction when they repeat (§10).
 */
export interface MomentTagDef {
  id: MomentTag;
  label: string;
  /** Internal signals. Never shown. */
  signals: readonly string[];
}

export const MOMENT_TAGS: readonly MomentTagDef[] = [
  {
    id: 'enjoyed',
    label: '楽しかった',
    // Not treated as forward motion. Repetition is what makes it a direction.
    signals: ['discovery', 'interest', 'direction_candidate', 'energy'],
  },
  {
    id: 'tried',
    label: 'やってみた',
    signals: ['first_act', 'action', 'evidence'],
  },
  {
    id: 'first_time',
    label: '初めて',
    signals: ['first_act', 'expansion', 'capability', 'evidence'],
  },
  {
    id: 'friction',
    label: 'モヤモヤ',
    // Never converted into growth on its own. What follows it is the evidence.
    signals: ['friction', 'setback_candidate', 'clarity_candidate', 'boundary_candidate'],
  },
  {
    id: 'changed',
    label: '変えてみた',
    signals: ['pivot', 'adaptation', 'method'],
  },
  {
    id: 'discovered',
    label: '発見した',
    signals: ['naming', 'clarity', 'reframe_candidate'],
  },
  {
    id: 'self_decided',
    label: '自分で決めた',
    signals: ['own_call', 'choice', 'boundary'],
  },
] as const;

const TYPE_BY_ID = new Map(LOG_TYPES.map((t) => [t.id, t]));
const TAG_BY_ID = new Map(MOMENT_TAGS.map((t) => [t.id, t]));

export function logTypeLabel(id: LogType): string {
  return TYPE_BY_ID.get(id)?.label ?? '';
}

export function momentTagLabel(id: MomentTag): string {
  return TAG_BY_ID.get(id)?.label ?? '';
}

export function isLogType(value: unknown): value is LogType {
  return typeof value === 'string' && TYPE_BY_ID.has(value as LogType);
}

export function isMomentTag(value: unknown): value is MomentTag {
  return typeof value === 'string' && TAG_BY_ID.has(value as MomentTag);
}

/** The internal readings behind a set of tags, for the prompts. */
export function signalsForTags(tags: readonly MomentTag[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) for (const s of TAG_BY_ID.get(tag)?.signals ?? []) out.add(s);
  return [...out];
}

/** v3 records carried a drawer rather than a door. */
export function logTypeForLegacy(value: string | null | undefined): LogType {
  if (value === 'thought' || value === 'relationship' || value === 'self_action') return value;
  // 'event' was "something that happened", which is what self_action means now.
  return 'self_action';
}
