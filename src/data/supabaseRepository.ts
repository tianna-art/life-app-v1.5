import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { coerceIcon, type CategoryIcon } from '@/constants/icons';
import type {
  Category,
  CategoryInsight,
  JournalLog,
  KeywordCandidate,
  LogWithAnalysis,
  MonthlyIntention,
  NewLogInput,
  PeriodTitle,
  PeriodType,
  ReviewStatus,
} from '@/types';
import { slugify } from '@/utils/id';
import { todayIso } from '@/utils/period';
import { requireSupabase } from '@/lib/supabase';
import type { Repository } from './repository';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  prompt_examples: string[] | null;
  /** Optional on the wire: a database that has not run the icons migration
   *  yet simply does not send it, and the row still reads fine. */
  icon?: string | null;
}

interface LogRow {
  id: string;
  user_id: string;
  occurred_on: string;
  type: 'event' | 'thought';
  category_id: string;
  body: string;
  created_at: string;
}

interface AnalysisRow {
  log_id: string;
  keywords: string[] | null;
  semantic_tags: string[] | null;
  tone: string | null;
  confidence: number | null;
}

interface TitleRow {
  period_type: PeriodType;
  period_key: string;
  title: string;
  source: 'manual' | 'ai';
  is_confirmed: boolean;
}

interface InsightRow {
  id: string;
  period_type: PeriodType;
  period_key: string;
  category_id: string;
  insight: string;
  keywords: KeywordCandidate[] | null;
  status: ReviewStatus;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isDefault: row.is_default,
    icon: coerceIcon(row.icon, row.slug),
    promptExamples: row.prompt_examples ?? [],
  };
}

function mapLog(row: LogRow, analysis?: AnalysisRow): LogWithAnalysis {
  const base: JournalLog = {
    id: row.id,
    userId: row.user_id,
    occurredOn: row.occurred_on,
    type: row.type,
    categoryId: row.category_id,
    body: row.body,
    createdAt: row.created_at,
  };
  if (!analysis) return base;
  return {
    ...base,
    analysis: {
      logId: analysis.log_id,
      keywords: analysis.keywords ?? [],
      semanticTags: analysis.semantic_tags ?? [],
      tone: analysis.tone ?? undefined,
      confidence: analysis.confidence ?? undefined,
    },
  };
}

function mapTitle(row: TitleRow): PeriodTitle {
  return {
    periodType: row.period_type,
    periodKey: row.period_key,
    title: row.title,
    source: row.source,
    isConfirmed: row.is_confirmed,
  };
}

function mapInsight(row: InsightRow): CategoryInsight {
  return {
    id: row.id,
    periodType: row.period_type,
    periodKey: row.period_key,
    categoryId: row.category_id,
    insight: row.insight,
    keywords: row.keywords ?? [],
    status: row.status,
  };
}

function monthRange(monthKey: string): { from: string; to: string } {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const last = new Date(year, month, 0).getDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(last).padStart(2, '0')}` };
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

  /** Seeds the default categories once, per user. Idempotent. */
  async ensureBootstrapped(): Promise<void> {
    const userId = await this.userId();
    const { count, error } = await this.client
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    if ((count ?? 0) > 0) return;

    const rows = DEFAULT_CATEGORIES.map((seed, index) => ({
      user_id: userId,
      name: seed.name,
      slug: seed.slug,
      sort_order: index,
      is_active: true,
      is_default: true,
      icon: seed.icon,
      prompt_examples: seed.promptExamples,
    }));
    const { error: insertError } = await this.client
      .from('categories')
      .upsert(rows, { onConflict: 'user_id,slug', ignoreDuplicates: true });
    if (insertError) throw insertError;

    await this.client
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  }

  async listCategories(includeInactive = false): Promise<Category[]> {
    let query = this.client.from('categories').select('*').order('sort_order', { ascending: true });
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data as CategoryRow[]).map(mapCategory);
  }

  async createCategory(input: {
    name: string;
    promptExamples?: string[];
    icon?: CategoryIcon;
  }): Promise<Category> {
    const userId = await this.userId();
    const { count } = await this.client
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const { data, error } = await this.client
      .from('categories')
      .insert({
        user_id: userId,
        name: input.name.trim(),
        slug: slugify(input.name),
        sort_order: count ?? 0,
        is_active: true,
        is_default: false,
        icon: input.icon ?? coerceIcon(undefined, slugify(input.name)),
        prompt_examples: input.promptExamples ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return mapCategory(data as CategoryRow);
  }

  async renameCategory(id: string, name: string): Promise<Category> {
    const { data, error } = await this.client
      .from('categories')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapCategory(data as CategoryRow);
  }

  async setCategoryIcon(id: string, icon: CategoryIcon): Promise<Category> {
    const { data, error } = await this.client
      .from('categories')
      .update({ icon, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapCategory(data as CategoryRow);
  }

  /**
   * Soft delete. Categories with history are never removed — logs keep their
   * foreign key and the LIST/detail screens keep rendering the old name.
   */
  async setCategoryActive(id: string, isActive: boolean): Promise<Category> {
    const { data, error } = await this.client
      .from('categories')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapCategory(data as CategoryRow);
  }

  async reorderCategories(orderedIds: string[]): Promise<Category[]> {
    const userId = await this.userId();
    const { data: existing, error: readError } = await this.client
      .from('categories')
      .select('*')
      .eq('user_id', userId);
    if (readError) throw readError;

    const rows = (existing as CategoryRow[]).map((row) => {
      const index = orderedIds.indexOf(row.id);
      return { ...row, sort_order: index === -1 ? row.sort_order : index, user_id: userId };
    });
    const { data, error } = await this.client
      .from('categories')
      .upsert(rows, { onConflict: 'id' })
      .select();
    if (error) throw error;
    return (data as CategoryRow[]).map(mapCategory).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async listLogsBetween(from: string, to: string): Promise<LogWithAnalysis[]> {
    const { data, error } = await this.client
      .from('logs')
      .select('*')
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    const logs = data as LogRow[];
    if (logs.length === 0) return [];

    const { data: analyses, error: analysisError } = await this.client
      .from('log_ai_analysis')
      .select('*')
      .in('log_id', logs.map((l) => l.id));
    if (analysisError) throw analysisError;

    const byLog = new Map((analyses as AnalysisRow[]).map((a) => [a.log_id, a]));
    return logs.map((row) => mapLog(row, byLog.get(row.id)));
  }

  async listLogsByMonth(key: string): Promise<LogWithAnalysis[]> {
    const { from, to } = monthRange(key);
    return this.listLogsBetween(from, to);
  }

  async listLogsByYear(key: string): Promise<LogWithAnalysis[]> {
    return this.listLogsBetween(`${key}-01-01`, `${key}-12-31`);
  }

  async getLog(id: string): Promise<LogWithAnalysis | null> {
    const { data, error } = await this.client.from('logs').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: analysis } = await this.client
      .from('log_ai_analysis')
      .select('*')
      .eq('log_id', id)
      .maybeSingle();
    return mapLog(data as LogRow, (analysis as AnalysisRow | null) ?? undefined);
  }

  async createLog(input: NewLogInput): Promise<JournalLog> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('logs')
      .insert({
        user_id: userId,
        occurred_on: input.occurredOn ?? todayIso(),
        type: input.type,
        category_id: input.categoryId,
        body: input.body.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return mapLog(data as LogRow);
  }

  async deleteLog(id: string): Promise<void> {
    const { error } = await this.client.from('logs').delete().eq('id', id);
    if (error) throw error;
  }

  async getTitle(periodType: PeriodType, periodKey: string): Promise<PeriodTitle | null> {
    const { data, error } = await this.client
      .from('period_titles')
      .select('*')
      .eq('period_type', periodType)
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapTitle(data as TitleRow) : null;
  }

  async listTitles(periodType: PeriodType, yearKeyValue: string): Promise<PeriodTitle[]> {
    const { data, error } = await this.client
      .from('period_titles')
      .select('*')
      .eq('period_type', periodType)
      .like('period_key', `${yearKeyValue}%`);
    if (error) throw error;
    return (data as TitleRow[]).map(mapTitle);
  }

  async upsertTitle(title: PeriodTitle): Promise<PeriodTitle> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('period_titles')
      .upsert(
        {
          user_id: userId,
          period_type: title.periodType,
          period_key: title.periodKey,
          title: title.title,
          source: title.source,
          is_confirmed: title.isConfirmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_type,period_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return mapTitle(data as TitleRow);
  }

  async getIntention(periodKey: string): Promise<MonthlyIntention | null> {
    const { data, error } = await this.client
      .from('monthly_intentions')
      .select('period_key, body')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (error) throw error;
    return data ? { periodKey: data.period_key as string, body: data.body as string } : null;
  }

  async listIntentions(yearKeyValue: string): Promise<MonthlyIntention[]> {
    const { data, error } = await this.client
      .from('monthly_intentions')
      .select('period_key, body')
      .like('period_key', `${yearKeyValue}-%`);
    if (error) throw error;
    return (data as Array<{ period_key: string; body: string }>).map((row) => ({
      periodKey: row.period_key,
      body: row.body,
    }));
  }

  async upsertIntention(intention: MonthlyIntention): Promise<MonthlyIntention> {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from('monthly_intentions')
      .upsert(
        {
          user_id: userId,
          period_key: intention.periodKey,
          body: intention.body.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_key' }
      )
      .select('period_key, body')
      .single();
    if (error) throw error;
    return { periodKey: data.period_key as string, body: data.body as string };
  }

  async getInsight(
    periodType: PeriodType,
    periodKey: string,
    categoryId: string
  ): Promise<CategoryInsight | null> {
    const { data, error } = await this.client
      .from('category_insights')
      .select('*')
      .eq('period_type', periodType)
      .eq('period_key', periodKey)
      .eq('category_id', categoryId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapInsight(data as InsightRow) : null;
  }

  /**
   * Records the user's verdict. The AI's original proposal is preserved in
   * keyword_reviews.original_keywords for audit (spec §17).
   */
  async saveKeywordReview(input: {
    insightId: string;
    status: Exclude<ReviewStatus, 'pending'>;
    finalKeywords: KeywordCandidate[];
  }): Promise<CategoryInsight> {
    const userId = await this.userId();
    const { data: current, error: readError } = await this.client
      .from('category_insights')
      .select('*')
      .eq('id', input.insightId)
      .single();
    if (readError) throw readError;
    const insight = mapInsight(current as InsightRow);

    const { error: reviewError } = await this.client.from('keyword_reviews').upsert(
      {
        user_id: userId,
        insight_id: input.insightId,
        original_keywords: insight.keywords,
        final_keywords: input.status === 'skipped' ? null : input.finalKeywords,
        status: input.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,insight_id' }
    );
    if (reviewError) throw reviewError;

    const patch: Record<string, unknown> = {
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    if (input.status !== 'skipped') patch.keywords = input.finalKeywords;

    const { data, error } = await this.client
      .from('category_insights')
      .update(patch)
      .eq('id', input.insightId)
      .select()
      .single();
    if (error) throw error;
    return mapInsight(data as InsightRow);
  }
}
