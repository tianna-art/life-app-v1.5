/**
 * Client side of the AI pipeline.
 *
 * The app NEVER talks to an LLM directly and holds no provider key: every call
 * goes to a Supabase Edge Function running with the service role, which is the
 * only place the API key exists (spec §"API Keyをクライアントに置かない").
 */
import type { CategoryInsight, LogWithAnalysis, PeriodType } from '@/types';
import { getSupabase } from '@/lib/supabase';
import {
  parseCategoryInsight,
  parseLogAnalysis,
  parseTitleCandidates,
  type CategoryInsightResult,
  type LogAnalysisResult,
  type TitleCandidatesResult,
} from './types';
import {
  localAnalyzeLog,
  localCategoryInsight,
  localTitleCandidates,
  makeLocalInsight,
} from './localFallback';

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('EDGE_FUNCTIONS_UNAVAILABLE');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
}

/**
 * Fire-and-forget log analysis. Runs after the log is already committed, so a
 * failure here can never roll a saved log back (spec §17).
 */
export async function analyzeLog(logId: string): Promise<LogAnalysisResult | null> {
  try {
    const raw = await invoke<unknown>('analyze-log', { log_id: logId });
    return parseLogAnalysis(raw);
  } catch {
    return null;
  }
}

export async function analyzeLogText(body: string): Promise<LogAnalysisResult> {
  return localAnalyzeLog(body);
}

export interface InsightRequest {
  periodType: PeriodType;
  periodKey: string;
  categoryId: string;
  categoryName: string;
  logs: LogWithAnalysis[];
}

export async function generateCategoryInsight(
  request: InsightRequest
): Promise<CategoryInsight> {
  try {
    const raw = await invoke<unknown>('category-insight', {
      period_type: request.periodType,
      period_key: request.periodKey,
      category_id: request.categoryId,
    });
    const parsed: CategoryInsightResult | null = parseCategoryInsight(raw);
    if (!parsed) throw new Error('INVALID_JSON');
    const id =
      typeof raw === 'object' && raw !== null && typeof (raw as { id?: unknown }).id === 'string'
        ? ((raw as { id: string }).id)
        : undefined;
    const insight: CategoryInsight = {
      id: id ?? `${request.periodType}:${request.periodKey}:${request.categoryId}`,
      periodType: request.periodType,
      periodKey: request.periodKey,
      categoryId: request.categoryId,
      insight: parsed.insight,
      keywords: parsed.keywords,
      status: 'pending',
    };
    return insight;
  } catch {
    return makeLocalInsight(
      request.periodType,
      request.periodKey,
      request.categoryId,
      request.categoryName,
      request.logs
    );
  }
}

export function previewCategoryInsight(
  categoryName: string,
  logs: LogWithAnalysis[]
): CategoryInsightResult {
  return localCategoryInsight(categoryName, logs);
}

export interface TitleRequest {
  periodType: PeriodType;
  periodKey: string;
  periodLabel: string;
}

export async function generateTitleCandidates(
  request: TitleRequest
): Promise<TitleCandidatesResult> {
  try {
    const raw = await invoke<unknown>('period-title', {
      period_type: request.periodType,
      period_key: request.periodKey,
    });
    const parsed = parseTitleCandidates(raw);
    if (!parsed) throw new Error('INVALID_JSON');
    return parsed;
  } catch {
    return localTitleCandidates(request.periodLabel);
  }
}
