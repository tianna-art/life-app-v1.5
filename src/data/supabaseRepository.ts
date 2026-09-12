import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { ANTENNAS, ANTENNA_ORDER } from '@/constants/generated/preview';
import { monthKeyOf } from '@/utils/period';
import type {
  AntennaId,
  Category,
  CategoryDetail,
  FlowSession,
  FlowStage,
  FutureMemo,
  JournalLog,
  MonthDirection,
  MonthHypothesis,
  MonthInsight,
  MonthSummary,
  NewFutureMemoInput,
  NewLogInput,
  PeriodTitle,
  PeriodType,
  VisionItem,
  VisionWord,
  YearDirection,
  YearDirectionChange,
} from '@/types';
import type { Repository } from './repository';

/**
 * Supabase-backed storage.
 *
 * Every table is protected by RLS on `user_id = auth.uid()`, so no query here
 * filters by user: the database does it, and a query that forgot to would
 * return nothing rather than someone else's month.
 *
 * The reading tables — month_summaries, month_insights, month_hypotheses — are
 * read here and never written: an Edge Function owns them, because a client
 * that can write its own reading can write one with nothing behind it.
 */
export class SupabaseRepository implements Repository {
  private get client(): SupabaseClient {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured.');
    return client;
  }

  private async userId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error('Not authenticated.');
    return data.user.id;
  }

  async ensureBootstrapped(): Promise<void> {
    const userId = await this.userId();
    await this.client.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // -- ビジョンボード -------------------------------------------------------

  async listVisionItems(): Promise<VisionItem[]> {
    const { data, error } = await this.client
      .from('vision_items')
      .select('id, text, sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, text: r.text, sortOrder: r.sort_order }));
  }

  async listVisionWords(): Promise<VisionWord[]> {
    const { data, error } = await this.client
      .from('vision_words')
      .select('id, text, sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, text: r.text, sortOrder: r.sort_order }));
  }

  private async addVision(table: 'vision_items' | 'vision_words', text: string) {
    const userId = await this.userId();
    const { count } = await this.client
      .from(table)
      .select('id', { count: 'exact', head: true });
    const { data, error } = await this.client
      .from(table)
      .insert({ user_id: userId, text: text.trim(), sort_order: count ?? 0 })
      .select('id, text, sort_order')
      .single();
    if (error) throw error;
    return { id: data.id, text: data.text, sortOrder: data.sort_order };
  }

  addVisionItem(text: string): Promise<VisionItem> {
    return this.addVision('vision_items', text);
  }

  addVisionWord(text: string): Promise<VisionWord> {
    return this.addVision('vision_words', text);
  }

  async removeVisionItem(id: string): Promise<void> {
    const { error } = await this.client.from('vision_items').delete().eq('id', id);
    if (error) throw error;
  }

  async removeVisionWord(id: string): Promise<void> {
    const { error } = await this.client.from('vision_words').delete().eq('id', id);
    if (error) throw error;
  }

  // -- 方向 -----------------------------------------------------------------

  async getYearDirection(year: number): Promise<YearDirection | null> {
    const { data, error } = await this.client
      .from('year_directions')
      .select('year, direction, keywords, answers, updated_at')
      .eq('year', year)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      year: data.year,
      direction: data.direction,
      keywords: data.keywords ?? [],
      answers: data.answers ?? [],
      updatedAt: data.updated_at,
    };
  }

  async saveYearDirection(input: {
    year: number;
    direction: string;
    keywords?: string[];
    answers?: string[];
  }): Promise<YearDirection> {
    const userId = await this.userId();
    const previous = await this.getYearDirection(input.year);
    const direction = input.direction.trim();

    // The replaced sentence is kept before the new one lands, so a failure
    // half-way leaves the old direction standing rather than losing both.
    if (previous && previous.direction !== direction) {
      const { error } = await this.client.from('year_direction_history').insert({
        user_id: userId,
        year: input.year,
        direction: previous.direction,
      });
      if (error) throw error;
    }

    const { data, error } = await this.client
      .from('year_directions')
      .upsert(
        {
          user_id: userId,
          year: input.year,
          direction,
          keywords: input.keywords ?? previous?.keywords ?? [],
          answers: input.answers ?? previous?.answers ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,year' }
      )
      .select('year, direction, keywords, answers, updated_at')
      .single();
    if (error) throw error;
    return {
      year: data.year,
      direction: data.direction,
      keywords: data.keywords ?? [],
      answers: data.answers ?? [],
      updatedAt: data.updated_at,
    };
  }

  async listYearDirectionHistory(year: number): Promise<YearDirectionChange[]> {
    const { data, error } = await this.client
      .from('year_direction_history')
      .select('id, year, direction, replaced_at')
      .eq('year', year)
      .order('replaced_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      year: r.year,
      direction: r.direction,
      replacedAt: r.replaced_at,
    }));
  }

  async getMonthDirection(periodKey: string): Promise<MonthDirection | null> {
    const { data, error } = await this.client
      .from('month_directions')
      .select('period_key, antenna_ids, updated_at')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      periodKey: data.period_key,
      antennaIds: (data.antenna_ids ?? []) as AntennaId[],
      updatedAt: data.updated_at,
    };
  }

  async saveMonthDirection(periodKey: string, antennaIds: string[]): Promise<MonthDirection> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('month_directions')
      .upsert(
        {
          user_id: userId,
          period_key: periodKey,
          antenna_ids: antennaIds.slice(0, 2),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_key' }
      )
      .select('period_key, antenna_ids, updated_at')
      .single();
    if (error) throw error;
    return {
      periodKey: data.period_key,
      antennaIds: (data.antenna_ids ?? []) as AntennaId[],
      updatedAt: data.updated_at,
    };
  }

  // -- カテゴリー -----------------------------------------------------------
  // The tree is identical for everyone and lives in the preview, so it is not
  // stored: rows would only give it a way to drift from the specification.

  async listCategories(): Promise<Category[]> {
    return CATEGORIES;
  }

  async listCategoryDetails(categoryId: string): Promise<CategoryDetail[]> {
    return DETAILS.filter((d) => d.categoryId === categoryId);
  }

  // -- 記録 -----------------------------------------------------------------

  private static readonly LOG_COLUMNS =
    'id, user_id, occurred_on, period_key, body, category_id, detail_id, input_method, source, source_id, created_at';

  async listLogs(periodKey: string): Promise<JournalLog[]> {
    const { data, error } = await this.client
      .from('logs')
      .select(SupabaseRepository.LOG_COLUMNS)
      .eq('period_key', periodKey)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapLog);
  }

  async listLogsInYear(year: number): Promise<JournalLog[]> {
    const { data, error } = await this.client
      .from('logs')
      .select(SupabaseRepository.LOG_COLUMNS)
      .like('period_key', `${year}-%`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapLog);
  }

  async getLogs(ids: string[]): Promise<JournalLog[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from('logs')
      .select(SupabaseRepository.LOG_COLUMNS)
      .in('id', ids);
    if (error) throw error;
    return (data ?? []).map(mapLog);
  }

  async createLog(input: NewLogInput): Promise<JournalLog> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('logs')
      .insert({
        user_id: userId,
        occurred_on: input.occurredOn,
        period_key: input.periodKey || monthKeyOf(new Date()),
        body: input.body.trim(),
        category_id: input.categoryId ?? null,
        detail_id: input.detailId ?? null,
        input_method: input.inputMethod ?? 'typed',
        source: input.source ?? 'manual',
        source_id: input.sourceId ?? null,
      })
      .select(SupabaseRepository.LOG_COLUMNS)
      .single();
    if (error) throw error;
    return mapLog(data);
  }

  async deleteLog(id: string): Promise<void> {
    const { error } = await this.client.from('logs').delete().eq('id', id);
    if (error) throw error;
  }

  // -- 未来メモ -------------------------------------------------------------

  private static readonly MEMO_COLUMNS =
    'id, type, title, memo, target_date, date_kind, favorite, status, completed_at, heart_tags, created_at';

  async listFutureMemos(): Promise<FutureMemo[]> {
    const { data, error } = await this.client
      .from('future_memos')
      .select(SupabaseRepository.MEMO_COLUMNS)
      .neq('status', 'trashed')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMemo);
  }

  async createFutureMemo(input: NewFutureMemoInput): Promise<FutureMemo> {
    const userId = await this.userId();
    const dateKind = input.dateKind ?? 'none';
    const { data, error } = await this.client
      .from('future_memos')
      .insert({
        user_id: userId,
        type: input.type,
        title: input.title.trim(),
        memo: input.memo?.trim() ?? '',
        date_kind: dateKind,
        target_date: dateKind === 'none' ? null : (input.targetDate ?? null),
        favorite: input.favorite ?? false,
      })
      .select(SupabaseRepository.MEMO_COLUMNS)
      .single();
    if (error) throw error;
    return mapMemo(data);
  }

  async updateFutureMemo(id: string, patch: Partial<FutureMemo>): Promise<FutureMemo> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.memo !== undefined) row.memo = patch.memo.trim();
    if (patch.dateKind !== undefined) row.date_kind = patch.dateKind;
    if (patch.targetDate !== undefined) row.target_date = patch.targetDate;
    if (patch.favorite !== undefined) row.favorite = patch.favorite;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
    if (patch.heartTags !== undefined) row.heart_tags = patch.heartTags;
    // The constraint pairs them, so clearing the kind clears the date with it.
    if (patch.dateKind === 'none') row.target_date = null;

    const { data, error } = await this.client
      .from('future_memos')
      .update(row)
      .eq('id', id)
      .select(SupabaseRepository.MEMO_COLUMNS)
      .single();
    if (error) throw error;
    return mapMemo(data);
  }

  // -- 感情クエスト ---------------------------------------------------------

  async lastFlowSession(): Promise<FlowSession | null> {
    const { data, error } = await this.client
      .from('flow_sessions')
      .select('id, entries, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, entries: data.entries ?? {}, createdAt: data.created_at };
  }

  async saveFlowSession(entries: Partial<Record<FlowStage, string>>): Promise<FlowSession> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('flow_sessions')
      .insert({ user_id: userId, entries })
      .select('id, entries, created_at')
      .single();
    if (error) throw error;
    return { id: data.id, entries: data.entries ?? {}, createdAt: data.created_at };
  }

  // -- 読み取り（read only） -------------------------------------------------

  async getMonthSummary(periodKey: string): Promise<MonthSummary | null> {
    const { data, error } = await this.client
      .from('month_summaries')
      .select('period_key, keywords, body, updated_at')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      periodKey: data.period_key,
      keywords: data.keywords ?? [],
      body: data.body,
      updatedAt: data.updated_at,
    };
  }

  async listMonthInsights(periodKey: string): Promise<MonthInsight[]> {
    const { data, error } = await this.client
      .from('month_insights')
      .select('id, period_key, antenna_id, label, text, why, note, evidence_log_ids')
      .eq('period_key', periodKey);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      periodKey: r.period_key,
      antennaId: r.antenna_id as AntennaId,
      label: r.label,
      text: r.text,
      why: r.why ?? '',
      note: r.note ?? '',
      evidenceLogIds: r.evidence_log_ids ?? [],
    }));
  }

  async getMonthHypothesis(periodKey: string): Promise<MonthHypothesis | null> {
    const { data, error } = await this.client
      .from('month_hypotheses')
      .select('period_key, text, updated_at')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { periodKey: data.period_key, text: data.text, updatedAt: data.updated_at };
  }

  // -- 足跡タイトル ---------------------------------------------------------

  async listPeriodTitles(periodType: PeriodType): Promise<PeriodTitle[]> {
    const { data, error } = await this.client
      .from('period_titles')
      .select('period_type, period_key, title, source, updated_at')
      .eq('period_type', periodType)
      .order('period_key', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      periodType: r.period_type as PeriodType,
      periodKey: r.period_key,
      title: r.title,
      source: r.source as 'manual' | 'ai',
      updatedAt: r.updated_at,
    }));
  }

  async savePeriodTitle(input: {
    periodType: PeriodType;
    periodKey: string;
    title: string;
    source?: 'manual' | 'ai';
  }): Promise<PeriodTitle> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('period_titles')
      .upsert(
        {
          user_id: userId,
          period_type: input.periodType,
          period_key: input.periodKey,
          title: input.title.trim(),
          source: input.source ?? 'manual',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_type,period_key' }
      )
      .select('period_type, period_key, title, source, updated_at')
      .single();
    if (error) throw error;
    return {
      periodType: data.period_type as PeriodType,
      periodKey: data.period_key,
      title: data.title,
      source: data.source as 'manual' | 'ai',
      updatedAt: data.updated_at,
    };
  }
}

interface LogRow {
  id: string;
  user_id: string;
  occurred_on: string | null;
  period_key: string;
  body: string;
  category_id: string | null;
  detail_id: string | null;
  input_method: 'typed' | 'voice';
  source: 'manual' | 'future_memo' | 'flow';
  source_id: string | null;
  created_at: string;
}

function mapLog(row: LogRow): JournalLog {
  return {
    id: row.id,
    userId: row.user_id,
    occurredOn: row.occurred_on,
    periodKey: row.period_key,
    body: row.body,
    categoryId: row.category_id,
    detailId: row.detail_id,
    inputMethod: row.input_method,
    source: row.source,
    sourceId: row.source_id,
    createdAt: row.created_at,
  };
}

interface MemoRow {
  id: string;
  type: FutureMemo['type'];
  title: string;
  memo: string;
  target_date: string | null;
  date_kind: FutureMemo['dateKind'];
  favorite: boolean;
  status: FutureMemo['status'];
  completed_at: string | null;
  heart_tags: string[] | null;
  created_at: string;
}

function mapMemo(row: MemoRow): FutureMemo {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    memo: row.memo,
    targetDate: row.target_date,
    dateKind: row.date_kind,
    favorite: row.favorite,
    status: row.status,
    completedAt: row.completed_at,
    heartTags: row.heart_tags ?? [],
    createdAt: row.created_at,
  };
}

const CATEGORIES: Category[] = ANTENNA_ORDER.flatMap((antennaId, antennaIndex) =>
  ANTENNAS[antennaId].categories.map((category, index) => ({
    id: category.id,
    antennaId,
    label: category.label,
    detailQuestion: category.detailQuestion,
    sortOrder: antennaIndex * 100 + index,
    isActive: true,
  }))
);

const DETAILS: CategoryDetail[] = ANTENNA_ORDER.flatMap((antennaId) =>
  ANTENNAS[antennaId].categories.flatMap((category) =>
    category.details.map((detail, index) => ({
      id: detail.id,
      categoryId: category.id,
      label: detail.label,
      sortOrder: index,
    }))
  )
);
