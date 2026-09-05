/**
 * Client side of the analysis pipeline.
 *
 * The app never talks to an LLM directly and holds no provider key: the call
 * goes to a Supabase Edge Function running with the service role, which is the
 * only place the key exists. When that is unreachable — or the project has no
 * Supabase configuration at all — the local, model-free path runs instead and
 * the person still keeps their record.
 */
import type {
  EntryAnalysis,
  EntryWithAnalysis,
  Gain,
  GainEvidence,
  GainType,
  JournalEntry,
  JourneyLink,
  MonthReview,
  TodaysGain,
} from '@/types';
import { getSupabase } from '@/lib/supabase';
import { LocalRepository } from '@/data/localRepository';
import { getRepository } from '@/data';
import { isGainMaturity, isGainStatus, isGainType, isJourneyRole } from './gainRules';
import { analyzeLocally } from './localAnalysis';
import { buildTodaysGain } from './todaysGain';

export interface AnalysisOutcome {
  analysis: EntryAnalysis;
  /** Gains this entry now stands behind, after the maturity ceiling. */
  gains: Gain[];
  todaysGain: TodaysGain;
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

interface GainWire {
  id?: unknown;
  user_id?: unknown;
  type?: unknown;
  label?: unknown;
  maturity?: unknown;
  confidence?: unknown;
  first_detected_at?: unknown;
  last_detected_at?: unknown;
  verdict?: unknown;
}

function readGain(raw: unknown): Gain | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const g = raw as GainWire;
  if (typeof g.id !== 'string' || typeof g.label !== 'string') return null;
  if (!isGainType(g.type) || !isGainMaturity(g.maturity)) return null;
  const now = new Date().toISOString();
  return {
    id: g.id,
    userId: typeof g.user_id === 'string' ? g.user_id : '',
    type: g.type as GainType,
    label: g.label,
    maturity: g.maturity,
    confidence: typeof g.confidence === 'number' ? g.confidence : 0.3,
    firstDetectedAt: typeof g.first_detected_at === 'string' ? g.first_detected_at : now,
    lastDetectedAt: typeof g.last_detected_at === 'string' ? g.last_detected_at : now,
    verdict: g.verdict === 'accepted' || g.verdict === 'adjusted' ? g.verdict : undefined,
  };
}

function readAnalysis(raw: unknown, logId: string): EntryAnalysis {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    logId,
    eventSummary: typeof value.event_summary === 'string' ? value.event_summary : '',
    journeyRole: isJourneyRole(value.journey_role) ? value.journey_role : 'neutral',
    gainStatus: isGainStatus(value.gain_status) ? value.gain_status : 'unresolved',
    semanticTags: Array.isArray(value.semantic_tags)
      ? value.semantic_tags.filter((t): t is string => typeof t === 'string')
      : [],
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Reads one entry. Runs after the entry is already committed, so a failure
 * here can never roll a saved record back.
 */
export async function analyzeEntry(entry: JournalEntry): Promise<AnalysisOutcome> {
  const repository = getRepository();

  if (!(repository instanceof LocalRepository)) {
    try {
      const raw = await invoke<Record<string, unknown>>('analyze-log', { log_id: entry.id });
      const analysis = readAnalysis(raw.analysis, entry.id);
      const gains = Array.isArray(raw.gains)
        ? raw.gains.map(readGain).filter((g): g is Gain => g !== null)
        : [];
      return {
        analysis,
        gains,
        todaysGain: buildTodaysGain({
          logId: entry.id,
          gainStatus: analysis.gainStatus,
          gains,
        }),
        offline: false,
      };
    } catch {
      // Fall through to the local reading: the entry is saved either way.
    }
  }

  return analyzeEntryLocally(entry, repository instanceof LocalRepository ? repository : null);
}

/**
 * The offline reading. When the local repository is available the result is
 * persisted there too, so the map keeps working with no backend at all.
 */
async function analyzeEntryLocally(
  entry: JournalEntry,
  local: LocalRepository | null
): Promise<AnalysisOutcome> {
  const repository = getRepository();
  const monthHistory = await repository
    .listEntriesByMonth(entry.occurredOn.slice(0, 7))
    .catch((): EntryWithAnalysis[] => []);

  const result = analyzeLocally({
    logId: entry.id,
    inputCategory: entry.inputCategory,
    body: entry.body,
    occurredAt: entry.occurredAt,
    history: monthHistory,
  });

  const gains: Gain[] = [];
  if (local) {
    await local.saveAnalysis(result.analysis);
    for (const draft of result.gains) {
      const gain = await local.upsertGain({
        type: draft.type,
        label: draft.label,
        maturity: draft.maturity,
        confidence: draft.confidence,
        firstDetectedAt: entry.occurredAt,
        lastDetectedAt: entry.occurredAt,
      });
      const evidence: GainEvidence = {
        gainId: gain.id,
        logId: entry.id,
        relation: 'created',
        note: draft.evidence,
        createdAt: new Date().toISOString(),
      };
      await local.addEvidence(evidence);
      for (const logId of draft.supportingLogIds) {
        await local.addEvidence({ ...evidence, logId, relation: 'supports' });
      }
      const links: JourneyLink[] = draft.supportingLogIds.map((logId) => ({
        fromLogId: logId,
        toLogId: entry.id,
        relation: 'same_theme',
        confidence: 0.4,
      }));
      await local.addLinks(links);
      gains.push(gain);
    }
  }

  return {
    analysis: result.analysis,
    gains,
    todaysGain: buildTodaysGain({
      logId: entry.id,
      gainStatus: result.analysis.gainStatus,
      gains,
    }),
    offline: true,
  };
}

interface MonthReviewWire {
  period_key?: unknown;
  title?: unknown;
  subtitle?: unknown;
  gains?: unknown;
  one_change?: unknown;
}

/**
 * The month-end reading (§19). Three pieces of information, evidence-based,
 * and never generated for a month with nothing in it.
 */
export async function generateMonthReview(periodKey: string): Promise<MonthReview | null> {
  try {
    const raw = await invoke<MonthReviewWire>('month-review', { period_key: periodKey });
    if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return null;
    return {
      periodKey,
      title: raw.title.trim(),
      subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '',
      gains: Array.isArray(raw.gains)
        ? raw.gains.filter((g): g is string => typeof g === 'string').slice(0, 3)
        : [],
      oneChange: typeof raw.one_change === 'string' ? raw.one_change.trim() : '',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
