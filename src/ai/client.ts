/**
 * Client side of the analysis pipeline.
 *
 * The app never talks to an LLM directly and holds no provider key: the call
 * goes to a Supabase Edge Function running with the service role, which is the
 * only place the key exists. When that is unreachable — or the project has no
 * Supabase configuration at all — the local, model-free path runs instead and
 * the person still keeps their record.
 *
 * The two stages of §29 are one round trip from here. Splitting them across
 * the network would double the latency of a save for no benefit: nothing in
 * between needs to reach the device.
 */
import type {
  Clarification,
  EntryAnalysis,
  EntrySignals,
  EntryWithAnalysis,
  JournalEntry,
  Mirror,
  MonthReview,
  MonthReviewProgression,
  Progression,
} from '@/types';
import { getSupabase } from '@/lib/supabase';
import { LocalRepository } from '@/data/localRepository';
import { getRepository } from '@/data';
import {
  emptySignals,
  isJourneyRole,
  isProgressionMaturity,
  isProgressionType,
} from './progressionRules';
import { analyzeLocally } from './localAnalysis';
import { buildMirror } from './mirror';

export interface AnalysisOutcome {
  analysis: EntryAnalysis;
  /** Progressions this entry now stands inside, after the maturity ceiling. */
  progressions: Progression[];
  mirror: Mirror;
  /** Present only when answering would change the reading (§14). */
  clarification: Clarification | null;
  /** True when the reading came from the local path rather than the model. */
  offline: boolean;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('EDGE_FUNCTIONS_UNAVAILABLE');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------------------
// Wire reading
// ---------------------------------------------------------------------------

function readProgression(raw: unknown): Progression | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || typeof p.title !== 'string') return null;
  if (!isProgressionType(p.type) || !isProgressionMaturity(p.maturity)) return null;
  const now = new Date().toISOString();
  return {
    id: p.id,
    userId: typeof p.user_id === 'string' ? p.user_id : '',
    type: p.type,
    title: p.title,
    fromState: typeof p.from_state === 'string' ? p.from_state : undefined,
    currentState: typeof p.current_state === 'string' ? p.current_state : undefined,
    summary: typeof p.summary === 'string' ? p.summary : '',
    maturity: p.maturity,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.3,
    firstDetectedAt: typeof p.first_detected_at === 'string' ? p.first_detected_at : now,
    lastUpdatedAt: typeof p.last_updated_at === 'string' ? p.last_updated_at : now,
    verdict: p.verdict === 'accepted' || p.verdict === 'adjusted' ? p.verdict : undefined,
    userEdited: p.user_edited === true,
    mergedIntoId: typeof p.merged_into_id === 'string' ? p.merged_into_id : undefined,
    evidenceCount: typeof p.evidence_count === 'number' ? p.evidence_count : 0,
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readAnalysis(raw: unknown, logId: string): EntryAnalysis {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const signals = { ...emptySignals() } as EntrySignals;
  if (typeof value.signals === 'object' && value.signals !== null) {
    const source = value.signals as Record<string, unknown>;
    for (const key of Object.keys(signals) as (keyof EntrySignals)[]) {
      signals[key] = readStringArray(source[key]);
    }
  }
  return {
    logId,
    eventSummary: typeof value.event_summary === 'string' ? value.event_summary : '',
    topics: readStringArray(value.topics),
    actors: readStringArray(value.actors),
    environment: readStringArray(value.environment),
    action: readOptionalString(value.action),
    outcome: readOptionalString(value.outcome),
    reaction: readOptionalString(value.reaction),
    hypothesis: readOptionalString(value.hypothesis),
    futureIntention: readOptionalString(value.future_intention),
    journeyRole: isJourneyRole(value.journey_role) ? value.journey_role : 'neutral',
    signals,
    confidence: typeof value.confidence === 'number' ? value.confidence : 0,
    analyzedAt: new Date().toISOString(),
  };
}

function readClarification(raw: unknown, logId: string): Clarification | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const options = readStringArray(c.options);
  if (typeof c.id !== 'string' || typeof c.question !== 'string' || options.length < 2) return null;
  return { id: c.id, logId, question: c.question, options };
}

// ---------------------------------------------------------------------------
// Reading one entry
// ---------------------------------------------------------------------------

/**
 * Reads one entry and, if the retrieval turns anything up, the movement it
 * belongs to. Runs after the entry is already committed, so a failure here can
 * never roll a saved record back.
 */
export async function analyzeEntry(entry: JournalEntry): Promise<AnalysisOutcome> {
  const repository = getRepository();

  if (!(repository instanceof LocalRepository)) {
    try {
      const raw = await invoke<Record<string, unknown>>('analyze-entry', { log_id: entry.id });
      const analysis = readAnalysis(raw.analysis, entry.id);
      const progressions = Array.isArray(raw.progressions)
        ? raw.progressions.map(readProgression).filter((p): p is Progression => p !== null)
        : [];
      const joined = Array.isArray(raw.joined_progression_ids)
        ? progressions.filter((p) => (raw.joined_progression_ids as unknown[]).includes(p.id))
        : [];

      return {
        analysis,
        progressions,
        mirror: buildMirror({
          logId: entry.id,
          analysis,
          joined,
          emerged: raw.emerged === true,
        }),
        clarification: readClarification(raw.clarification, entry.id),
        offline: false,
      };
    } catch {
      // Fall through to the local reading: the entry is saved either way.
    }
  }

  return analyzeEntryLocally(entry, repository instanceof LocalRepository ? repository : null);
}

/**
 * The offline reading.
 *
 * When the local repository is available the result is persisted there too, so
 * the map keeps working with no backend at all. It reads a year rather than a
 * month: a progression that only shows up across months is exactly the kind
 * this path would otherwise never find.
 */
async function analyzeEntryLocally(
  entry: JournalEntry,
  local: LocalRepository | null
): Promise<AnalysisOutcome> {
  const repository = getRepository();
  const history = await repository
    .listEntriesByYear(entry.occurredOn.slice(0, 4))
    .catch((): EntryWithAnalysis[] => []);

  const result = analyzeLocally({
    logId: entry.id,
    type: entry.type,
    body: entry.body,
    subjectiveSignal: entry.subjectiveSignal,
    occurredAt: entry.occurredAt,
    history,
  });

  const progressions: Progression[] = [];
  if (local) {
    await local.saveAnalysis(result.analysis);
    for (const draft of result.progressions) {
      const progression = await local.upsertProgression({
        type: draft.type,
        title: draft.title,
        fromState: draft.fromState,
        currentState: draft.currentState,
        summary: draft.summary,
        // The ceiling decides the real value; proposing the floor keeps this
        // path from ever being the reason a claim gets louder.
        maturity: 'signal',
        confidence: draft.confidence,
        occurredAt: entry.occurredAt,
      });
      await local.addEvidence(
        draft.evidence.map((e) => ({
          progressionId: progression.id,
          logId: e.logId,
          role: e.role,
          occurredAt: e.occurredAt,
        }))
      );
      progressions.push(progression);
    }
  }

  return {
    analysis: result.analysis,
    progressions,
    mirror: buildMirror({ logId: entry.id, analysis: result.analysis, joined: progressions }),
    clarification: null,
    offline: true,
  };
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

interface MonthReviewWire {
  title?: unknown;
  subtitle?: unknown;
  progressions?: unknown;
  carrying_forward?: unknown;
}

function readReviewProgression(raw: unknown): MonthReviewProgression | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.title !== 'string' || p.title.trim().length === 0) return null;
  return { title: p.title.trim(), line: typeof p.line === 'string' ? p.line.trim() : '' };
}

/**
 * The month-end reading (§23).
 *
 * At most three progressions and never padded to three: a month with two
 * movements in it says two, and a month with none is not given a title.
 */
export async function generateMonthReview(periodKey: string): Promise<MonthReview | null> {
  try {
    const raw = await invoke<MonthReviewWire>('month-progressions', { period_key: periodKey });
    if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return null;
    return {
      periodKey,
      title: raw.title.trim(),
      subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '',
      progressions: Array.isArray(raw.progressions)
        ? raw.progressions
            .map(readReviewProgression)
            .filter((p): p is MonthReviewProgression => p !== null)
            .slice(0, 3)
        : [],
      carryingForward:
        typeof raw.carrying_forward === 'string' ? raw.carrying_forward.trim() : '',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
