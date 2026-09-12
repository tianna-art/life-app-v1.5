/**
 * period-title — three candidate names for a month or a year.
 *
 * Candidates only. Nothing is stored: the person picks one or writes their
 * own, and the road out of here where they write it themselves is always open.
 * A name chosen for someone is not a name they gave.
 */
import { requireUser, serviceClient } from '../_shared/db.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { createProvider } from '../_shared/llm.ts';
import { PERIOD_TITLE_SYSTEM, renderLogs } from '../_shared/prompts.ts';
import { checkTitles } from '../_shared/reading.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  try {
    const user = await requireUser(request);
    const { periodType, periodKey } = (await request.json()) as {
      periodType?: 'month' | 'year';
      periodKey?: string;
    };
    const monthly = periodType !== 'year';
    const valid = monthly ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
    if (!periodKey || !valid.test(periodKey)) {
      return jsonResponse({ error: 'periodKey does not match periodType' }, 400);
    }

    const db = serviceClient();
    let query = db
      .from('logs')
      .select('id, occurred_on, body')
      .eq('user_id', user.id)
      .order('occurred_on', { ascending: true });
    query = monthly
      ? query.eq('period_key', periodKey)
      : query.like('period_key', `${periodKey}-%`);

    const { data: logs, error } = await query;
    if (error) throw error;
    if (!logs || logs.length === 0) {
      // A period with nothing in it can still be named — by hand, on the
      // screen. There is simply nothing here to make a suggestion from.
      return jsonResponse({ titles: [], reason: 'no records' });
    }

    const provider = createProvider();
    const raw = await provider.complete({
      system: PERIOD_TITLE_SYSTEM,
      user: [
        `期間: ${periodKey}`,
        '',
        '記録:',
        renderLogs(logs.map((l) => ({ id: l.id, occurredOn: l.occurred_on, body: l.body ?? '' }))),
      ].join('\n'),
      maxTokens: 600,
    });

    const parsed = extractJson(raw) as { titles?: string[] };
    const titles = (parsed.titles ?? []).map((t) => String(t).trim()).filter(Boolean);

    const verdict = checkTitles(titles);
    if (!verdict.ok) return jsonResponse({ titles: [], problems: verdict.problems });

    return jsonResponse({ titles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    return jsonResponse({ error: message }, 500);
  }
});
