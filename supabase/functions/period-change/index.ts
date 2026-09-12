/**
 * period-change — 先月からの変化 / 去年との違い.
 *
 * The comparison is asked for last and refused most often, on purpose.
 *
 * Before a model is asked anything, both periods are counted. If either is too
 * thin, or one is several times the size of the other, the function stops
 * there and writes nothing: the difference between a month with one record and
 * a month with five is a difference in how much somebody wrote, and no reading
 * can tell that apart from a difference in how somebody lived. Asking anyway
 * and throwing the answer away would be worse than not asking — a good
 * sentence is hard to discard once it exists.
 *
 * What comes back is then sifted again by the same rules, because a model told
 * not to count will still find a way to say 「増えた」.
 */
import { serviceClient, requireUser } from '../_shared/db.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { createProvider } from '../_shared/llm.ts';
import { PERIOD_CHANGE_SYSTEM, renderLogs } from '../_shared/prompts.ts';
import { acceptChange, sidesAreComparable, type ProposedChange } from '../_shared/reading.ts';

type Row = { id: string; occurred_on: string | null; body: string | null };

/** The period this one is held up against: the month before, or the year before. */
function comparisonKey(periodType: 'month' | 'year', periodKey: string): string {
  if (periodType === 'year') return String(Number(periodKey) - 1);
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  try {
    const user = await requireUser(request);
    const { periodType, periodKey } = (await request.json()) as {
      periodType?: 'month' | 'year';
      periodKey?: string;
    };
    const type = periodType === 'year' ? 'year' : 'month';
    const keyShape = type === 'year' ? /^\d{4}$/ : /^\d{4}-\d{2}$/;
    if (!periodKey || !keyShape.test(periodKey)) {
      return jsonResponse({ error: `periodKey must be ${type === 'year' ? 'YYYY' : 'YYYY-MM'}` }, 400);
    }

    const compareKey = comparisonKey(type, periodKey);
    const db = serviceClient();

    const select = (key: string) => {
      const query = db
        .from('logs')
        .select('id, occurred_on, body')
        .eq('user_id', user.id)
        .order('occurred_on', { ascending: true });
      return type === 'year'
        ? query.like('period_key', `${key}-%`)
        : query.eq('period_key', key);
    };

    const [previousResult, currentResult] = await Promise.all([select(compareKey), select(periodKey)]);
    if (previousResult.error) throw previousResult.error;
    if (currentResult.error) throw currentResult.error;

    const previous = (previousResult.data ?? []) as Row[];
    const current = (currentResult.data ?? []) as Row[];

    // The whole reading, refused before it is written. This is the common
    // case early on and it is not a failure: the screen already says
    // 「比べられる記録は、まだ多くありません。」
    if (!sidesAreComparable(previous.length, current.length)) {
      return jsonResponse({
        written: false,
        reason: 'sides',
        previous: previous.length,
        current: current.length,
      });
    }

    const render = (rows: Row[]) =>
      renderLogs(rows.map((r) => ({ id: r.id, occurredOn: r.occurred_on, body: r.body ?? '' })));

    const provider = createProvider();
    const raw = await provider.complete({
      system: PERIOD_CHANGE_SYSTEM,
      user: [
        `前の期間: ${compareKey}`,
        render(previous),
        '',
        `後の期間: ${periodKey}`,
        render(current),
      ].join('\n'),
      maxTokens: 1500,
    });

    const parsed = extractJson(raw) as ProposedChange;
    const { accepted, problems } = acceptChange(
      parsed,
      previous.map((r) => r.id),
      current.map((r) => r.id)
    );

    // One replacement, so a period is never half an old comparison.
    await db
      .from('period_changes')
      .delete()
      .eq('user_id', user.id)
      .eq('period_type', type)
      .eq('period_key', periodKey);

    if (!accepted) return jsonResponse({ written: false, problems });

    const { error } = await db.from('period_changes').insert({
      user_id: user.id,
      period_type: type,
      period_key: periodKey,
      compare_key: compareKey,
      kind: accepted.kind,
      title: accepted.title,
      summary: accepted.summary,
      previous_log_ids: accepted.previousLogIds,
      current_log_ids: accepted.currentLogIds,
      note: accepted.note,
    });
    if (error) throw error;

    return jsonResponse({ written: true, compareKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    return jsonResponse({ error: message }, 500);
  }
});
