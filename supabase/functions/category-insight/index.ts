// Category insight for one period (spec §9.2).
// Cached per (user, period_type, period_key, category); regenerated only when
// asked with force=true.
import { createProvider } from '../_shared/llm.ts';
import { CATEGORY_INSIGHT_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';

const ANALYSIS_VERSION = 'v1';

function periodRange(periodType: string, periodKey: string): { from: string; to: string } {
  if (periodType === 'year') return { from: `${periodKey}-01-01`, to: `${periodKey}-12-31` };
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const last = new Date(year, month, 0).getDate();
  return { from: `${periodKey}-01`, to: `${periodKey}-${String(last).padStart(2, '0')}` };
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const body = (await request.json()) as {
      period_type?: 'month' | 'year';
      period_key?: string;
      category_id?: string;
      force?: boolean;
    };
    const periodType = body.period_type ?? 'month';
    const periodKey = body.period_key;
    const categoryId = body.category_id;
    if (!periodKey || !categoryId) {
      return jsonResponse({ error: 'period_key and category_id are required' }, 400);
    }

    const db = serviceClient();

    if (!body.force) {
      const { data: cached } = await db
        .from('category_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_type', periodType)
        .eq('period_key', periodKey)
        .eq('category_id', categoryId)
        .maybeSingle();
      if (cached) {
        return jsonResponse({
          id: cached.id,
          insight: cached.insight,
          keywords: cached.keywords,
          status: cached.status,
        });
      }
    }

    const { from, to } = periodRange(periodType, periodKey);
    const { data: logs, error } = await db
      .from('logs')
      .select('id, body, type, occurred_on')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true });
    if (error) throw error;
    if (!logs || logs.length === 0) return jsonResponse({ error: 'no logs in period' }, 404);

    const { data: category } = await db
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .maybeSingle();

    const { data: analyses } = await db
      .from('log_ai_analysis')
      .select('log_id, keywords, semantic_tags, tone')
      .in('log_id', logs.map((l) => l.id));

    // Previously confirmed keywords steer the model toward the user's own words.
    const { data: confirmed } = await db
      .from('category_insights')
      .select('keywords')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .in('status', ['accepted', 'edited'])
      .limit(8);

    const provider = createProvider();
    const raw = await provider.complete({
      system: CATEGORY_INSIGHT_SYSTEM,
      user: JSON.stringify({
        task: 'category_insight',
        period_type: periodType,
        period_key: periodKey,
        category: category?.name ?? '',
        logs: logs.map((l) => ({
          id: l.id,
          type: l.type,
          occurred_on: l.occurred_on,
          body: l.body,
          tags: analyses?.find((a) => a.log_id === l.id) ?? null,
        })),
        previously_confirmed_keywords: (confirmed ?? []).flatMap((c) => c.keywords ?? []),
      }),
      maxTokens: 700,
      temperature: 0.3,
    });

    const parsed = extractJson(raw) as { insight?: unknown; keywords?: unknown };
    if (typeof parsed.insight !== 'string' || parsed.insight.trim().length === 0) {
      return jsonResponse({ error: 'model returned no insight' }, 502);
    }

    const validIds = new Set(logs.map((l) => l.id));
    const keywords = (Array.isArray(parsed.keywords) ? parsed.keywords : [])
      .map((k) => k as Record<string, unknown>)
      .filter((k) => typeof k.label === 'string' && (k.label as string).trim().length > 0)
      .slice(0, 3)
      .map((k) => ({
        label: (k.label as string).trim(),
        confidence: typeof k.confidence === 'number' ? Math.min(1, Math.max(0, k.confidence)) : 0.5,
        // Evidence must point at real logs from this period.
        evidence_log_ids: Array.isArray(k.evidence_log_ids)
          ? (k.evidence_log_ids as unknown[]).filter(
              (id): id is string => typeof id === 'string' && validIds.has(id)
            )
          : [],
      }));

    const { data: saved, error: writeError } = await db
      .from('category_insights')
      .upsert(
        {
          user_id: user.id,
          period_type: periodType,
          period_key: periodKey,
          category_id: categoryId,
          insight: parsed.insight.trim(),
          keywords,
          evidence_log_ids: logs.map((l) => l.id),
          status: 'pending',
          model_name: `${provider.name}:${provider.model}`,
          analysis_version: ANALYSIS_VERSION,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_type,period_key,category_id' }
      )
      .select()
      .single();
    if (writeError) throw writeError;

    return jsonResponse({
      id: saved.id,
      insight: saved.insight,
      keywords: saved.keywords,
      status: saved.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
