import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DailyLog,
  Gain,
  GainCategory,
  JourneyRole,
  LogAnalysis,
  LogType,
  LogWithAnalysis,
  MomentTag,
  Change,
  ChangeEvidenceEntry,
  ChangeEvidenceRole,
  ChangeConfidence,
  ChangeTargetType,
  MonthProgression,
  MonthReview,
  MonthReviewChange,
  MonthReviewGain,
  MonthTheme,
  MonthThemeCandidate,
  NewLogInput,
  Progression,
  ProgressionDetail,
  ProgressionEvidenceRole,
  ProgressionMaturity,
  ProgressionPattern,
  ProgressionRef,
  ProgressionStep,
  ProgressionType,
  ProgressionVerdict,
  ThemeSource,
  YearDirection,
  YearReview,
} from '@/types';
import { requireSupabase } from '@/lib/supabase';
import { monthRange } from '@/utils/period';
import { logTypeForLegacy } from '@/constants/log';
import { maturityCeiling, minMaturity, summariseEvidencePath } from '@/ai/progressionRules';
import { resolveGainCategory } from '@/ai/progressionRules';
import type { Repository } from './repository';

const LOG_COLUMNS =
  'id, user_id, occurred_on, occurred_at, type, moment_tags, ai_question, optional_answer, body, created_at';

const CHANGE_COLUMNS =
  'id, user_id, period_type, year, month, title, linked_target_type, linked_target_id, ' +
  'linked_target_label, before_state, current_state, observation, target_connection, ' +
  'confidence, position, progression_id, verdict, user_edited, created_at, updated_at';

interface ChangeRow {
  id: string;
  user_id: string;
  period_type: 'month' | 'year' | 'long_term';
  year: number;
  month: number | null;
  title: string;
  linked_target_type: ChangeTargetType;
  linked_target_id: string | null;
  linked_target_label: string | null;
  before_state: string | null;
  current_state: string | null;
  observation: string | null;
  target_connection: string | null;
  confidence: ChangeConfidence;
  position: number;
  progression_id: string | null;
  verdict: ProgressionVerdict | null;
  user_edited: boolean;
  created_at: string;
  updated_at: string;
}

interface ChangeEvidenceRow {
  change_id: string;
  log_id: string;
  role: ChangeEvidenceRole;
  occurred_at: string;
  position: number;
}
const REVIEW_COLUMNS =
  'period_key, initial_theme, what_actually_happened, progressions, gained, title_candidates, title, subtitle, created_at';
const YEAR_REVIEW_COLUMNS =
  'year, initial_theme, actual_story, progressions, gained, title_candidates, created_at';
const ANALYSIS_COLUMNS =
  'log_id, event_summary, topics, actors, action, outcome, friction, discovery, adaptation, choice, environment_note, interest_signal, journey_role, confidence, updated_at';

interface LogRow {
  id: string;
  user_id: string;
  occurred_on: string;
  occurred_at: string;
  type: string;
  moment_tags: MomentTag[] | null;
  ai_question: string | null;
  optional_answer: string | null;
  body: string | null;
  created_at: string;
}

/**
 * Two v3 columns keep their names because they already mean what v4 needs, and
 * renaming them would make the rows written before this release unreadable for
 * nothing: `topics` is themes and `actors` is people. Everything else has its
 * own column.
 */
interface AnalysisRow {
  log_id: string;
  event_summary: string | null;
  topics: string[] | null;
  actors: string[] | null;
  action: string | null;
  outcome: string | null;
  friction: string | null;
  discovery: string | null;
  adaptation: string | null;
  choice: string | null;
  environment_note: string | null;
  interest_signal: string | null;
  journey_role: JourneyRole | null;
  confidence: number | null;
  updated_at?: string | null;
}

interface ProgressionRow {
  id: string;
  user_id: string;
  type: ProgressionType;
  pattern: ProgressionPattern | null;
  title: string;
  from_state: string | null;
  current_state: string | null;
  summary: string;
  maturity: ProgressionMaturity;
  confidence: number;
  goal_external: boolean;
  first_detected_at: string;
  last_updated_at: string;
  verdict: ProgressionVerdict | null;
  user_edited: boolean;
  merged_into_id: string | null;
}

interface EvidenceRow {
  progression_id: string;
  log_id: string;
  role: ProgressionEvidenceRole;
  occurred_at: string;
}

interface GainRow {
  id: string;
  change_id: string | null;
  progression_id: string | null;
  category: GainCategory | null;
  label: string;
  description: string | null;
  confidence: number;
  first_detected_at: string;
  last_detected_at: string;
}

interface YearDirectionRow {
  id: string;
  user_id: string;
  year: number;
  selected_areas: string[] | null;
  desired_self_cards: string[] | null;
  progression_lenses: string[] | null;
  initial_theme: string | null;
  final_theme: string | null;
}

interface MonthThemeRow {
  id: string;
  user_id: string;
  year: number;
  month: number;
  initial_theme: string | null;
  final_theme: string | null;
  source: ThemeSource;
  candidates: MonthThemeCandidate[] | null;
}

interface MonthReviewRow {
  period_key: string;
  initial_theme: string | null;
  what_actually_happened: string | null;
  progressions: MonthReviewChange[] | null;
  gained: MonthReviewGain[] | null;
  title_candidates: string[] | null;
  title: string;
  subtitle: string;
  created_at: string;
}

interface YearReviewRow {
  year: number;
  initial_theme: string;
  actual_story: string;
  progressions: MonthReviewChange[] | null;
  gained: MonthReviewGain[] | null;
  title_candidates: string[] | null;
  created_at: string;
}

function mapLog(row: LogRow, analysis?: AnalysisRow): LogWithAnalysis {
  const base: DailyLog = {
    id: row.id,
    userId: row.user_id,
    occurredAt: row.occurred_at,
    occurredOn: row.occurred_on,
    logType: logTypeForLegacy(row.type),
    momentTags: row.moment_tags ?? [],
    aiQuestion: row.ai_question ?? undefined,
    optionalAnswer: row.optional_answer ?? undefined,
    body: row.body ?? undefined,
    createdAt: row.created_at,
  };
  return analysis ? { ...base, analysis: mapAnalysis(analysis) } : base;
}

function mapAnalysis(row: AnalysisRow): LogAnalysis {
  return {
    logId: row.log_id,
    eventSummary: row.event_summary ?? '',
    themes: row.topics ?? [],
    people: row.actors ?? [],
    action: row.action ?? undefined,
    outcome: row.outcome ?? undefined,
    friction: row.friction ?? undefined,
    discovery: row.discovery ?? undefined,
    adaptation: row.adaptation ?? undefined,
    choice: row.choice ?? undefined,
    environment: row.environment_note ?? undefined,
    interestSignal: row.interest_signal ?? undefined,
    journeyRole: row.journey_role ?? undefined,
    confidence: row.confidence ?? 0,
    analyzedAt: row.updated_at ?? undefined,
  };
}

function mapProgression(row: ProgressionRow, evidenceCount = 0): Progression {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    pattern: row.pattern ?? undefined,
    title: row.title,
    fromState: row.from_state ?? undefined,
    currentState: row.current_state ?? undefined,
    summary: row.summary,
    maturity: row.maturity,
    confidence: row.confidence,
    goalExternal: row.goal_external ?? false,
    firstDetectedAt: row.first_detected_at,
    lastUpdatedAt: row.last_updated_at,
    verdict: row.verdict ?? undefined,
    userEdited: row.user_edited,
    mergedIntoId: row.merged_into_id ?? undefined,
    evidenceCount,
  };
}

function mapGain(row: GainRow): Gain {
  return {
    id: row.id,
    ...(row.change_id ? { changeId: row.change_id } : {}),
    ...(row.progression_id ? { progressionId: row.progression_id } : {}),
    // A row written under the six-category reading still resolves; one written
    // before categories existed falls back to `evidence`, the only name that
    // claims nothing beyond "this happened".
    category: resolveGainCategory(row.category) ?? 'evidence',
    label: row.label,
    description: row.description ?? undefined,
    confidence: row.confidence,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
  };
}

function mapYearDirection(row: YearDirectionRow): YearDirection {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    selectedAreas: row.selected_areas ?? [],
    desiredSelfCards: row.desired_self_cards ?? [],
    progressionLenses: row.progression_lenses ?? [],
    initialTheme: row.initial_theme ?? undefined,
    finalTheme: row.final_theme ?? undefined,
  };
}

function mapMonthTheme(row: MonthThemeRow): MonthTheme {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    month: row.month,
    initialTheme: row.initial_theme ?? undefined,
    finalTheme: row.final_theme ?? undefined,
    source: row.source,
    candidates: row.candidates ?? [],
  };
}

function mapReview(row: MonthReviewRow): MonthReview {
  return {
    periodKey: row.period_key,
    initialTheme: row.initial_theme ?? '',
    whatActuallyHappened: row.what_actually_happened ?? '',
    changed: (row.progressions ?? []).slice(0, 3),
    gained: (row.gained ?? []).slice(0, 3),
    titleCandidates: row.title_candidates ?? [],
    title: row.title,
    subtitle: row.subtitle,
    createdAt: row.created_at,
  };
}

function mapYearReview(row: YearReviewRow): YearReview {
  return {
    year: row.year,
    initialTheme: row.initial_theme,
    actualStory: row.actual_story,
    progressions: row.progressions ?? [],
    gained: row.gained ?? [],
    titleCandidates: row.title_candidates ?? [],
    createdAt: row.created_at,
  };
}

function resolveMerged(progression: Progression, byId: Map<string, Progression>): Progression {
  const seen = new Set<string>();
  let current = progression;
  while (current.mergedIntoId && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.mergedIntoId);
    if (!next) break;
    current = next;
  }
  return current;
}

/**
 * Supabase-backed storage.
 *
 * Row level security scopes every read to the signed-in person, so nothing
 * here filters by user id except the writes that have to name one.
 */
export class SupabaseRepository implements Repository {
  readonly name = 'supabase' as const;

  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient = requireSupabase()) {
    this.client = client;
  }

  private async userId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error('Not authenticated.');
    return data.user.id;
  }

  async ensureBootstrapped(): Promise<void> {
    const userId = await this.userId();
    await this.client
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // -------------------------------------------------------------------------
  // The lens
  // -------------------------------------------------------------------------

  async getYearDirection(year: number): Promise<YearDirection | null> {
    const { data, error } = await this.client
      .from('year_directions')
      .select('*')
      .eq('year', year)
      .maybeSingle();
    if (error) throw error;
    return data ? mapYearDirection(data as YearDirectionRow) : null;
  }

  async saveYearDirection(input: {
    year: number;
    selectedAreas: string[];
    desiredSelfCards: string[];
    progressionLenses: string[];
    initialTheme?: string;
    finalTheme?: string;
  }): Promise<YearDirection> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('year_directions')
      .upsert(
        {
          user_id: userId,
          year: input.year,
          selected_areas: input.selectedAreas,
          desired_self_cards: input.desiredSelfCards,
          progression_lenses: input.progressionLenses,
          // Only written when given: a later save must not erase the opening
          // theme, because the year-end reading compares against it (§26).
          ...(input.initialTheme !== undefined ? { initial_theme: input.initialTheme } : {}),
          ...(input.finalTheme !== undefined ? { final_theme: input.finalTheme } : {}),
        },
        { onConflict: 'user_id,year' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapYearDirection(data as YearDirectionRow);
  }

  async getMonthTheme(year: number, month: number): Promise<MonthTheme | null> {
    const { data, error } = await this.client
      .from('month_themes')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    if (error) throw error;
    return data ? mapMonthTheme(data as MonthThemeRow) : null;
  }

  async listMonthThemes(year: number): Promise<MonthTheme[]> {
    const { data, error } = await this.client
      .from('month_themes')
      .select('*')
      .eq('year', year)
      .order('month', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MonthThemeRow[]).map(mapMonthTheme);
  }

  async saveMonthTheme(input: {
    year: number;
    month: number;
    initialTheme?: string;
    finalTheme?: string;
    source: ThemeSource;
    candidates?: MonthThemeCandidate[];
  }): Promise<MonthTheme> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('month_themes')
      .upsert(
        {
          user_id: userId,
          year: input.year,
          month: input.month,
          source: input.source,
          ...(input.initialTheme !== undefined ? { initial_theme: input.initialTheme } : {}),
          ...(input.finalTheme !== undefined ? { final_theme: input.finalTheme } : {}),
          ...(input.candidates !== undefined ? { candidates: input.candidates } : {}),
        },
        { onConflict: 'user_id,year,month' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapMonthTheme(data as MonthThemeRow);
  }

  // -------------------------------------------------------------------------
  // Daily evidence
  // -------------------------------------------------------------------------

  private async listLogsBetween(from: string, to: string): Promise<LogWithAnalysis[]> {
    const { data, error } = await this.client
      .from('logs')
      .select(LOG_COLUMNS)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as LogRow[];
    if (rows.length === 0) return [];

    const { data: analyses, error: analysisError } = await this.client
      .from('log_ai_analysis')
      .select(ANALYSIS_COLUMNS)
      .in(
        'log_id',
        rows.map((r) => r.id)
      );
    if (analysisError) throw analysisError;

    const byLog = new Map(((analyses ?? []) as AnalysisRow[]).map((a) => [a.log_id, a]));
    return rows.map((row) => mapLog(row, byLog.get(row.id)));
  }

  async listLogsByMonth(monthKey: string): Promise<LogWithAnalysis[]> {
    const { from, to } = monthRange(monthKey);
    return this.listLogsBetween(from, to);
  }

  async listLogsByYear(yearKey: string): Promise<LogWithAnalysis[]> {
    return this.listLogsBetween(`${yearKey}-01-01`, `${yearKey}-12-31`);
  }

  async getLog(id: string): Promise<LogWithAnalysis | null> {
    const { data, error } = await this.client
      .from('logs')
      .select(LOG_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const [{ data: analysis }, { data: evidence }] = await Promise.all([
      this.client.from('log_ai_analysis').select(ANALYSIS_COLUMNS).eq('log_id', id).maybeSingle(),
      this.client
        .from('progression_evidence')
        .select('progression_id, log_id, role, occurred_at')
        .eq('log_id', id),
    ]);

    const log = mapLog(data as LogRow, (analysis as AnalysisRow | null) ?? undefined);
    const rows = (evidence ?? []) as EvidenceRow[];
    if (rows.length === 0) return log;

    const byId = await this.progressionsById();
    const refs: ProgressionRef[] = [];
    for (const row of rows) {
      const raw = byId.get(row.progression_id);
      if (!raw) continue;
      const resolved = resolveMerged(raw, byId);
      if (refs.some((r) => r.id === resolved.id)) continue;
      refs.push({ id: resolved.id, title: resolved.title, role: row.role });
    }
    return { ...log, progressions: refs };
  }

  async createLog(input: NewLogInput): Promise<DailyLog> {
    const userId = await this.userId();
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('logs')
      .insert({
        user_id: userId,
        occurred_at: occurredAt,
        occurred_on: occurredAt.slice(0, 10),
        type: input.logType,
        moment_tags: input.momentTags,
        ai_question: input.aiQuestion ?? null,
        optional_answer: input.optionalAnswer?.trim() || null,
      })
      .select(LOG_COLUMNS)
      .single();
    if (error) throw error;
    return mapLog(data as LogRow);
  }

  async deleteLog(id: string): Promise<void> {
    const { error } = await this.client.from('logs').delete().eq('id', id);
    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // Progression
  // -------------------------------------------------------------------------

  private async progressionsById(): Promise<Map<string, Progression>> {
    const { data, error } = await this.client.from('progressions').select('*');
    if (error) throw error;
    const rows = (data ?? []) as ProgressionRow[];
    return new Map(rows.map((r) => [r.id, mapProgression(r)]));
  }

  private async evidenceCounts(): Promise<Map<string, number>> {
    const { data, error } = await this.client
      .from('progression_evidence')
      .select('progression_id, log_id');
    if (error) throw error;
    const perProgression = new Map<string, Set<string>>();
    for (const row of (data ?? []) as EvidenceRow[]) {
      const set = perProgression.get(row.progression_id) ?? new Set<string>();
      set.add(row.log_id);
      perProgression.set(row.progression_id, set);
    }
    return new Map([...perProgression].map(([id, set]) => [id, set.size]));
  }

  async listProgressions(): Promise<Progression[]> {
    const [byId, counts] = await Promise.all([this.progressionsById(), this.evidenceCounts()]);
    const out = new Map<string, Progression>();
    for (const progression of byId.values()) {
      const resolved = resolveMerged(progression, byId);
      out.set(resolved.id, { ...resolved, evidenceCount: counts.get(resolved.id) ?? 0 });
    }
    return [...out.values()].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  }

  async listMonthProgressions(monthKey: string): Promise<MonthProgression[]> {
    const { from, to } = monthRange(monthKey);

    const { data: logs, error: logError } = await this.client
      .from('logs')
      .select('id')
      .gte('occurred_on', from)
      .lte('occurred_on', to);
    if (logError) throw logError;
    const monthLogIds = new Set(((logs ?? []) as { id: string }[]).map((l) => l.id));
    if (monthLogIds.size === 0) return [];

    const { data: evidence, error: evidenceError } = await this.client
      .from('progression_evidence')
      .select('progression_id, log_id, role, occurred_at');
    if (evidenceError) throw evidenceError;
    const rows = (evidence ?? []) as EvidenceRow[];

    const byId = await this.progressionsById();
    const monthEnd = `${to}T23:59:59.999Z`;

    const grouped = new Map<string, { progression: Progression; evidenceLogIds: string[] }>();
    for (const row of rows) {
      if (!monthLogIds.has(row.log_id)) continue;
      const raw = byId.get(row.progression_id);
      if (!raw) continue;
      const progression = resolveMerged(raw, byId);
      const bucket = grouped.get(progression.id) ?? { progression, evidenceLogIds: [] };
      if (!bucket.evidenceLogIds.includes(row.log_id)) bucket.evidenceLogIds.push(row.log_id);
      grouped.set(progression.id, bucket);
    }

    return [...grouped.values()]
      .map(({ progression, evidenceLogIds }) => {
        const absorbed = new Set(
          [...byId.values()]
            .filter((p) => resolveMerged(p, byId).id === progression.id)
            .map((p) => p.id)
        );
        const pathSoFar = rows
          .filter((r) => absorbed.has(r.progression_id) && r.occurred_at <= monthEnd)
          .map((r) => ({ logId: r.log_id, role: r.role, occurredAt: r.occurred_at }));

        return {
          progression: { ...progression, evidenceCount: evidenceLogIds.length },
          evidenceLogIds,
          isNew: progression.firstDetectedAt.slice(0, 7) === monthKey,
          maturityThen: minMaturity(
            progression.maturity,
            maturityCeiling(summariseEvidencePath(pathSoFar))
          ),
        };
      })
      .sort((a, b) => b.progression.confidence - a.progression.confidence);
  }

  async getProgressionDetail(id: string): Promise<ProgressionDetail | null> {
    const byId = await this.progressionsById();
    const raw = byId.get(id);
    if (!raw) return null;
    const progression = resolveMerged(raw, byId);

    const absorbed = [...byId.values()]
      .filter((p) => resolveMerged(p, byId).id === progression.id)
      .map((p) => p.id);

    const [{ data: evidence, error: evidenceError }, { data: gains, error: gainError }] =
      await Promise.all([
        this.client
          .from('progression_evidence')
          .select('progression_id, log_id, role, occurred_at')
          .in('progression_id', absorbed)
          .order('occurred_at', { ascending: true }),
        this.client.from('gains').select('*').in('progression_id', absorbed),
      ]);
    if (evidenceError) throw evidenceError;
    if (gainError) throw gainError;

    const evidenceRows = (evidence ?? []) as EvidenceRow[];
    const logIds = [...new Set(evidenceRows.map((r) => r.log_id))];

    const [{ data: logs }, { data: analyses }] = await Promise.all([
      this.client.from('logs').select(LOG_COLUMNS).in('id', logIds),
      this.client.from('log_ai_analysis').select('log_id, event_summary').in('log_id', logIds),
    ]);

    const logById = new Map(((logs ?? []) as LogRow[]).map((l) => [l.id, l]));
    const summaryById = new Map(
      ((analyses ?? []) as { log_id: string; event_summary: string | null }[]).map((a) => [
        a.log_id,
        a.event_summary ?? '',
      ])
    );

    const steps: ProgressionStep[] = evidenceRows.flatMap((row) => {
      const log = logById.get(row.log_id);
      if (!log) return [];
      return [
        {
          logId: log.id,
          occurredOn: log.occurred_on,
          role: row.role,
          eventSummary:
            summaryById.get(log.id) || log.optional_answer?.slice(0, 80) || log.body?.slice(0, 80) || '',
          logType: logTypeForLegacy(log.type),
          momentTags: log.moment_tags ?? [],
        },
      ];
    });

    return {
      progression: { ...progression, evidenceCount: logIds.length },
      steps,
      gains: ((gains ?? []) as GainRow[]).map(mapGain),
    };
  }

  async setProgressionVerdict(input: {
    progressionId: string;
    verdict: ProgressionVerdict;
    title?: string;
    summary?: string;
  }): Promise<Progression> {
    const rewrote = input.verdict === 'adjusted' && Boolean(input.title || input.summary);
    const { data, error } = await this.client
      .from('progressions')
      .update({
        verdict: input.verdict,
        ...(input.title ? { title: input.title } : {}),
        ...(input.summary ? { summary: input.summary } : {}),
        ...(rewrote ? { user_edited: true } : {}),
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', input.progressionId)
      .select('*')
      .single();
    if (error) throw error;
    return mapProgression(data as ProgressionRow);
  }

  async listGains(): Promise<Gain[]> {
    const { data, error } = await this.client.from('gains').select('*').not('progression_id', 'is', null);
    if (error) throw error;
    return ((data ?? []) as GainRow[]).map(mapGain);
  }

  // -------------------------------------------------------------------------
  // Month & year
  // -------------------------------------------------------------------------

  /**
   * One month's published changes — the map's points and the cards under them.
   *
   * Four reads and no second opinion: the rows, the records they cite, the
   * text of those records, and whatever settled out of them. The card prints
   * the record as it was written (§26), so the log's own answer is what comes
   * back rather than the model's summary of it.
   */
  async listMonthChanges(monthKey: string): Promise<Change[]> {
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));

    const { data: changeRows, error: changeError } = await this.client
      .from('changes')
      .select(CHANGE_COLUMNS)
      .eq('period_type', 'month')
      .eq('year', year)
      .eq('month', month)
      .order('position', { ascending: true });
    if (changeError) throw changeError;

    const changes = (changeRows ?? []) as unknown as ChangeRow[];
    if (changes.length === 0) return [];

    const ids = changes.map((c) => c.id);
    const [{ data: evidenceRows, error: evidenceError }, { data: gainRows, error: gainError }] =
      await Promise.all([
        this.client
          .from('change_evidence')
          .select('change_id, log_id, role, occurred_at, position')
          .in('change_id', ids)
          .order('position', { ascending: true }),
        this.client.from('gains').select('*').in('change_id', ids),
      ]);
    if (evidenceError) throw evidenceError;
    if (gainError) throw gainError;

    const evidence = (evidenceRows ?? []) as ChangeEvidenceRow[];
    const logIds = [...new Set(evidence.map((row) => row.log_id))];
    const { data: logs, error: logError } = await this.client
      .from('logs')
      .select(LOG_COLUMNS)
      .in('id', logIds);
    if (logError) throw logError;

    const logById = new Map(((logs ?? []) as LogRow[]).map((l) => [l.id, l]));
    const gains = ((gainRows ?? []) as GainRow[]).map(mapGain);

    return changes.map((row) => {
      const entries: ChangeEvidenceEntry[] = evidence
        .filter((e) => e.change_id === row.id)
        .flatMap((e) => {
          const log = logById.get(e.log_id);
          if (!log) return [];
          // The record as written. A card that quoted a paraphrase would be
          // asking the person to check the reading against the reading.
          const written = log.optional_answer ?? log.body ?? '';
          return [
            {
              logId: log.id,
              occurredOn: log.occurred_on,
              role: e.role,
              text: written,
              logType: logTypeForLegacy(log.type),
              momentTags: log.moment_tags ?? [],
            },
          ];
        })
        .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

      return {
        id: row.id,
        userId: row.user_id,
        periodType: row.period_type,
        year: row.year,
        ...(row.month === null ? {} : { month: row.month }),
        title: row.title,
        linkedTargetType: row.linked_target_type,
        ...(row.linked_target_id ? { linkedTargetId: row.linked_target_id } : {}),
        linkedTargetLabel: row.linked_target_label ?? '',
        ...(row.before_state ? { beforeState: row.before_state } : {}),
        currentState: row.current_state ?? '',
        observation: row.observation ?? '',
        targetConnection: row.target_connection ?? '',
        confidence: row.confidence,
        position: row.position,
        ...(row.progression_id ? { progressionId: row.progression_id } : {}),
        ...(row.verdict ? { verdict: row.verdict } : {}),
        userEdited: row.user_edited,
        evidence: entries,
        gains: gains.filter((g) => g.changeId === row.id),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async countMonthChanges(yearKey: string): Promise<Map<string, number>> {
    const { data, error } = await this.client
      .from('changes')
      .select('year, month')
      .eq('period_type', 'month')
      .eq('year', Number(yearKey));
    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ year: number; month: number | null }>) {
      if (row.month === null) continue;
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * 納得した / 少し違う.
   *
   * The one thing on this screen the person writes. It is stored beside the
   * reading rather than over it: a correction is information about the
   * reading, and losing what was corrected would lose the correction too.
   */
  async setChangeVerdict(input: {
    changeId: string;
    verdict: ProgressionVerdict;
  }): Promise<Change> {
    const { error } = await this.client
      .from('changes')
      .update({ verdict: input.verdict, user_edited: input.verdict === 'adjusted' })
      .eq('id', input.changeId);
    if (error) throw error;

    const { data, error: readError } = await this.client
      .from('changes')
      .select('year, month')
      .eq('id', input.changeId)
      .single();
    if (readError) throw readError;

    const row = data as { year: number; month: number | null };
    const monthKey = `${row.year}-${String(row.month ?? 1).padStart(2, '0')}`;
    const updated = (await this.listMonthChanges(monthKey)).find((c) => c.id === input.changeId);
    if (!updated) throw new Error('change not found after update');
    return updated;
  }

  async getMonthReview(periodKey: string): Promise<MonthReview | null> {
    const { data, error } = await this.client
      .from('month_reviews')
      .select(REVIEW_COLUMNS)
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapReview(data as MonthReviewRow) : null;
  }

  async listMonthReviews(yearKey: string): Promise<MonthReview[]> {
    const { data, error } = await this.client
      .from('month_reviews')
      .select(REVIEW_COLUMNS)
      .gte('period_key', `${yearKey}-01`)
      .lte('period_key', `${yearKey}-12`);
    if (error) throw error;
    return ((data ?? []) as MonthReviewRow[]).map(mapReview);
  }

  async saveMonthReview(review: MonthReview): Promise<MonthReview> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('month_reviews')
      .upsert(
        {
          user_id: userId,
          period_key: review.periodKey,
          initial_theme: review.initialTheme,
          what_actually_happened: review.whatActuallyHappened,
          progressions: review.changed,
          gained: review.gained,
          title_candidates: review.titleCandidates,
          title: review.title,
          subtitle: review.subtitle,
        },
        { onConflict: 'user_id,period_key' }
      )
      .select(REVIEW_COLUMNS)
      .single();
    if (error) throw error;
    return mapReview(data as MonthReviewRow);
  }

  async getYearReview(year: number): Promise<YearReview | null> {
    const { data, error } = await this.client
      .from('year_reviews')
      .select(YEAR_REVIEW_COLUMNS)
      .eq('year', year)
      .maybeSingle();
    if (error) throw error;
    return data ? mapYearReview(data as YearReviewRow) : null;
  }

  async saveYearReview(review: YearReview): Promise<YearReview> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('year_reviews')
      .upsert(
        {
          user_id: userId,
          year: review.year,
          initial_theme: review.initialTheme,
          actual_story: review.actualStory,
          progressions: review.progressions,
          gained: review.gained,
          title_candidates: review.titleCandidates,
        },
        { onConflict: 'user_id,year' }
      )
      .select(YEAR_REVIEW_COLUMNS)
      .single();
    if (error) throw error;
    return mapYearReview(data as YearReviewRow);
  }
}

