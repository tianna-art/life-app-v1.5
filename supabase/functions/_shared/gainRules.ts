/**
 * Gain rules — the deterministic half of the analysis.
 *
 * SHARED FILE. An identical copy lives at
 * `supabase/functions/_shared/gainRules.ts` because the Edge Function runtime
 * (Deno) cannot reach into `src/`. `__tests__/gainRules.parity.test.ts` fails
 * if the two ever drift, and `npm run sync:gain-rules` copies this one over.
 * Keep it dependency-free and free of `@/` imports for that reason.
 *
 * Why any of this is code rather than prompt: a model asked "has this person
 * learned to present?" will happily say yes after one presentation. Maturity is
 * therefore computed from the evidence that actually exists, and the model's
 * own proposal is only ever allowed to come in at or below that ceiling.
 */

export type GainType =
  | 'capability'
  | 'insight'
  | 'strategy'
  | 'direction'
  | 'connection'
  | 'evidence';

export type GainMaturity = 'signal' | 'attempt' | 'emerging' | 'evidenced' | 'established';

export type GainStatus = 'confirmed' | 'possible' | 'unresolved';

export type JourneyRole =
  | 'attempt'
  | 'setback'
  | 'breakthrough'
  | 'adaptation'
  | 'learning'
  | 'turning_point'
  | 'neutral';

export type EvidenceRelation = 'supports' | 'created' | 'strengthened' | 'contradicts';

export type JourneyRelation =
  | 'same_theme'
  | 'progression'
  | 'contrast'
  | 'adaptation'
  | 'consequence';

export const GAIN_TYPES: readonly GainType[] = [
  'capability',
  'insight',
  'strategy',
  'direction',
  'connection',
  'evidence',
];

export const MATURITY_ORDER: readonly GainMaturity[] = [
  'signal',
  'attempt',
  'emerging',
  'evidenced',
  'established',
];

export const JOURNEY_ROLES: readonly JourneyRole[] = [
  'attempt',
  'setback',
  'breakthrough',
  'adaptation',
  'learning',
  'turning_point',
  'neutral',
];

export const EVIDENCE_RELATIONS: readonly EvidenceRelation[] = [
  'supports',
  'created',
  'strengthened',
  'contradicts',
];

export const JOURNEY_RELATIONS: readonly JourneyRelation[] = [
  'same_theme',
  'progression',
  'contrast',
  'adaptation',
  'consequence',
];

export function maturityRank(maturity: GainMaturity): number {
  const index = MATURITY_ORDER.indexOf(maturity);
  return index === -1 ? 0 : index;
}

export function maxMaturity(a: GainMaturity, b: GainMaturity): GainMaturity {
  return maturityRank(a) >= maturityRank(b) ? a : b;
}

export function minMaturity(a: GainMaturity, b: GainMaturity): GainMaturity {
  return maturityRank(a) <= maturityRank(b) ? a : b;
}

/** What the stored evidence for one gain actually amounts to. */
export interface EvidenceSummary {
  /** Distinct entries standing behind the gain. */
  distinctLogCount: number;
  /** Days between the oldest and newest of them. */
  spanDays: number;
  /**
   * True when at least one piece of evidence marks a difference from before —
   * a `contrast` link, or an entry the model tied to an earlier one as
   * `progression`. Without it, repetition alone never reaches `evidenced`.
   */
  hasContrast: boolean;
  roles: readonly JourneyRole[];
}

const ACTIVE_ROLES: readonly JourneyRole[] = [
  'attempt',
  'breakthrough',
  'adaptation',
  'turning_point',
];

/**
 * The highest maturity the evidence can honestly carry (§3).
 *
 *   1 entry            → signal, or attempt when something was actually tried
 *   2 entries          → emerging (the same direction showed up twice)
 *   4, or 3 + contrast → evidenced (there is a difference from before)
 *   6 over 90+ days    → established
 */
export function maturityCeiling(summary: EvidenceSummary): GainMaturity {
  const n = summary.distinctLogCount;
  if (n >= 6 && summary.spanDays >= 90) return 'established';
  if (n >= 4 || (n >= 3 && summary.hasContrast)) return 'evidenced';
  if (n >= 2) return 'emerging';
  if (n === 1 && summary.roles.some((role) => ACTIVE_ROLES.includes(role))) return 'attempt';
  return 'signal';
}

/** The model may propose anything; it never rises above what the evidence allows. */
export function clampMaturity(proposed: GainMaturity, summary: EvidenceSummary): GainMaturity {
  return minMaturity(proposed, maturityCeiling(summary));
}

/**
 * A single entry can never confirm a gain on its own. `confirmed` means the
 * evidence already existed; a first sighting is at most `possible`.
 */
export function clampStatus(proposed: GainStatus, distinctLogCount: number): GainStatus {
  if (proposed === 'confirmed' && distinctLogCount < 2) return 'possible';
  return proposed;
}

/** Whitespace, width and trailing punctuation folded away; nothing else. */
export function normalizeLabel(label: string): string {
  return label
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/^[「『"'（(\s]+|[」』"'）)。、.,\s]+$/g, '')
    .trim();
}

function bigrams(value: string): string[] {
  const chars = Array.from(normalizeLabel(value).toLowerCase().replace(/\s+/g, ''));
  if (chars.length < 2) return chars;
  const grams: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) grams.push(`${chars[i]}${chars[i + 1]}`);
  return grams;
}

/** Dice coefficient over character bigrams. Language-agnostic, 0..1. */
export function labelSimilarity(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.length === 0 || gb.length === 0) return normalizeLabel(a) === normalizeLabel(b) ? 1 : 0;
  const pool = new Map<string, number>();
  for (const gram of ga) pool.set(gram, (pool.get(gram) ?? 0) + 1);
  let shared = 0;
  for (const gram of gb) {
    const left = pool.get(gram) ?? 0;
    if (left > 0) {
      shared += 1;
      pool.set(gram, left - 1);
    }
  }
  return (2 * shared) / (ga.length + gb.length);
}

/**
 * Surface similarity is only a nomination (§26). Anything at or above this is
 * handed to the model for a meaning check; nothing is merged on the number
 * alone, because "人前で話す" and "人前で緊張する" score high and mean
 * opposite things.
 */
export const CONSOLIDATION_THRESHOLD = 0.62;

export interface ConsolidationCandidate {
  sourceId: string;
  targetId: string;
  similarity: number;
}

/**
 * Pairs worth asking about, within one gain type only. Deterministic order so
 * the same store always nominates the same pairs.
 */
export function nominateConsolidations(
  gains: ReadonlyArray<{ id: string; type: GainType; label: string; evidenceCount: number }>,
  threshold: number = CONSOLIDATION_THRESHOLD
): ConsolidationCandidate[] {
  const out: ConsolidationCandidate[] = [];
  for (let i = 0; i < gains.length; i += 1) {
    for (let j = i + 1; j < gains.length; j += 1) {
      const a = gains[i];
      const b = gains[j];
      if (!a || !b || a.type !== b.type) continue;
      const similarity = labelSimilarity(a.label, b.label);
      if (similarity < threshold) continue;
      // The better-supported gain absorbs the other; ties break on id so the
      // direction never depends on query order.
      const aWins =
        a.evidenceCount > b.evidenceCount ||
        (a.evidenceCount === b.evidenceCount && a.id < b.id);
      out.push({
        sourceId: aWins ? b.id : a.id,
        targetId: aWins ? a.id : b.id,
        similarity,
      });
    }
  }
  return out.sort(
    (x, y) => y.similarity - x.similarity || x.sourceId.localeCompare(y.sourceId)
  );
}

/** Whole days between two ISO timestamps, order-independent. */
export function daysBetween(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round(Math.abs(right - left) / 86_400_000);
}

export function isGainType(value: unknown): value is GainType {
  return typeof value === 'string' && (GAIN_TYPES as readonly string[]).includes(value);
}

export function isGainMaturity(value: unknown): value is GainMaturity {
  return typeof value === 'string' && (MATURITY_ORDER as readonly string[]).includes(value);
}

export function isJourneyRole(value: unknown): value is JourneyRole {
  return typeof value === 'string' && (JOURNEY_ROLES as readonly string[]).includes(value);
}

export function isEvidenceRelation(value: unknown): value is EvidenceRelation {
  return typeof value === 'string' && (EVIDENCE_RELATIONS as readonly string[]).includes(value);
}

export function isJourneyRelation(value: unknown): value is JourneyRelation {
  return typeof value === 'string' && (JOURNEY_RELATIONS as readonly string[]).includes(value);
}

export function isGainStatus(value: unknown): value is GainStatus {
  return value === 'confirmed' || value === 'possible' || value === 'unresolved';
}

/** Raw shape the model is asked for (§10), before any clamping. */
export interface RawGainProposal {
  type: GainType;
  label: string;
  maturity: GainMaturity;
  confidence: number;
  evidence: string;
  /**
   * Set when the model recognised this as one of the gains it was shown, so a
   * second presentation strengthens the existing node instead of growing a
   * near-duplicate beside it. Validated against the ids actually sent.
   */
  existingGainId?: string;
}

export interface RawLogAnalysis {
  eventSummary: string;
  journeyRole: JourneyRole;
  gainStatus: GainStatus;
  gains: RawGainProposal[];
  semanticTags: string[];
  possibleLinks: Array<{
    previousLogId: string;
    relation: JourneyRelation;
    confidence: number;
  }>;
}

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function strings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

/**
 * Defensive parse of the model's JSON. A drifting model must degrade to
 * "nothing could be read here", never to a corrupted gain.
 */
export function parseLogAnalysis(
  raw: unknown,
  knownLogIds: readonly string[] = [],
  knownGainIds: readonly string[] = []
): RawLogAnalysis {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const knownGains = new Set(knownGainIds);
  const gainsRaw = Array.isArray(value.gains) ? value.gains : [];
  const gains: RawGainProposal[] = gainsRaw
    .map((entry): RawGainProposal | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const g = entry as Record<string, unknown>;
      const label = typeof g.label === 'string' ? normalizeLabel(g.label) : '';
      if (!isGainType(g.type) || label.length === 0) return null;
      const existingRaw =
        typeof g.existing_gain_id === 'string'
          ? g.existing_gain_id
          : typeof g.existingGainId === 'string'
            ? g.existingGainId
            : '';
      const existingGainId = knownGains.has(existingRaw) ? existingRaw : undefined;
      return {
        type: g.type,
        label,
        maturity: isGainMaturity(g.maturity) ? g.maturity : 'signal',
        confidence: clamp01(g.confidence, 0.3),
        evidence: typeof g.evidence === 'string' ? g.evidence.trim() : '',
        ...(existingGainId ? { existingGainId } : {}),
      };
    })
    .filter((g): g is RawGainProposal => g !== null)
    // Two gains of the same type and label in one reading are one gain.
    .filter(
      (g, index, list) =>
        list.findIndex((other) => other.type === g.type && other.label === g.label) === index
    )
    .slice(0, 4);

  const known = new Set(knownLogIds);
  const linksRaw = Array.isArray(value.possible_links)
    ? value.possible_links
    : Array.isArray(value.possibleLinks)
      ? value.possibleLinks
      : [];
  const possibleLinks = linksRaw
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) return null;
      const l = entry as Record<string, unknown>;
      const previousLogId =
        typeof l.previous_log_id === 'string'
          ? l.previous_log_id
          : typeof l.previousLogId === 'string'
            ? l.previousLogId
            : '';
      // A link to an entry the model was not shown is a hallucination.
      if (!previousLogId || (known.size > 0 && !known.has(previousLogId))) return null;
      if (!isJourneyRelation(l.relation)) return null;
      return { previousLogId, relation: l.relation, confidence: clamp01(l.confidence, 0.4) };
    })
    .filter((l): l is RawLogAnalysis['possibleLinks'][number] => l !== null)
    .slice(0, 5);

  return {
    eventSummary: typeof value.event_summary === 'string' ? value.event_summary.trim() : '',
    journeyRole: isJourneyRole(value.journey_role) ? value.journey_role : 'neutral',
    gainStatus: isGainStatus(value.gain_status) ? value.gain_status : 'unresolved',
    gains,
    semanticTags: strings(value.semantic_tags ?? value.semanticTags, 8).map((t) =>
      t.toLowerCase().replace(/\s+/g, '_')
    ),
    possibleLinks,
  };
}
