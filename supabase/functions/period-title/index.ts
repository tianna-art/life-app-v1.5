// Monthly / yearly title candidates (spec §9.3, §9.4).
// The unlock rules are enforced here too, so the AI path cannot be reached by
// calling the function directly before the period is over.
import { createProvider } from '../_shared/llm.ts';
import { PERIOD_TITLE_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';

const MONTHLY_MIN_LOGS = 5;
const YEARLY_MIN_CONFIRMED_MONTH_TITLES = 3;
const YEARLY_MIN_LOGS = 20;

function monthEnded(periodKey: string, now: Date): boolean {
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (periodKey < currentKey) return true;
  if (periodKey > currentKey) return false;
  return now.getDate() >= new Date(year, month, 0).getDate();
}

function yearEnded(periodKey: string, now: Date): boolean {
  const year = Number(periodKey);
  if (year < now.getFullYear()) return true;
  if (year > now.getFullYear()) return false;
  return now.getMonth() === 11 && now.getDate() === 31;
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const body = (await request.json()) as {
      period_type?: 'month' | 'year';
      period_key?: string;
    };
    const periodType = body.period_type ?? 'month';
    const periodKey = body.period_key;
    if (!periodKey) return jsonResponse({ error: 'period_key is required' }, 400);

    const db = serviceClient();
    const now = new Date();

    const from = periodType === 'year' ? `${periodKey}-01-01` : `${periodKey}-01`;
    const to = periodType === 'year' ? `${periodKey}-12-31` : `${periodKey}-31`;

    const { data: logs, error } = await db
      .from('logs')
      .select('id, body, type, occurred_on, category_id')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true });
    if (error) throw error;
    const logCount = logs?.length ?? 0;

    const { data: monthlyTitles } = await db
      .from('period_titles')
      .select('period_key, title, is_confirmed')
      .eq('user_id', user.id)
      .eq('period_type', 'month')
      .like('period_key', `${periodKey.slice(0, 4)}-%`);

    const confirmedMonths = (monthlyTitles ?? []).filter((t) => t.is_confirmed).length;

    const unlocked =
      periodType === 'month'
        ? monthEnded(periodKey, now) && logCount >= MONTHLY_MIN_LOGS
        : yearEnded(periodKey, now) &&
          (confirmedMonths >= YEARLY_MIN_CONFIRMED_MONTH_TITLES || logCount >= YEARLY_MIN_LOGS);

    if (!unlocked) return jsonResponse({ error: 'locked' }, 409);

    const { data: intention } = await db
      .from('monthly_intentions')
      .select('body')
      .eq('user_id', user.id)
      .eq('period_key', periodKey)
      .maybeSingle();

    const { data: confirmedKeywords } = await db
      .from('category_insights')
      .select('keywords')
      .eq('user_id', user.id)
      .in('status', ['accepted', 'edited'])
      .like('period_key', `${periodKey}%`);

    const provider = createProvider();
    const raw = await provider.complete({
      system: PERIOD_TITLE_SYSTEM,
      user: JSON.stringify({
        task: periodType === 'month' ? 'monthly_title' : 'yearly_title',
        period_key: periodKey,
        intention: intention?.body ?? null,
        monthly_titles: periodType === 'year' ? (monthlyTitles ?? []) : [],
        confirmed_keywords: (confirmedKeywords ?? []).flatMap((c) => c.keywords ?? []),
        logs: (logs ?? []).map((l) => ({
          type: l.type,
          occurred_on: l.occurred_on,
          body: l.body,
        })),
      }),
      maxTokens: 600,
      temperature: 0.7,
    });

    const parsed = extractJson(raw) as { candidates?: unknown };
    const candidates = (Array.isArray(parsed.candidates) ? parsed.candidates : [])
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c.title === 'string' && (c.title as string).trim().length > 0)
      .slice(0, 3)
      .map((c) => ({
        title: (c.title as string).trim(),
        reason: typeof c.reason === 'string' ? (c.reason as string).trim() : '',
      }));

    if (candidates.length === 0) return jsonResponse({ error: 'model returned no candidates' }, 502);
    return jsonResponse({ candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
