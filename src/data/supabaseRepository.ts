import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Clarification,
  EntryAnalysis,
  EntrySignals,
  EntryType,
  EntryWithAnalysis,
  Gain,
  JournalEntry,
  JourneyRole,
  MonthProgression,
  MonthReview,
  MonthReviewProgression,
  NewEntryInput,
  Progression,
  ProgressionDetail,
  ProgressionEvidenceRole,
  ProgressionMaturity,
  ProgressionRef,
  ProgressionStep,
  ProgressionType,
  ProgressionVerdict,
  SubjectiveSignal,
} from '@/types';
import { requireSupabase } from '@/lib/supabase';
import { monthRange } from '@/utils/period';
import { emptySignals, maturityCeiling, minMaturity, summariseEvidencePath } from '@/ai/progressionRules';
import type { Repository } from './repository';

const LOG_COLUMNS = 'id, user_id, occurred_on, occurred_at, type, subjective_signal, body, created_at';
const ANALYSIS_COLUMNS =
  'log_id, event_summary, topics, actors, environment, action, outcome, reaction, hypothesis, future_intention, journey_role, signals, confidence, updated_at';

interface LogRow {
  id: string;
  user_id: string;
  occurred_on: string;
  occurred_at: string;
  type: EntryType;
  subjective_signal: SubjectiveSignal;
  body: string;
  created_at: string;
}

interface AnalysisRow {
  log_id: string;
  event_summary: string | null;
  topics: string[] | null;
  actors: string[] | null;
  environment: string[] | null;
  action: string | null;
  outcome: string | null;
  reaction: string | null;
  hypothesis: string | null;
  future_intention: string | null;
  journey_role: JourneyRole | null;
  signals: Partial<EntrySignals> | null;
  confidence: number | null;
  updated_at?: string | null;
}

interface ProgressionRow {
  id: string;
  user_id: string;
  type: ProgressionType;
  title: string;
  from_state: string | null;
  current_state: string | null;
  summary: string;
  maturity: ProgressionMaturity;
  confidence: number;
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
  progression_id: string;
  label: string;
  description: string | null;
  confidence: number;
  first_detected_at: string;
  last_detected_at: string;
}

interface ClarificationRow {
  id: string;
  log_id: string;
  question: string;
  options: string[] | null;
  answer: string | null;
}

interface MonthReviewRow {
  period_key: string;
  title: string;
  subtitle: string;
  progressions: MonthReviewProgression[] | null;
  carrying_forward: string;
  created_at: string;
}

function mapEntry(row: LogRow, analysis?: AnalysisRow): EntryWithAnalysis {
  const base: JournalEntry = {
    id: row.id,
    userId: row.user_id,
    occurredAt: row.occurred_at,
    occurredOn: row.occurred_on,
    type: row.type,
    body: row.body,
    subjectiveSignal: row.subjective_signal,
    createdAt: row.created_at,
  };
  return analysis ? { ...base, analysis: mapAnalysis(analysis) } : base;
}

function mapAnalysis(row: AnalysisRow): EntryAnalysis {
  const signals = { ...emptySignals(), ...(row.signals ?? {}) } as EntrySignals;
  return {
    logId: row.log_id,
    eventSummary: row.event_summary ?? '',
    topics: row.topics ?? [],
    actors: row.actors ?? [],
    environment: row.environment ?? [],
    action: row.action ?? undefined,
    outcome: row.outcome ?? undefined,
    reaction: row.reaction ?? undefined,
    hypothesis: row.hypothesis ?? undefined,
    futureIntention: row.future_intention ?? undefined,
    journeyRole: row.journey_role ?? 'neutral',
    signals,
    confidence: row.confidence ?? 0,
    analyzedAt: row.updated_at ?? undefined,
  };
}

function mapProgression(row: ProgressionRow, evidenceCount = 0): Progression {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    fromState: row.from_state ?? undefined,
    currentState: row.current_state ?? undefined,
    summary: row.summary,
    maturity: row.maturity,
    confidence: row.confidence,
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
    progressionId: row.progression_id,
    label: row.label,
    description: row.description ?? undefined,
    confidence: row.confidence,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
  };
}

function mapReview(row: MonthReviewRow): MonthReview {
  return {
    periodKey: row.period_key,
    title: row.title,
    subtitle: row.subtitle,
    progressions: (row.progressions ?? []).slice(0, 3),
    carryingForward: row.carrying_forward ?? '',
    createdAt: row.created_at,
  };
}

/** A merged progression resolves to whatever now stands for it (§30). */
function resolveMerged(
  progression: Progression,
  byId: Map<string, Progression>
): Progression {
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
 * here filters by user id except the writes that have to name one. What the
 * Edge Functions produce — progressions, evidence, gains — is read-only from
 * the app, with the two exceptions the person owns: their verdict and their
 * answer to a clarification.
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

  /**
   * Nothing to seed: no categories, no drawers, no onboarding. The profile row
   * comes from a signup trigger; this only repairs an account predating it.
   */
  async ensureBootstrapped(): Promise<void> {
    const userId = await this.userId();
    await this.client
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // -------------------------------------------------------------------------
  // Entries
  // -------------------------------------------------------------------------

  private async listEntriesBetween(from: string, to: string): Promise<EntryWithAnalysis[]> {
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
    return rows.map((row) => mapEntry(row, byLog.get(row.id)));
  }

  async listEntriesByMonth(monthKey: string): Promise<EntryWithAnalysis[]> {
    const { from, to } = monthRange(monthKey);
    return this.listEntriesBetween(from, to);
  }

  async listEntriesByYear(yearKey: string): Promise<EntryWithAnalysis[]> {
    return this.listEntriesBetween(`${yearKey}-01-01`, `${yearKey}-12-31`);
  }

  async getEntry(id: string): Promise<EntryWithAnalysis | null> {
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

    const entry = mapEntry(data as LogRow, (analysis as AnalysisRow | null) ?? undefined);
    const rows = (evidence ?? []) as EvidenceRow[];
    if (rows.length === 0) return entry;

    const byId = await this.progressionsById();
    const refs: ProgressionRef[] = [];
    for (const row of rows) {
      const raw = byId.get(row.progression_id);
      if (!raw) continue;
      const resolved = resolveMerged(raw, byId);
      if (refs.some((r) => r.id === resolved.id)) continue;
      refs.push({ id: resolved.id, title: resolved.title, role: row.role });
    }
    return { ...entry, progressions: refs };
  }

  async createEntry(input: NewEntryInput): Promise<JournalEntry> {
    const userId = await this.userId();
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('logs')
      .insert({
        user_id: userId,
        occurred_at: occurredAt,
        occurred_on: occurredAt.slice(0, 10),
        type: input.type,
        subjective_signal: input.subjectiveSignal,
        body: input.body.trim(),
      })
      .select(LOG_COLUMNS)
      .single();
    if (error) throw error;
    return mapEntry(data as LogRow);
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.client.from('logs').delete().eq('id', id);
    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // Progressions
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

    // The whole path, not just this month's slice: §24 asks where each
    // progression stood at the end of the month, which needs its history too.
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
          eventSummary: summaryById.get(log.id) || log.body.slice(0, 80),
          entryType: log.type,
          subjectiveSignal: log.subjective_signal,
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
    // Only a rewrite counts as an edit; agreeing does not freeze the wording.
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

  // -------------------------------------------------------------------------
  // Clarification (§14)
  // -------------------------------------------------------------------------

  async getPendingClarification(): Promise<Clarification | null> {
    const { data, error } = await this.client
      .from('clarifications')
      .select('id, log_id, question, options, answer')
      .is('answer', null)
      .order('asked_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as ClarificationRow;
    return {
      id: row.id,
      logId: row.log_id,
      question: row.question,
      options: row.options ?? [],
      answer: row.answer ?? undefined,
    };
  }

  async answerClarification(input: { id: string; answer: string | null }): Promise<void> {
    // A skip is an answer: stored as empty so the same question is not reasked.
    const { error } = await this.client
      .from('clarifications')
      .update({ answer: input.answer ?? '', answered_at: new Date().toISOString() })
      .eq('id', input.id);
    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // Month
  // -------------------------------------------------------------------------

  async getMonthReview(periodKey: string): Promise<MonthReview | null> {
    const { data, error } = await this.client
      .from('month_reviews')
      .select('period_key, title, subtitle, progressions, carrying_forward, created_at')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapReview(data as MonthReviewRow) : null;
  }

  async listMonthReviews(yearKey: string): Promise<MonthReview[]> {
    const { data, error } = await this.client
      .from('month_reviews')
      .select('period_key, title, subtitle, progressions, carrying_forward, created_at')
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
          title: review.title,
          subtitle: review.subtitle,
          progressions: review.progressions,
          carrying_forward: review.carryingForward,
        },
        { onConflict: 'user_id,period_key' }
      )
      .select('period_key, title, subtitle, progressions, carrying_forward, created_at')
      .single();
    if (error) throw error;
    return mapReview(data as MonthReviewRow);
  }
}
