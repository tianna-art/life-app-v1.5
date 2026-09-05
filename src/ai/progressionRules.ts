/**
 * The rules the model does not get to argue with.
 *
 * The model proposes: what happened, what it connects to, which of the ten
 * shapes it is, how far along it has come. This file decides how far any of
 * that is allowed to go. It is plain data and pure functions on purpose — it
 * runs unchanged in the app and inside the Edge Function, and
 * `npm run sync:progression-rules` keeps the two copies byte-identical (a test
 * fails when they drift).
 *
 * Two disciplines live here:
 *
 *   1. A progression is only as settled as the records behind it, and no
 *      prompt can raise that (`maturityCeiling`).
 *   2. A pattern is only that pattern if the records actually show its shape.
 *      §18 names PIVOT explicitly — friction, then a change, then another
 *      attempt — and every one of the ten has an equivalent floor
 *      (`resolvePattern`).
 */

// ---------------------------------------------------------------------------
// Vocabulary (duplicated from src/types on purpose — this file has no imports)
// ---------------------------------------------------------------------------

export type LogType = 'self_action' | 'relationship' | 'thought';

export type MomentTag =
  | 'enjoyed'
  | 'tried'
  | 'first_time'
  | 'friction'
  | 'changed'
  | 'discovered'
  | 'self_decided';

export type ProgressionPattern =
  | 'naming'
  | 'first_act'
  | 'repeat'
  | 'solo'
  | 'pivot'
  | 'expose'
  | 'own_call'
  | 'transfer'
  | 'reframe'
  | 'boundary';

export type ProgressionType =
  | 'capability'
  | 'strategy'
  | 'interest'
  | 'direction'
  | 'relationship'
  | 'perspective';

export type ProgressionMaturity = 'signal' | 'emerging' | 'evidenced' | 'established';

export type ProgressionEvidenceRole =
  | 'origin'
  | 'attempt'
  | 'friction'
  | 'adaptation'
  | 'evidence'
  | 'turning_point'
  | 'current';

export type JourneyRole =
  | 'attempt'
  | 'friction'
  | 'breakthrough'
  | 'adaptation'
  | 'learning'
  | 'turning_point'
  | 'exploration'
  | 'continuation'
  | 'neutral';

export type GainCategory =
  | 'clarity'
  | 'capability'
  | 'method'
  | 'choice'
  | 'evidence'
  | 'connection'
  | 'recovery';

export const LOG_TYPES: readonly LogType[] = ['self_action', 'relationship', 'thought'] as const;

export const MOMENT_TAGS: readonly MomentTag[] = [
  'enjoyed',
  'tried',
  'first_time',
  'friction',
  'changed',
  'discovered',
  'self_decided',
] as const;

export const PROGRESSION_PATTERNS: readonly ProgressionPattern[] = [
  'naming',
  'first_act',
  'repeat',
  'solo',
  'pivot',
  'expose',
  'own_call',
  'transfer',
  'reframe',
  'boundary',
] as const;

export const PROGRESSION_TYPES: readonly ProgressionType[] = [
  'capability',
  'strategy',
  'interest',
  'direction',
  'relationship',
  'perspective',
] as const;

export const MATURITY_ORDER: readonly ProgressionMaturity[] = [
  'signal',
  'emerging',
  'evidenced',
  'established',
] as const;

export const EVIDENCE_ROLES: readonly ProgressionEvidenceRole[] = [
  'origin',
  'attempt',
  'friction',
  'adaptation',
  'evidence',
  'turning_point',
  'current',
] as const;

export const JOURNEY_ROLES: readonly JourneyRole[] = [
  'attempt',
  'friction',
  'breakthrough',
  'adaptation',
  'learning',
  'turning_point',
  'exploration',
  'continuation',
  'neutral',
] as const;

export const GAIN_CATEGORIES: readonly GainCategory[] = [
  'clarity',
  'capability',
  'method',
  'choice',
  'evidence',
  'connection',
  'recovery',
] as const;

/**
 * Where a gain written under the six-category reading belongs now.
 *
 * §32 names seven kinds, and the six that briefly replaced them collapsed two
 * distinctions the spec keeps: what someone can now do, and getting going
 * again after stopping. The mapping back is one-way and lossy — `evidence`
 * absorbed both `capability` and `recovery`, so rows that went that way cannot
 * be told apart again and stay where they are until a reading rewrites them.
 *
 * The three names are still resolved rather than dropped: a category the app
 * no longer knows would silently lose a gain the person was shown once.
 */
const RETIRED_GAIN_CATEGORIES: Record<string, GainCategory> = {
  insight: 'clarity',
  criterion: 'choice',
  option: 'clarity',
};

export function resolveGainCategory(value: unknown): GainCategory | undefined {
  if (typeof value !== 'string') return undefined;
  if (isGainCategory(value)) return value;
  return RETIRED_GAIN_CATEGORIES[value];
}

// ---------------------------------------------------------------------------
// Pattern requirements (§17, §18)
// ---------------------------------------------------------------------------

/**
 * One record, as much of it as a pattern check needs.
 *
 * Level 1 and Level 2 are the person's own evidence (§16), so the checks below
 * run on those rather than on anything the model inferred. That is what makes
 * them a floor: no prompt can talk its way past a tag the person did not tap.
 */
export interface PatternEvidence {
  logId: string;
  logType: LogType;
  momentTags: readonly MomentTag[];
  occurredAt: string;
}

/** One thing that has to appear, in order, for a pattern to be that pattern. */
export interface PatternStage {
  /** Satisfied by any one of these tags. Empty means any tag will do. */
  anyTag?: readonly MomentTag[];
  /** Satisfied only from these doors. Empty means any door will do. */
  anyType?: readonly LogType[];
}

export interface PatternRequirement {
  pattern: ProgressionPattern;
  /** In time order. Each stage must be met by a record later than the last. */
  stages: readonly PatternStage[];
  /** Plain-language shape, for the prompt. */
  shape: string;
}

/**
 * What each of the ten needs before it may be called that.
 *
 * These are floors, not definitions: meeting the shape does not make something
 * a PIVOT, but failing it means it is not one. §18 is explicit for PIVOT —
 * friction, a change, and a retry, all three — and the rest follow the same
 * logic, which is that a change is only visible as a difference between two
 * moments the person actually marked.
 */
export const PATTERN_REQUIREMENTS: readonly PatternRequirement[] = [
  {
    pattern: 'naming',
    // Vague to nameable. Two namings, and the later one is the specific one.
    stages: [{ anyTag: ['discovered'] }, { anyTag: ['discovered'] }],
    shape: '曖昧 → 具体的に言える',
  },
  {
    pattern: 'first_act',
    // Thinking about it, then doing it.
    stages: [{ anyType: ['thought'] }, { anyTag: ['tried', 'first_time'] }],
    shape: '考える → 試す',
  },
  {
    pattern: 'repeat',
    // Once is an attempt; three times is a habit forming.
    stages: [
      { anyTag: ['tried', 'first_time'] },
      { anyTag: ['tried', 'first_time'] },
      { anyTag: ['tried', 'first_time'] },
    ],
    shape: '一度 → 繰り返す',
  },
  {
    pattern: 'solo',
    // Needed someone, then did it themselves.
    stages: [
      { anyType: ['relationship'] },
      { anyType: ['self_action'], anyTag: ['tried', 'first_time'] },
    ],
    shape: '助けが必要 → 自分でもできる',
  },
  {
    pattern: 'pivot',
    // §18 names this one: all three points are required.
    stages: [
      { anyTag: ['friction'] },
      { anyTag: ['changed'] },
      { anyTag: ['tried', 'first_time'] },
    ],
    shape: 'うまくいかない → やり方を変える → 再試行',
  },
  {
    pattern: 'expose',
    // Kept in, then shown to someone.
    stages: [{ anyType: ['self_action', 'thought'] }, { anyType: ['relationship'] }],
    shape: '自分の内側 → 身近な人 → 外部',
  },
  {
    pattern: 'own_call',
    stages: [{ anyTag: ['self_decided'] }, { anyTag: ['self_decided'] }],
    shape: '他人基準 → 自分で決める',
  },
  {
    pattern: 'transfer',
    // A method found once, used again later. Whether the second use is a
    // different situation is the model's call; that it was used twice is not.
    stages: [{ anyTag: ['changed'] }, { anyTag: ['tried', 'first_time', 'changed'] }],
    shape: 'ある場面の方法 → 別の場面でも使う',
  },
  {
    pattern: 'reframe',
    // Stuck on it, then saw it differently.
    stages: [{ anyTag: ['friction'] }, { anyTag: ['discovered'] }],
    shape: '問題Aだと思っていた → 別の捉え方',
  },
  {
    pattern: 'boundary',
    // Put up with it, then drew a line.
    stages: [{ anyTag: ['friction'] }, { anyTag: ['self_decided'] }],
    shape: '受け入れる → 条件をつける / 断る',
  },
] as const;

const REQUIREMENT_BY_PATTERN = new Map(PATTERN_REQUIREMENTS.map((r) => [r.pattern, r]));

function stageMet(stage: PatternStage, record: PatternEvidence): boolean {
  if (stage.anyType && stage.anyType.length > 0 && !stage.anyType.includes(record.logType)) {
    return false;
  }
  if (stage.anyTag && stage.anyTag.length > 0) {
    return stage.anyTag.some((tag) => record.momentTags.includes(tag));
  }
  return true;
}

/**
 * Whether the records show this pattern's shape, in order.
 *
 * Greedy and strictly forward: each stage consumes a record later than the one
 * before it, so "friction, then a change, then a retry" cannot be satisfied by
 * a retry that happened first. Two stages may not share a record — a single
 * afternoon tagged both `friction` and `changed` is one moment, not a
 * movement.
 */
export function patternSatisfied(
  pattern: ProgressionPattern,
  evidence: readonly PatternEvidence[]
): boolean {
  const requirement = REQUIREMENT_BY_PATTERN.get(pattern);
  if (!requirement) return false;

  const ordered = [...evidence].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  let index = 0;
  for (const stage of requirement.stages) {
    while (index < ordered.length && !stageMet(stage, ordered[index] as PatternEvidence)) {
      index += 1;
    }
    if (index >= ordered.length) return false;
    index += 1;
  }
  return true;
}

/**
 * The pattern this evidence can carry.
 *
 * A pattern the records do not show is dropped rather than downgraded to a
 * near neighbour: guessing a different one would be the same overclaim wearing
 * another name. The progression survives without a pattern, which only costs
 * it detection priority.
 */
export function resolvePattern(
  proposed: ProgressionPattern | undefined,
  evidence: readonly PatternEvidence[]
): ProgressionPattern | undefined {
  if (!proposed) return undefined;
  return patternSatisfied(proposed, evidence) ? proposed : undefined;
}

/** Every pattern this evidence actually shows. Used to rank, never to label. */
export function satisfiedPatterns(
  evidence: readonly PatternEvidence[]
): ProgressionPattern[] {
  return PROGRESSION_PATTERNS.filter((p) => patternSatisfied(p, evidence));
}

// ---------------------------------------------------------------------------
// Maturity
// ---------------------------------------------------------------------------

export function maturityRank(maturity: ProgressionMaturity): number {
  const index = MATURITY_ORDER.indexOf(maturity);
  return index === -1 ? 0 : index;
}

export function maxMaturity(a: ProgressionMaturity, b: ProgressionMaturity): ProgressionMaturity {
  return maturityRank(a) >= maturityRank(b) ? a : b;
}

export function minMaturity(a: ProgressionMaturity, b: ProgressionMaturity): ProgressionMaturity {
  return maturityRank(a) <= maturityRank(b) ? a : b;
}

/** What the stored evidence for one progression actually amounts to. */
export interface EvidenceSummary {
  distinctLogCount: number;
  distinctMonthCount: number;
  spanDays: number;
  /**
   * True when the path holds a record from before and a record from after.
   * Without this there is a theme, not a movement.
   */
  hasBeforeAndAfter: boolean;
  distinctRoleCount: number;
}

/** The minimum a progression needs to exist at all (§18, §31). */
export const MIN_EVIDENCE_FOR_PROGRESSION = 2;

/** Beyond this, repetition across time separates settled from merely recent. */
export const ESTABLISHED_MIN_SPAN_DAYS = 45;

/**
 * The highest rung this evidence can hold up.
 *
 * Read it downwards: without two records there is no movement to speak of;
 * with two records that say the same thing there is a signal; a difference
 * between before and after is what `evidenced` means; and `established` is not
 * a stronger claim about one moment but the same movement seen again across
 * months.
 */
export function maturityCeiling(summary: EvidenceSummary): ProgressionMaturity {
  if (summary.distinctLogCount < MIN_EVIDENCE_FOR_PROGRESSION) return 'signal';

  const settled =
    summary.hasBeforeAndAfter &&
    summary.distinctRoleCount >= 3 &&
    summary.distinctLogCount >= 4 &&
    summary.distinctMonthCount >= 2 &&
    summary.spanDays >= ESTABLISHED_MIN_SPAN_DAYS;
  if (settled) return 'established';

  if (summary.hasBeforeAndAfter && summary.distinctLogCount >= 3) return 'evidenced';
  if (summary.distinctLogCount >= 3 || summary.distinctMonthCount >= 2) return 'emerging';
  return 'signal';
}

export function clampMaturity(
  proposed: ProgressionMaturity,
  summary: EvidenceSummary
): ProgressionMaturity {
  return minMaturity(proposed, maturityCeiling(summary));
}

/** One record is a dot. §31 is explicit that day one gets a dot. */
export function qualifiesAsProgression(summary: EvidenceSummary): boolean {
  return summary.distinctLogCount >= MIN_EVIDENCE_FOR_PROGRESSION;
}

export function summariseEvidencePath(
  path: readonly { logId: string; role: ProgressionEvidenceRole; occurredAt: string }[]
): EvidenceSummary {
  const logIds = new Set(path.map((p) => p.logId));
  const months = new Set(path.map((p) => p.occurredAt.slice(0, 7)));
  const roles = new Set(path.map((p) => p.role));

  const times = path
    .map((p) => Date.parse(p.occurredAt))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const spanDays =
    times.length >= 2
      ? Math.round(((times[times.length - 1] as number) - (times[0] as number)) / 86_400_000)
      : 0;

  const EARLY: readonly ProgressionEvidenceRole[] = ['origin', 'attempt', 'friction'];
  const LATE: readonly ProgressionEvidenceRole[] = [
    'adaptation',
    'turning_point',
    'current',
    'evidence',
  ];
  const sorted = [...path].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const firstLateIndex = sorted.findIndex((p) => LATE.includes(p.role));
  const hasBeforeAndAfter =
    firstLateIndex > 0 && sorted.slice(0, firstLateIndex).some((p) => EARLY.includes(p.role));

  return {
    distinctLogCount: logIds.size,
    distinctMonthCount: months.size,
    spanDays,
    hasBeforeAndAfter,
    distinctRoleCount: roles.size,
  };
}

// ---------------------------------------------------------------------------
// Wording bound to maturity (§30)
// ---------------------------------------------------------------------------

/**
 * How confidently the app is allowed to speak at each rung.
 *
 * Not decoration: this is the guard against 「あなたは成長しました」 appearing
 * under two records. Every line reports what the records say and stops there.
 */
export const MATURITY_PHRASING: Record<ProgressionMaturity, string> = {
  signal: '{title}という記録が、いくつか現れています。',
  emerging: '最近、{title}にまつわる記録が増えています。',
  evidenced: '以前の記録とくらべて、{title}が変わってきています。',
  established: 'この期間を通して、{title}の変化が繰り返し確認されています。',
};

export function phraseForMaturity(maturity: ProgressionMaturity, title: string): string {
  return (MATURITY_PHRASING[maturity] ?? MATURITY_PHRASING.signal).replace('{title}', title);
}

// ---------------------------------------------------------------------------
// Titles and consolidation
// ---------------------------------------------------------------------------

/**
 * Whitespace, width and trailing punctuation folded away; nothing else.
 *
 * Trimming happens before the punctuation is stripped as well as after, or a
 * title ending "。 " keeps its full stop and stops matching the same title
 * without one — quietly creating a duplicate progression.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[。．.、,・!！?？]+$/u, '')
    .trim();
}

/** Dice coefficient over character bigrams. Language-agnostic, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (left.length === 0 || right.length === 0) return 0;
  if (left === right) return 1;

  const bigrams = (s: string): Map<string, number> => {
    const out = new Map<string, number>();
    if (s.length === 1) {
      out.set(s, 1);
      return out;
    }
    for (let i = 0; i < s.length - 1; i += 1) {
      const key = s.slice(i, i + 2);
      out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
  };

  const first = bigrams(left);
  const second = bigrams(right);
  let shared = 0;
  for (const [key, count] of first) {
    const other = second.get(key);
    if (other) shared += Math.min(count, other);
  }
  const total =
    [...first.values()].reduce((a2, b2) => a2 + b2, 0) +
    [...second.values()].reduce((a2, b2) => a2 + b2, 0);
  return total === 0 ? 0 : (2 * shared) / total;
}

export const CONSOLIDATION_THRESHOLD = 0.62;

export interface ConsolidationCandidate {
  sourceId: string;
  targetId: string;
  similarity: number;
}

/**
 * Surface similarity only nominates a pair.
 *
 * Closeness is never enough to fold two progressions together — the model has
 * to agree they are the same movement — and one the person has edited is
 * theirs and is left alone. The better-supported one absorbs the other.
 */
export function nominateConsolidations(
  progressions: readonly {
    id: string;
    type: ProgressionType;
    title: string;
    evidenceCount: number;
    userEdited?: boolean;
  }[]
): ConsolidationCandidate[] {
  const out: ConsolidationCandidate[] = [];

  for (let i = 0; i < progressions.length; i += 1) {
    for (let j = i + 1; j < progressions.length; j += 1) {
      const a = progressions[i] as (typeof progressions)[number];
      const b = progressions[j] as (typeof progressions)[number];
      if (a.type !== b.type) continue;
      if (a.userEdited || b.userEdited) continue;

      const similarity = titleSimilarity(a.title, b.title);
      if (similarity < CONSOLIDATION_THRESHOLD) continue;

      const aWins =
        a.evidenceCount > b.evidenceCount ||
        (a.evidenceCount === b.evidenceCount &&
          normalizeTitle(a.title).length <= normalizeTitle(b.title).length);
      out.push({
        sourceId: aWins ? b.id : a.id,
        targetId: aWins ? a.id : b.id,
        similarity,
      });
    }
  }

  return out.sort((a, b) => b.similarity - a.similarity);
}

export function daysBetween(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round(Math.abs(right - left) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export function isLogType(value: unknown): value is LogType {
  return typeof value === 'string' && (LOG_TYPES as readonly string[]).includes(value);
}

export function isMomentTag(value: unknown): value is MomentTag {
  return typeof value === 'string' && (MOMENT_TAGS as readonly string[]).includes(value);
}

export function isProgressionPattern(value: unknown): value is ProgressionPattern {
  return typeof value === 'string' && (PROGRESSION_PATTERNS as readonly string[]).includes(value);
}

export function isProgressionType(value: unknown): value is ProgressionType {
  return typeof value === 'string' && (PROGRESSION_TYPES as readonly string[]).includes(value);
}

export function isProgressionMaturity(value: unknown): value is ProgressionMaturity {
  return typeof value === 'string' && (MATURITY_ORDER as readonly string[]).includes(value);
}

export function isEvidenceRole(value: unknown): value is ProgressionEvidenceRole {
  return typeof value === 'string' && (EVIDENCE_ROLES as readonly string[]).includes(value);
}

export function isJourneyRole(value: unknown): value is JourneyRole {
  return typeof value === 'string' && (JOURNEY_ROLES as readonly string[]).includes(value);
}

export function isGainCategory(value: unknown): value is GainCategory {
  return typeof value === 'string' && (GAIN_CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// STAGE 1 — parsing one record's reading (§16)
// ---------------------------------------------------------------------------

export interface RawLogAnalysis {
  eventSummary: string;
  themes: string[];
  people: string[];
  action?: string | undefined;
  outcome?: string | undefined;
  friction?: string | undefined;
  discovery?: string | undefined;
  adaptation?: string | undefined;
  choice?: string | undefined;
  environment?: string | undefined;
  interestSignal?: string | undefined;
  journeyRole?: JourneyRole | undefined;
  confidence: number;
}

/** Below this the model is not sure enough to name a role at all. */
export const ROLE_CONFIDENCE_FLOOR = 0.35;

const MAX_LIST = 6;
const MAX_PHRASE = 60;

function readStringList(value: unknown, limit = MAX_LIST): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const cleaned = item.normalize('NFKC').trim().slice(0, MAX_PHRASE);
    if (cleaned.length === 0 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}

function readOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : undefined;
}

function readConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Turns the model's JSON into something storable.
 *
 * Level 1 and Level 2 are absent here on purpose: they are the person's own
 * evidence and the caller keeps them (§16). Everything the model says is
 * inference, and a low-confidence reading loses its role rather than keeping
 * a shaky one.
 */
export function parseLogAnalysis(raw: unknown, fallbackSummary: string): RawLogAnalysis {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const confidence = readConfidence(value.confidence);

  const proposedRole = isJourneyRole(value.journey_role) ? value.journey_role : undefined;
  const journeyRole = confidence >= ROLE_CONFIDENCE_FLOOR ? proposedRole : undefined;

  return {
    eventSummary: readOptional(value.event_summary) ?? fallbackSummary.slice(0, 80),
    themes: readStringList(value.themes),
    people: readStringList(value.people, 4),
    action: readOptional(value.action),
    outcome: readOptional(value.outcome),
    friction: readOptional(value.friction),
    discovery: readOptional(value.discovery),
    adaptation: readOptional(value.adaptation),
    choice: readOptional(value.choice),
    environment: readOptional(value.environment),
    interestSignal: readOptional(value.interest_signal),
    journeyRole,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// STAGE 2 — parsing the cross-time reading (§17-§19)
// ---------------------------------------------------------------------------

export type ProgressionAction = 'create' | 'update' | 'unchanged';

export interface RawProgressionProposal {
  action: ProgressionAction;
  progressionId?: string | undefined;
  type: ProgressionType;
  /** Checked against the evidence before it is stored. */
  pattern?: ProgressionPattern | undefined;
  title: string;
  fromState?: string | undefined;
  currentState?: string | undefined;
  summary: string;
  maturity: ProgressionMaturity;
  confidence: number;
  /** True when the model says this grew outside the year's direction (§19). */
  goalExternal: boolean;
  evidence: { logId: string; role: ProgressionEvidenceRole }[];
  /** What remains, if anything does (§20, §21). Usually absent. */
  gain?: { category: GainCategory; label: string; description?: string | undefined } | undefined;
}

const MAX_PROPOSALS = 3;
const MAX_TITLE = 24;

/**
 * Parses STAGE 2's answer.
 *
 * `allowedLogIds` is the retrieval window plus the record being read: the
 * model may only cite records it was shown, so it cannot invent a history to
 * justify a trajectory.
 */
export function parseCrossTimeReading(
  raw: unknown,
  allowedLogIds: readonly string[],
  existingProgressionIds: readonly string[]
): RawProgressionProposal[] {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const allowed = new Set(allowedLogIds);
  const known = new Set(existingProgressionIds);

  const proposals: RawProgressionProposal[] = [];
  const rawProposals = Array.isArray(value.progressions) ? value.progressions : [];

  for (const item of rawProposals) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;

    if (!isProgressionType(p.type)) continue;
    const title = normalizeTitle(typeof p.title === 'string' ? p.title : '').slice(0, MAX_TITLE);
    if (title.length === 0) continue;

    const action: ProgressionAction =
      p.action === 'update' || p.action === 'unchanged' ? p.action : 'create';
    const progressionId = typeof p.progression_id === 'string' ? p.progression_id : undefined;
    const resolvedAction =
      action !== 'create' && (!progressionId || !known.has(progressionId)) ? 'create' : action;

    const evidence: RawProgressionProposal['evidence'] = [];
    const seenLogs = new Set<string>();
    if (Array.isArray(p.evidence)) {
      for (const e of p.evidence) {
        if (typeof e !== 'object' || e === null) continue;
        const row = e as Record<string, unknown>;
        const logId = typeof row.log_id === 'string' ? row.log_id : '';
        if (!allowed.has(logId) || seenLogs.has(logId)) continue;
        seenLogs.add(logId);
        evidence.push({ logId, role: isEvidenceRole(row.role) ? row.role : 'evidence' });
      }
    }

    const rawGain = (p.gain ?? undefined) as Record<string, unknown> | undefined;
    const gainLabel = readOptional(rawGain?.label);
    // A gain with no category is not storable, and guessing one would put a
    // word in the person's mouth about what kind of thing they now have.
    const gainCategory = isGainCategory(rawGain?.category) ? rawGain.category : undefined;

    proposals.push({
      action: resolvedAction,
      ...(resolvedAction === 'update' && progressionId ? { progressionId } : {}),
      type: p.type,
      pattern: isProgressionPattern(p.pattern) ? p.pattern : undefined,
      title,
      fromState: readOptional(p.from_state),
      currentState: readOptional(p.current_state),
      summary: readOptional(p.summary) ?? '',
      maturity: isProgressionMaturity(p.maturity) ? p.maturity : 'signal',
      confidence: readConfidence(p.confidence),
      goalExternal: p.goal_external === true,
      evidence,
      ...(gainLabel && gainCategory
        ? {
            gain: {
              category: gainCategory,
              label: gainLabel,
              description: readOptional(rawGain?.description),
            },
          }
        : {}),
    });

    if (proposals.length >= MAX_PROPOSALS) break;
  }

  return proposals;
}
