import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EntryAnalysis,
  EntryWithAnalysis,
  Gain,
  GainDetail,
  GainFormationStep,
  GainVerdict,
  GainType,
  InputCategory,
  JournalEntry,
  MonthReview,
  NewEntryInput,
} from '@/types';
import { requireSupabase } from '@/lib/supabase';
import { monthRange } from '@/utils/period';
import type { MonthGain, Repository } from './repository';

interface LogRow {
  id: string;
  user_id: string;
  occurred_on: string;
  occurred_at: string;
  input_category: InputCategory;
  body: string;
  created_at: string;
}

interface AnalysisRow {
  log_id: string;
  event_summary: string | null;
  journey_role: EntryAnalysis['journeyRole'] | null;
  gain_status: EntryAnalysis['gainStatus'] | null;
  semantic_tags: string[] | null;
  updated_at?: string | null;
}

interface GainRow {
  id: string;
  user_id: string;
  type: GainType;
  label: string;
  maturity: Gain['maturity'];
  confidence: number;
  first_detected_at: string;
  last_detected_at: string;
  verdict: GainVerdict | null;
  merged_into_id: string | null;
}

interface EvidenceRow {
  gain_id: string;
  log_id: string;
  relation: GainDetail['formation'][number]['relation'];
  note: string | null;
}

interface MonthReviewRow {
  period_key: string;
  title: string;
  subtitle: string;
  gains: string[] | null;
  one_change: string;
  created_at: string;
}

function mapEntry(row: LogRow, analysis?: AnalysisRow): EntryWithAnalysis {
  const base: JournalEntry = {
    id: row.id,
    userId: row.user_id,
    occurredAt: row.occurred_at,
    occurredOn: row.occurred_on,
    inputCategory: row.input_category,
    body: row.body,
    createdAt: row.created_at,
  };
  if (!analysis) return base;
  return { ...base, analysis: mapAnalysis(analysis) };
}

function mapAnalysis(row: AnalysisRow): EntryAnalysis {
  return {
    logId: row.log_id,
    eventSummary: row.event_summary ?? '',
    journeyRole: row.journey_role ?? 'neutral',
    gainStatus: row.gain_status ?? 'unresolved',
    semanticTags: row.semantic_tags ?? [],
    analyzedAt: row.updated_at ?? undefined,
  };
}

function mapGain(row: GainRow): Gain {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    label: row.label,
    maturity: row.maturity,
    confidence: row.confidence,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
    verdict: row.verdict ?? undefined,
    mergedIntoId: row.merged_into_id ?? undefined,
  };
}

function mapReview(row: MonthReviewRow): MonthReview {
  return {
    periodKey: row.period_key,
    title: row.title,
    subtitle: row.subtitle ?? '',
    gains: Array.isArray(row.gains) ? row.gains.slice(0, 3) : [],
    oneChange: row.one_change ?? '',
    createdAt: row.created_at,
  };
}

/**
 * A gain that was folded into a broader one keeps its row so its evidence is
 * never orphaned; reads follow the chain to whatever is standing now.
 */
function resolveMerged(gain: Gain, byId: Map<string, Gain>): Gain {
  let current = gain;
  const seen = new Set<string>([current.id]);
  while (current.mergedIntoId) {
    const next = byId.get(current.mergedIntoId);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    current = next;
  }
  return current;
}

/** Supabase-backed repository. Every read/write is scoped by RLS to auth.uid(). */
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
   * There is nothing to seed any more — no categories, no drawers, no
   * onboarding. The profile row is created by a trigger on signup; this only
   * repairs an account that predates it.
   */
  async ensureBootstrapped(): Promise<void> {
    const userId = await this.userId();
    await this.client
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  }

  private async listEntriesBetween(from: string, to: string): Promise<EntryWithAnalysis[]> {
    const { data, error } = await this.client
      .from('logs')
      .select('id, user_id, occurred_on, occurred_at, input_category, body, created_at')
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as LogRow[];
    if (rows.length === 0) return [];

    const { data: analyses, error: analysisError } = await this.client
      .from('log_ai_analysis')
      .select('log_id, event_summary, journey_role, gain_status, semantic_tags, updated_at')
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
      .select('id, user_id, occurred_on, occurred_at, input_category, body, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const [{ data: analysis }, { data: evidence }] = await Promise.all([
      this.client
        .from('log_ai_analysis')
        .select('log_id, event_summary, journey_role, gain_status, semantic_tags, updated_at')
        .eq('log_id', id)
        .maybeSingle(),
      this.client.from('gain_evidence').select('gain_id, log_id, relation, note').eq('log_id', id),
    ]);

    const entry = mapEntry(data as LogRow, (analysis as AnalysisRow | null) ?? undefined);
    const gainIds = ((evidence ?? []) as EvidenceRow[]).map((e) => e.gain_id);
    if (gainIds.length === 0) return entry;

    const gains = await this.loadGains(gainIds);
    return { ...entry, gains };
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
        input_category: input.inputCategory,
        body: input.body.trim(),
      })
      .select('id, user_id, occurred_on, occurred_at, input_category, body, created_at')
      .single();
    if (error) throw error;
    return mapEntry(data as LogRow);
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.client.from('logs').delete().eq('id', id);
    if (error) throw error;
  }

  private async loadGains(ids: string[]): Promise<Gain[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client.from('gains').select('*');
    if (error) throw error;
    const all = ((data ?? []) as GainRow[]).map(mapGain);
    const byId = new Map(all.map((g) => [g.id, g]));
    const wanted = new Set(ids);
    const resolved = new Map<string, Gain>();
    for (const gain of all) {
      if (!wanted.has(gain.id)) continue;
      const target = resolveMerged(gain, byId);
      resolved.set(target.id, target);
    }
    return [...resolved.values()];
  }

  async listGains(): Promise<Gain[]> {
    const { data, error } = await this.client
      .from('gains')
      .select('*')
      .is('merged_into_id', null)
      .order('last_detected_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as GainRow[]).map(mapGain);
  }

  async listMonthGains(monthKey: string): Promise<MonthGain[]> {
    const { from, to } = monthRange(monthKey);
    const { data: logs, error: logError } = await this.client
      .from('logs')
      .select('id')
      .gte('occurred_on', from)
      .lte('occurred_on', to);
    if (logError) throw logError;
    const logIds = ((logs ?? []) as Array<{ id: string }>).map((l) => l.id);
    if (logIds.length === 0) return [];

    const { data: evidence, error: evidenceError } = await this.client
      .from('gain_evidence')
      .select('gain_id, log_id, relation, note')
      .in('log_id', logIds);
    if (evidenceError) throw evidenceError;
    const rows = (evidence ?? []) as EvidenceRow[];
    if (rows.length === 0) return [];

    const { data: gainRows, error: gainError } = await this.client.from('gains').select('*');
    if (gainError) throw gainError;
    const all = ((gainRows ?? []) as GainRow[]).map(mapGain);
    const byId = new Map(all.map((g) => [g.id, g]));

    const grouped = new Map<string, Set<string>>();
    for (const row of rows) {
      const source = byId.get(row.gain_id);
      if (!source) continue;
      const target = resolveMerged(source, byId);
      const set = grouped.get(target.id) ?? new Set<string>();
      set.add(row.log_id);
      grouped.set(target.id, set);
    }

    return [...grouped.entries()]
      .map(([gainId, ids]) => {
        const gain = byId.get(gainId);
        if (!gain) return null;
        return {
          gain,
          evidenceLogIds: [...ids],
          isNew: gain.firstDetectedAt.slice(0, 7) === monthKey,
        } satisfies MonthGain;
      })
      .filter((g): g is MonthGain => g !== null);
  }

  async getGainDetail(gainId: string): Promise<GainDetail | null> {
    const { data: gainRow, error } = await this.client
      .from('gains')
      .select('*')
      .eq('id', gainId)
      .maybeSingle();
    if (error) throw error;
    if (!gainRow) return null;
    const gain = mapGain(gainRow as GainRow);

    const { data: evidence, error: evidenceError } = await this.client
      .from('gain_evidence')
      .select('gain_id, log_id, relation, note')
      .eq('gain_id', gainId);
    if (evidenceError) throw evidenceError;
    const rows = (evidence ?? []) as EvidenceRow[];
    if (rows.length === 0) return { gain, formation: [] };

    const logIds = rows.map((r) => r.log_id);
    const [{ data: logs }, { data: analyses }] = await Promise.all([
      this.client.from('logs').select('id, occurred_on, body').in('id', logIds),
      this.client
        .from('log_ai_analysis')
        .select('log_id, event_summary, journey_role, gain_status, semantic_tags')
        .in('log_id', logIds),
    ]);

    const logById = new Map(
      ((logs ?? []) as Array<{ id: string; occurred_on: string; body: string }>).map((l) => [
        l.id,
        l,
      ])
    );
    const analysisById = new Map(((analyses ?? []) as AnalysisRow[]).map((a) => [a.log_id, a]));

    const formation: GainFormationStep[] = rows
      .map((row) => {
        const log = logById.get(row.log_id);
        if (!log) return null;
        const analysis = analysisById.get(row.log_id);
        return {
          logId: row.log_id,
          occurredOn: log.occurred_on,
          journeyRole: analysis?.journey_role ?? 'neutral',
          eventSummary: analysis?.event_summary ?? log.body,
          relation: row.relation,
        } satisfies GainFormationStep;
      })
      .filter((s): s is GainFormationStep => s !== null)
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

    return { gain, formation };
  }

  async setGainVerdict(input: {
    gainId: string;
    verdict: GainVerdict;
    label?: string;
  }): Promise<Gain> {
    const patch: Record<string, unknown> = {
      verdict: input.verdict,
      updated_at: new Date().toISOString(),
    };
    const label = input.label?.trim();
    if (label) patch.label = label;

    const { data, error } = await this.client
      .from('gains')
      .update(patch)
      .eq('id', input.gainId)
      .select()
      .single();
    if (error) throw error;
    return mapGain(data as GainRow);
  }

  async getMonthReview(periodKey: string): Promise<MonthReview | null> {
    const { data, error } = await this.client
      .from('month_reviews')
      .select('period_key, title, subtitle, gains, one_change, created_at')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapReview(data as MonthReviewRow) : null;
  }

  async listMonthReviews(yearKey: string): Promise<MonthReview[]> {
    const { data, error } = await this.client
      .from('month_reviews')
      .select('period_key, title, subtitle, gains, one_change, created_at')
      .like('period_key', `${yearKey}-%`);
    if (error) throw error;
    return ((data ?? []) as MonthReviewRow[]).map(mapReview);
  }

  /**
   * Month reviews are written by the Edge Function under the service role;
   * a client-side write would be rejected by RLS. The local store implements
   * this for real — here it is a read-back so callers stay uniform.
   */
  async saveMonthReview(review: MonthReview): Promise<MonthReview> {
    return (await this.getMonthReview(review.periodKey)) ?? review;
  }
}
