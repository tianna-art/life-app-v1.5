/**
 * Client side of the analysis pipeline.
 *
 * The app never talks to an LLM directly and holds no provider key: every call
 * goes to a Supabase Edge Function running with the service role, which is the
 * only place the key exists. When one is unreachable — or the project has no
 * Supabase configuration at all — a local, model-free path runs instead and
 * the person still keeps their record.
 *
 * Every function here returns a usable value on failure. Nothing in this file
 * is allowed to be the reason a save does not happen.
 */
import type {
  Gain,
  GainCategory,
  LogAnalysis,
  LogType,
  LogWithAnalysis,
  MomentTag,
  Mirror,
  MonthThemeCandidate,
  Progression,
  ProgressionEvidenceRole,
  DailyLog,
} from '@/types';
import { getSupabase } from '@/lib/supabase';
import { LocalRepository } from '@/data/localRepository';
import { getRepository } from '@/data';
import {
  isGainCategory,
  isJourneyRole,
  isProgressionMaturity,
  isProgressionPattern,
  isProgressionType,
} from './progressionRules';
import { analyzeLocally } from './localAnalysis';
import { buildMirror } from './mirror';
import { isUsableQuestion, pickQuestion } from '@/constants/questions';
import { watchedPatterns } from '@/constants/desiredSelf';

export interface AnalysisOutcome {
  analysis: LogAnalysis;
  /** Progressions this record now stands inside, after the maturity ceiling. */
  progressions: Progression[];
  mirror: Mirror;
  /** True when the reading came from the local path rather than the model. */
  offline: boolean;
  /**
   * Why the model was not reached, when it was not.
   *
   * The local fallback exists so a save is never lost, and for a save that is
   * the whole story. Anywhere someone asked for a reading and is paying for
   * it, silence is the wrong answer — they need to know it did not happen and
   * what stopped it.
   */
  reason?: string | undefined;
}

/**
 * A sentence the person can act on, out of an error object they cannot.
 *
 * supabase-js reports a non-2xx from a function as a bare "Edge Function
 * returned a non-2xx status code", which says nothing about which of the four
 * or five possible causes it was. The status is the one part that separates
 * them, so it is kept.
 */
function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'EDGE_FUNCTIONS_UNAVAILABLE') {
      return 'サーバーに接続できませんでした。';
    }
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401 || status === 403) return 'ログインし直してからもう一度お試しください。';
    if (status === 404) return '分析の機能が見つかりません（未デプロイの可能性があります）。';
    if (typeof status === 'number') return `分析でエラーが起きました（${status}）。`;
    return error.message;
  }
  return '分析に届きませんでした。';
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('EDGE_FUNCTIONS_UNAVAILABLE');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
}

function readStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

// ---------------------------------------------------------------------------
// STAGE 0 — the Level 3 question (§11-§13)
// ---------------------------------------------------------------------------

export interface QuestionContext {
  logType: LogType;
  momentTags: readonly MomentTag[];
  desiredSelfCards?: readonly string[];
  lenses?: readonly string[];
  monthTheme?: string | undefined;
}

/**
 * The one-line question, asked before the save.
 *
 * The table in `constants/questions.ts` answers first and answers instantly,
 * so the field is never waiting on a network call. The model is then given a
 * chance to say something better, and its answer is used only if it is short
 * enough and carries none of the forbidden reflective phrasing (§12).
 *
 * That ordering is the whole design: the fallback is not a degraded mode, it
 * is the floor, and the model can only improve on it.
 */
export async function generateQuestion(context: QuestionContext): Promise<string | null> {
  const watched = watchedPatterns([...(context.desiredSelfCards ?? [])]);
  const fallback = pickQuestion({
    logType: context.logType,
    momentTags: context.momentTags,
    watched,
  });

  try {
    const raw = await invoke<{ question?: unknown }>('generate-question', {
      log_type: context.logType,
      moment_tags: context.momentTags,
      lenses: context.lenses ?? [],
      month_theme: context.monthTheme ?? null,
      fallback,
    });
    const question = readOptionalString(raw.question);
    if (question && isUsableQuestion(question)) return question;
  } catch {
    // Unreachable or slow: the table's answer is already good.
  }

  return fallback;
}

// ---------------------------------------------------------------------------
// STAGE 1 & 2 — reading one record (§16-§19)
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
    pattern: isProgressionPattern(p.pattern) ? p.pattern : undefined,
    title: p.title,
    fromState: readOptionalString(p.from_state),
    currentState: readOptionalString(p.current_state),
    summary: typeof p.summary === 'string' ? p.summary : '',
    maturity: p.maturity,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.3,
    goalExternal: p.goal_external === true,
    firstDetectedAt: typeof p.first_detected_at === 'string' ? p.first_detected_at : now,
    lastUpdatedAt: typeof p.last_updated_at === 'string' ? p.last_updated_at : now,
    verdict: p.verdict === 'accepted' || p.verdict === 'adjusted' ? p.verdict : undefined,
    userEdited: p.user_edited === true,
    mergedIntoId: readOptionalString(p.merged_into_id),
    evidenceCount: typeof p.evidence_count === 'number' ? p.evidence_count : 0,
  };
}

function readAnalysis(raw: unknown, logId: string): LogAnalysis {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    logId,
    eventSummary: typeof value.event_summary === 'string' ? value.event_summary : '',
    themes: readStringArray(value.themes),
    people: readStringArray(value.people, 4),
    action: readOptionalString(value.action),
    outcome: readOptionalString(value.outcome),
    friction: readOptionalString(value.friction),
    discovery: readOptionalString(value.discovery),
    adaptation: readOptionalString(value.adaptation),
    choice: readOptionalString(value.choice),
    environment: readOptionalString(value.environment),
    interestSignal: readOptionalString(value.interest_signal),
    journeyRole: isJourneyRole(value.journey_role) ? value.journey_role : undefined,
    confidence: typeof value.confidence === 'number' ? value.confidence : 0,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Reads one record and, if retrieval turns anything up, the movement it
 * belongs to. Runs after the record is committed, so a failure here can never
 * roll a saved record back.
 */
export async function analyzeLog(log: DailyLog): Promise<AnalysisOutcome> {
  const repository = getRepository();

  if (!(repository instanceof LocalRepository)) {
    try {
      const raw = await invoke<Record<string, unknown>>('analyze-log', { log_id: log.id });
      const analysis = readAnalysis(raw.analysis, log.id);
      const progressions = Array.isArray(raw.progressions)
        ? raw.progressions.map(readProgression).filter((p): p is Progression => p !== null)
        : [];

      const joinedIds = new Set(readStringArray(raw.joined_progression_ids, 8));
      const joined = progressions.filter((p) => joinedIds.has(p.id));

      const emergedId = readOptionalString(raw.emerged_progression_id);
      const emergedProgression = emergedId
        ? progressions.find((p) => p.id === emergedId)
        : undefined;
      const emerged = emergedProgression
        ? {
            progression: emergedProgression,
            count:
              typeof raw.emerged_count === 'number'
                ? raw.emerged_count
                : emergedProgression.evidenceCount,
          }
        : undefined;

      return {
        analysis,
        progressions,
        mirror: buildMirror({
          logId: log.id,
          momentTags: log.momentTags,
          analysis,
          joined,
          emerged,
        }),
        offline: false,
      };
    } catch (error) {
      // Fall through to the local reading: the record is saved either way.
      // The reason travels with it so a caller that cares can say it out loud.
      const local = await analyzeLogLocally(log, null);
      return { ...local, reason: describeFailure(error) };
    }
  }

  return analyzeLogLocally(log, repository instanceof LocalRepository ? repository : null);
}

/**
 * The offline reading.
 *
 * When the local repository is available the result is persisted there too, so
 * the map keeps working with no backend at all. It reads a year rather than a
 * month: a progression that only shows up across months is exactly the kind
 * this path would otherwise never find.
 */
async function analyzeLogLocally(
  log: DailyLog,
  local: LocalRepository | null
): Promise<AnalysisOutcome> {
  const repository = getRepository();
  const history = await repository
    .listLogsByYear(log.occurredOn.slice(0, 4))
    .catch((): LogWithAnalysis[] => []);

  const result = analyzeLocally({
    logId: log.id,
    logType: log.logType,
    momentTags: log.momentTags,
    optionalAnswer: log.optionalAnswer,
    occurredAt: log.occurredAt,
    history,
  });

  const progressions: Progression[] = [];
  if (local) {
    await local.saveAnalysis(result.analysis);
    for (const draft of result.progressions) {
      const progression = await local.upsertProgression({
        type: draft.type,
        pattern: draft.pattern,
        title: draft.title,
        summary: draft.summary,
        confidence: draft.confidence,
        goalExternal: draft.goalExternal,
        occurredAt: log.occurredAt,
      });
      await local.addEvidence(
        draft.evidence.map((e) => ({
          progressionId: progression.id,
          logId: e.logId,
          role: e.role as ProgressionEvidenceRole,
          occurredAt: e.occurredAt,
        }))
      );
      progressions.push(progression);
    }
  }

  return {
    analysis: result.analysis,
    progressions,
    mirror: buildMirror({
      logId: log.id,
      momentTags: log.momentTags,
      analysis: result.analysis,
      joined: progressions,
    }),
    offline: true,
  };
}

// ---------------------------------------------------------------------------
// The lens (§4, §5, §6)
// ---------------------------------------------------------------------------

/** Three to six phrases naming what the reading will watch for (§4). */
export async function generateLenses(input: {
  selectedAreas: string[];
  desiredSelfCards: string[];
}): Promise<string[]> {
  try {
    const raw = await invoke<{ lenses?: unknown }>('generate-lens', {
      selected_areas: input.selectedAreas,
      desired_self_cards: input.desiredSelfCards,
    });
    return readStringArray(raw.lenses, 6);
  } catch {
    return [];
  }
}

/** Three candidate year themes. Not goals — a name for the year (§5). */
export async function generateYearThemes(input: {
  selectedAreas: string[];
  lenses: string[];
}): Promise<string[]> {
  try {
    const raw = await invoke<{ themes?: unknown }>('generate-lens', {
      task: 'year_theme',
      selected_areas: input.selectedAreas,
      lenses: input.lenses,
    });
    return readStringArray(raw.themes, 3);
  } catch {
    return [];
  }
}

function readCandidate(raw: unknown): MonthThemeCandidate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const theme = readOptionalString(c.theme);
  if (!theme) return null;
  const source = c.source;
  if (source !== 'continue' && source !== 'deepen' && source !== 'follow_spark') return null;
  return { source, theme, because: readOptionalString(c.because) ?? '' };
}

/**
 * Continue / Deepen / Follow the Spark (§6).
 *
 * Returns an empty list rather than inventing themes for a month with nothing
 * behind it: a first month has no previous records to continue from, and
 * offering three anyway would be asking the person to set a goal — which is
 * the thing §6 exists to avoid.
 */
export async function generateMonthThemes(input: {
  year: number;
  month: number;
}): Promise<MonthThemeCandidate[]> {
  try {
    const raw = await invoke<{ candidates?: unknown }>('month-theme', {
      year: input.year,
      month: input.month,
    });
    return Array.isArray(raw.candidates)
      ? raw.candidates.map(readCandidate).filter((c): c is MonthThemeCandidate => c !== null)
      : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Month & year readings (§25, §26)
// ---------------------------------------------------------------------------

export function readGain(raw: unknown): Gain | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const g = raw as Record<string, unknown>;
  const label = readOptionalString(g.label);
  if (!label || !isGainCategory(g.category)) return null;
  const now = new Date().toISOString();
  return {
    id: typeof g.id === 'string' ? g.id : '',
    progressionId: typeof g.progression_id === 'string' ? g.progression_id : '',
    category: g.category as GainCategory,
    label,
    description: readOptionalString(g.description),
    confidence: typeof g.confidence === 'number' ? g.confidence : 0,
    firstDetectedAt: typeof g.first_detected_at === 'string' ? g.first_detected_at : now,
    lastDetectedAt: typeof g.last_detected_at === 'string' ? g.last_detected_at : now,
  };
}

export { invoke as invokeEdgeFunction };
