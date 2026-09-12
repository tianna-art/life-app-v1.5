/**
 * month-summary — three words and two sentences for one month.
 *
 * The shape is checked after the fact and a summary that misses it is not
 * stored. The shape is the restraint: a summary allowed to run long becomes a
 * retelling of the month, and a retelling is where the rewriting creeps in.
 */
import { serviceClient, requireUser } from '../_shared/db.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { createProvider } from '../_shared/llm.ts';
import { MONTH_SUMMARY_SYSTEM, renderLogs } from '../_shared/prompts.ts';
import { checkSummary } from '../_shared/reading.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  try {
    const user = await requireUser(request);
    const { periodKey } = (await request.json()) as { periodKey?: string };
    if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) {
      return jsonResponse({ error: 'periodKey must be YYYY-MM' }, 400);
    }

    const db = serviceClient();
    const { data: logs, error: logError } = await db
      .from('logs')
      .select('id, occurred_on, body')
      .eq('user_id', user.id)
      .eq('period_key', periodKey)
      .order('occurred_on', { ascending: true });
    if (logError) throw logError;
    if (!logs || logs.length === 0) {
      return jsonResponse({ written: false, reason: 'no records' });
    }

    const provider = createProvider();
    const raw = await provider.complete({
      system: MONTH_SUMMARY_SYSTEM,
      user: [
        `期間: ${periodKey}`,
        '',
        '記録:',
        renderLogs(logs.map((l) => ({ id: l.id, occurredOn: l.occurred_on, body: l.body ?? '' }))),
      ].join('\n'),
      maxTokens: 800,
    });

    const parsed = extractJson(raw) as { keywords?: string[]; body?: string };
    const keywords = (parsed.keywords ?? []).map((k) => String(k).trim());
    const body = String(parsed.body ?? '').trim();

    const verdict = checkSummary(keywords, body);
    if (!verdict.ok) {
      // Not stored. A summary that broke the shape is more likely to have
      // broken the register too, and an absent summary is honest.
      return jsonResponse({ written: false, problems: verdict.problems }, 200);
    }

    // Only the reading's own fields. body_user is the person's and is never
    // touched here — regenerating a summary must not discard what they wrote.
    const { error } = await db.from('period_summaries').upsert(
      {
        user_id: user.id,
        period_type: 'month',
        period_key: periodKey,
        keywords,
        body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_type,period_key' }
    );
    if (error) throw error;

    return jsonResponse({ written: true, keywords, body });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    return jsonResponse({ error: message }, 500);
  }
});
