/**
 * The rules the model does not get to argue with.
 *
 * The model proposes: what happened, what it connects to, how far along the
 * movement is. This file decides how far any of that is allowed to go. It is
 * plain data and pure functions on purpose — it runs unchanged in the app and
 * inside the Edge Function, and `npm run sync:progression-rules` keeps the two
 * copies byte-identical (a test fails when they drift).
 *
 * The discipline it enforces, in one line: a progression is only as settled as
 * the records behind it, and no prompt can raise that.
 */

// ---------------------------------------------------------------------------
// Vocabulary (duplicated from src/types on purpose — this file has no imports)
// ---------------------------------------------------------------------------

export type EntryType = 'event' | 'thought';

export type SubjectiveSignal = 'positive' | 'mixed' | 'negative';

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
  | 'setback'
  | 'adaptation'
  | 'evidence'
  | 'turning_point'
  | 'current';

export type JourneyRole =
  | 'attempt'
  | 'setback'
  | 'breakthrough'
  | 'adaptation'
  | 'learning'
  | 'turning_point'
  | 'exploration'
  | 'continuation'
  | 'neutral';

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

export const JOURNEY_ROLES: readonly JourneyRole[] = [
  'attempt',
  'setback',
  'breakthrough',
  'adaptation',
  'learning',
  'turning_point',
  'exploration',
  'continuation',
  'neutral',
] as const;

export const EVIDENCE_ROLES: readonly ProgressionEvidenceRole[] = [
  'origin',
  'attempt',
  'setback',
  'adaptation',
  'evidence',
  'turning_point',
  'current',
] as const;

export const ENTRY_TYPES: readonly EntryType[] = ['event', 'thought'] as const;

export const SUBJECTIVE_SIGNALS: readonly SubjectiveSignal[] = [
  'positive',
  'mixed',
  'negative',
] as const;

// ---------------------------------------------------------------------------
// Maturity
// ---------------------------------------------------------------------------

export function maturityRank(maturity: ProgressionMaturity): number {
  const index = MATURITY_ORDER.indexOf(maturity);
  return index === -1 ? 0 : index;
}

export function maxMaturity(
  a: ProgressionMaturity,
  b: ProgressionMaturity
): ProgressionMaturity {
  return maturityRank(a) >= maturityRank(b) ? a : b;
}

export function minMaturity(
  a: ProgressionMaturity,
  b: ProgressionMaturity
): ProgressionMaturity {
  return maturityRank(a) <= maturityRank(b) ? a : b;
}

/** What the stored evidence for one progression actually amounts to. */
export interface EvidenceSummary {
  /** Distinct records standing behind it. */
  distinctLogCount: number;
  /** Distinct calendar months those records fall in. */
  distinctMonthCount: number;
  /** Whole days from the earliest record to the latest. */
  spanDays: number;
  /**
   * True when the path holds a record from before and a record from after —
   * an `origin` and something later, or a `setback`/`attempt` followed by an
   * `adaptation`/`turning_point`/`current`. Without this there is a theme,
   * not a movement.
   */
  hasBeforeAndAfter: boolean;
  /** Distinct evidence roles on the path. One role is one state, not a change. */
  distinctRoleCount: number;
}

/** The minimum a progression needs to exist at all (§9, §31). */
export const MIN_EVIDENCE_FOR_PROGRESSION = 2;

/** Beyond this, repetition across time is what separates settled from recent. */
export const ESTABLISHED_MIN_SPAN_DAYS = 45;

/**
 * The highest rung this evidence can hold up (§12).
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

/** The model may propose anything; it never rises above what the evidence allows. */
export function clampMaturity(
  proposed: ProgressionMaturity,
  summary: EvidenceSummary
): ProgressionMaturity {
  return minMaturity(proposed, maturityCeiling(summary));
}

/**
 * Whether this evidence supports a progression at all.
 *
 * One record is a dot. §31 is explicit that day one gets a dot and not a
 * fabricated trajectory.
 */
export function qualifiesAsProgression(summary: EvidenceSummary): boolean {
  return summary.distinctLogCount >= MIN_EVIDENCE_FOR_PROGRESSION;
}

/**
 * Builds the summary from a path of evidence rows.
 *
 * Exported because both the Edge Function and the offline path need the same
 * arithmetic, and because it is the one place that decides what "before and
 * after" means.
 */
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

  const EARLY: readonly ProgressionEvidenceRole[] = ['origin', 'attempt', 'setback'];
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
// Wording bound to maturity (§12)
// ---------------------------------------------------------------------------

/**
 * How confidently the app is allowed to speak at each rung.
 *
 * `{title}` is the progression's own title. These are not decoration: they are
 * the guard against "あなたは変わりました" appearing under a single record.
 */
export const MATURITY_PHRASING: Record<ProgressionMaturity, string> = {
  signal: '{title}という兆しがあります。',
  emerging: '最近、{title}にまつわる記録が増えています。',
  evidenced: '以前とくらべて、{title}が変わってきています。',
  established: 'この期間を通して、{title}の変化が繰り返し確認されています。',
};

export function phraseForMaturity(maturity: ProgressionMaturity, title: string): string {
  return (MATURITY_PHRASING[maturity] ?? MATURITY_PHRASING.signal).replace('{title}', title);
}

// ---------------------------------------------------------------------------
// Titles and consolidation (§30)
// ---------------------------------------------------------------------------

/**
 * Whitespace, width and trailing punctuation folded away; nothing else.
 *
 * Trimming has to happen before the punctuation is stripped as well as after,
 * or a title that ends "。 " keeps its full stop and stops matching the same
 * title without one — which would quietly create a duplicate progression.
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

/**
 * Surface similarity only nominates a pair (§30).
 *
 * Embedding or bigram closeness is never enough to fold two progressions
 * together — the model has to agree they are the same movement, and a
 * progression the person has edited is theirs and is left alone. The one the
 * evidence stands behind absorbs the other.
 */
export const CONSOLIDATION_THRESHOLD = 0.62;

export interface ConsolidationCandidate {
  sourceId: string;
  targetId: string;
  similarity: number;
}

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
      // The person's own wording is not a duplicate of anything.
      if (a.userEdited || b.userEdited) continue;

      const similarity = titleSimilarity(a.title, b.title);
      if (similarity < CONSOLIDATION_THRESHOLD) continue;

      // The better-supported one keeps its identity; ties break on title
      // length so the shorter, more general wording survives.
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

/** Whole days between two ISO timestamps, order-independent. */
export function daysBetween(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round(Math.abs(right - left) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export function isProgressionType(value: unknown): value is ProgressionType {
  return typeof value === 'string' && (PROGRESSION_TYPES as readonly string[]).includes(value);
}

export function isProgressionMaturity(value: unknown): value is ProgressionMaturity {
  return typeof value === 'string' && (MATURITY_ORDER as readonly string[]).includes(value);
}

export function isJourneyRole(value: unknown): value is JourneyRole {
  return typeof value === 'string' && (JOURNEY_ROLES as readonly string[]).includes(value);
}

export function isEvidenceRole(value: unknown): value is ProgressionEvidenceRole {
  return typeof value === 'string' && (EVIDENCE_ROLES as readonly string[]).includes(value);
}

export function isEntryType(value: unknown): value is EntryType {
  return typeof value === 'string' && (ENTRY_TYPES as readonly string[]).includes(value);
}

export function isSubjectiveSignal(value: unknown): value is SubjectiveSignal {
  return typeof value === 'string' && (SUBJECTIVE_SIGNALS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// STAGE 1 — parsing one entry's reading (§6)
// ---------------------------------------------------------------------------

export type RawSignals = Record<ProgressionType, string[]>;

export interface RawEntryAnalysis {
  eventSummary: string;
  topics: string[];
  actors: string[];
  environment: string[];
  action?: string | undefined;
  outcome?: string | undefined;
  reaction?: string | undefined;
  hypothesis?: string | undefined;
  futureIntention?: string | undefined;
  journeyRole: JourneyRole;
  signals: RawSignals;
  confidence: number;
}

/** Below this the model is not sure enough to name a role (§7). */
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

export function emptySignals(): RawSignals {
  return {
    capability: [],
    strategy: [],
    interest: [],
    direction: [],
    relationship: [],
    perspective: [],
  };
}

function readSignals(value: unknown): RawSignals {
  const out = emptySignals();
  if (typeof value !== 'object' || value === null) return out;
  const source = value as Record<string, unknown>;
  for (const type of PROGRESSION_TYPES) {
    out[type] = readStringList(source[type], 4);
  }
  return out;
}

/**
 * Turns the model's JSON into something storable.
 *
 * Everything unrecognised is dropped rather than guessed at, and a reading the
 * model is not confident about loses its role rather than keeping a shaky one:
 * "went to an exhibition" must not become "a turning point".
 */
export function parseEntryAnalysis(raw: unknown, fallbackSummary: string): RawEntryAnalysis {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const confidence = readConfidence(value.confidence);

  const proposedRole = isJourneyRole(value.journey_role) ? value.journey_role : 'neutral';
  const journeyRole = confidence >= ROLE_CONFIDENCE_FLOOR ? proposedRole : 'neutral';

  const summary = readOptional(value.event_summary) ?? fallbackSummary.slice(0, 120);

  return {
    eventSummary: summary,
    topics: readStringList(value.topics),
    actors: readStringList(value.actors),
    environment: readStringList(value.environment),
    action: readOptional(value.action),
    outcome: readOptional(value.outcome),
    reaction: readOptional(value.reaction),
    hypothesis: readOptional(value.hypothesis),
    futureIntention: readOptional(value.future_intention),
    journeyRole,
    signals: readSignals(value.signals),
    confidence,
  };
}

// ---------------------------------------------------------------------------
// STAGE 2 — parsing the cross-time reading (§8, §29)
// ---------------------------------------------------------------------------

export type ProgressionAction = 'create' | 'update' | 'unchanged';

export interface RawProgressionProposal {
  action: ProgressionAction;
  /** Present when action is `update`. */
  progressionId?: string | undefined;
  type: ProgressionType;
  title: string;
  fromState?: string | undefined;
  currentState?: string | undefined;
  summary: string;
  /** What the model thinks; clamped later against the evidence. */
  maturity: ProgressionMaturity;
  confidence: number;
  /** Earlier records this movement rests on, with the part each one plays. */
  evidence: { logId: string; role: ProgressionEvidenceRole }[];
  /** What remains, if anything has (§22). Usually absent. */
  gain?: { label: string; description?: string | undefined } | undefined;
}

export interface RawCrossTimeReading {
  proposals: RawProgressionProposal[];
  /** At most one, and only when it would change the answer (§14). */
  clarification?: { question: string; options: string[] } | undefined;
}

const MAX_PROPOSALS = 3;
const MAX_TITLE = 24;

/**
 * Parses STAGE 2's answer.
 *
 * `allowedLogIds` is the retrieval window plus the entry being read: the model
 * may only cite records it was actually shown, so it cannot invent a history
 * to justify a trajectory.
 */
export function parseCrossTimeReading(
  raw: unknown,
  allowedLogIds: readonly string[],
  existingProgressionIds: readonly string[]
): RawCrossTimeReading {
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
    // An update that names a progression we did not show it is a new one.
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
        evidence.push({
          logId,
          role: isEvidenceRole(row.role) ? row.role : 'evidence',
        });
      }
    }

    const gainLabel = readOptional((p.gain as Record<string, unknown> | undefined)?.label);

    proposals.push({
      action: resolvedAction,
      ...(resolvedAction === 'update' && progressionId ? { progressionId } : {}),
      type: p.type,
      title,
      fromState: readOptional(p.from_state),
      currentState: readOptional(p.current_state),
      summary: readOptional(p.summary) ?? '',
      maturity: isProgressionMaturity(p.maturity) ? p.maturity : 'signal',
      confidence: readConfidence(p.confidence),
      evidence,
      ...(gainLabel
        ? {
            gain: {
              label: gainLabel,
              description: readOptional((p.gain as Record<string, unknown>).description),
            },
          }
        : {}),
    });

    if (proposals.length >= MAX_PROPOSALS) break;
  }

  // §14: at most one question, and only with real options to choose between.
  let clarification: RawCrossTimeReading['clarification'];
  const rawClarification = value.clarification;
  if (typeof rawClarification === 'object' && rawClarification !== null) {
    const c = rawClarification as Record<string, unknown>;
    const question = readOptional(c.question);
    const options = readStringList(c.options, 3);
    if (question && options.length >= 2) clarification = { question, options };
  }

  return { proposals, ...(clarification ? { clarification } : {}) };
}
