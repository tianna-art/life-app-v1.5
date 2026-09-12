/**
 * month-insights — 見えてきたこと for one month.
 *
 * The model proposes; this function disposes. Everything it returns is sifted
 * by the shared rules before anything is written: cards citing records that do
 * not exist are dropped, a card standing on one record is demoted to 手がかり,
 * and 今の仮説 is withheld unless two separate cards each stand on two or more
 * records.
 *
 * Nothing is written when nothing survives. An empty month stays empty — that
 * is the whole discipline, and a function that writes a card anyway to avoid
 * an empty screen defeats every check above it.
 */
import { serviceClient, requireUser } from '../_shared/db.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { getProvider } from '../_shared/llm.ts';
import { MONTH_INSIGHTS_SYSTEM, renderLogs } from '../_shared/prompts.ts';
import {
  acceptInsights,
  hypothesisIsHedged,
  mayOfferHypothesis,
  type ProposedInsight,
} from '../_shared/reading.ts';

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

    const [{ data: logRows, error: logError }, { data: direction }] = await Promise.all([
      db
        .from('logs')
        .select('id, occurred_on, body, category_id')
        .eq('user_id', user.id)
        .eq('period_key', periodKey)
        .order('occurred_on', { ascending: true }),
      db
        .from('month_directions')
        .select('antenna_ids')
        .eq('user_id', user.id)
        .eq('period_key', periodKey)
        .maybeSingle(),
    ]);
    if (logError) throw logError;

    const logs = logRows ?? [];
    if (logs.length === 0) {
      return jsonResponse({ insights: [], hypothesis: null, reason: 'no records' });
    }

    const antennaIds: string[] = direction?.antenna_ids ?? [];
    const provider = getProvider();
    const raw = await provider.complete({
      system: MONTH_INSIGHTS_SYSTEM,
      user: [
        `期間: ${periodKey}`,
        `この月のアンテナ: ${antennaIds.length > 0 ? antennaIds.join(', ') : '(未設定)'}`,
        '',
        '記録:',
        renderLogs(
          logs.map((l) => ({ id: l.id, occurredOn: l.occurred_on, body: l.body ?? '' }))
        ),
      ].join('\n'),
      maxTokens: 2000,
    });

    const parsed = extractJson(raw) as {
      insights?: ProposedInsight[];
      hypothesis?: string;
    };

    const { accepted, rejected } = acceptInsights(
      parsed.insights ?? [],
      logs.map((l) => l.id),
      antennaIds as never
    );

    // Written as one replacement, so a month is never half old and half new.
    await db.from('month_insights').delete().eq('user_id', user.id).eq('period_key', periodKey);

    if (accepted.length > 0) {
      const { error } = await db.from('month_insights').insert(
        accepted.map((card) => ({
          user_id: user.id,
          period_key: periodKey,
          antenna_id: card.antennaId,
          label: card.label,
          text: card.text,
          why: card.why,
          note: card.note,
          evidence_log_ids: card.evidenceLogIds,
        }))
      );
      if (error) throw error;
    }

    const proposed = (parsed.hypothesis ?? '').trim();
    const hypothesis =
      proposed.length > 0 && mayOfferHypothesis(accepted) && hypothesisIsHedged(proposed)
        ? proposed
        : null;

    await db.from('month_hypotheses').delete().eq('user_id', user.id).eq('period_key', periodKey);
    if (hypothesis) {
      const { error } = await db
        .from('month_hypotheses')
        .insert({ user_id: user.id, period_key: periodKey, text: hypothesis });
      if (error) throw error;
    }

    return jsonResponse({
      insights: accepted.length,
      hypothesis: Boolean(hypothesis),
      // Returned so a bad month is diagnosable without reading model logs.
      rejected: rejected.map((r) => r.reason),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    return jsonResponse({ error: message }, 500);
  }
});
