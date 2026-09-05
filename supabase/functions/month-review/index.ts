// The month-end reading (§19) and the cross-time comparison behind it (§12).
//
// Only ever produced for a month that is over and that actually holds records.
// The change line must be a comparison against the person's own earlier
// months; when there is nothing to compare it comes back empty and the screen
// simply does not show that block.
import { createProvider } from '../_shared/llm.ts';
import { MONTH_REVIEW_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import type { JourneyRole } from '../_shared/gainRules.ts';

/** How many earlier months are put beside this one for the comparison. */
const LOOKBACK_MONTHS = 3;

interface LogRow {
  id: string;
  occurred_on: string;
  input_category: string;
  body: string;
}

interface AnalysisRow {
  log_id: string;
  event_summary: string | null;
  journey_role: JourneyRole | null;
}

function monthBounds(periodKey: string): { from: string; to: string } {
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const last = new Date(year, month, 0).getDate();
  return { from: `${periodKey}-01`, to: `${periodKey}-${String(last).padStart(2, '0')}` };
}

function shiftMonth(periodKey: string, delta: number): string {
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const zeroBased = year * 12 + (month - 1) + delta;
  const y = Math.floor(zeroBased / 12);
  const m = ((zeroBased % 12) + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { period_key: periodKey } = (await request.json()) as { period_key?: string };
    if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) {
      return jsonResponse({ error: 'period_key (YYYY-MM) is required' }, 400);
    }

    const db = serviceClient();

    // A stored reading always wins: the same month must not read differently
    // every time it is opened.
    const { data: stored } = await db
      .from('month_reviews')
      .select('period_key, title, subtitle, gains, one_change')
      .eq('user_id', user.id)
      .eq('period_key', periodKey)
      .maybeSingle();
    if (stored) return jsonResponse(stored);

    const { from, to } = monthBounds(periodKey);
    const { data: logs, error } = await db
      .from('logs')
      .select('id, occurred_on, input_category, body')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true });
    if (error) throw error;

    const monthLogs = (logs ?? []) as LogRow[];
    if (monthLogs.length === 0) {
      return jsonResponse({ error: 'nothing to read in this month' }, 404);
    }

    const monthLogIds = monthLogs.map((l) => l.id);

    const [{ data: analyses }, { data: evidence }] = await Promise.all([
      db
        .from('log_ai_analysis')
        .select('log_id, event_summary, journey_role')
        .in('log_id', monthLogIds),
      db.from('gain_evidence').select('gain_id, log_id').in('log_id', monthLogIds),
    ]);

    const analysisById = new Map(((analyses ?? []) as AnalysisRow[]).map((a) => [a.log_id, a]));

    const gainIds = [
      ...new Set(((evidence ?? []) as Array<{ gain_id: string }>).map((e) => e.gain_id)),
    ];
    const { data: gainRows } = gainIds.length
      ? await db
          .from('gains')
          .select('id, type, label, maturity, first_detected_at')
          .eq('user_id', user.id)
          .is('merged_into_id', null)
          .in('id', gainIds)
      : { data: [] };

    const gains = (gainRows ?? []) as Array<{
      id: string;
      type: string;
      label: string;
      maturity: string;
      first_detected_at: string;
    }>;

    // The earlier months, summarised rather than quoted in full: the point of
    // the comparison is what kind of record grew, not the wording.
    const earliest = shiftMonth(periodKey, -LOOKBACK_MONTHS);
    const { data: previousLogs } = await db
      .from('logs')
      .select('occurred_on, input_category, body')
      .eq('user_id', user.id)
      .gte('occurred_on', `${earliest}-01`)
      .lt('occurred_on', from)
      .order('occurred_on', { ascending: true });

    const previous = ((previousLogs ?? []) as Array<{
      occurred_on: string;
      input_category: string;
      body: string;
    }>).map((l) => ({
      month: l.occurred_on.slice(0, 7),
      input_category: l.input_category,
      body: l.body,
    }));

    const provider = createProvider();
    const raw = await provider.complete({
      system: MONTH_REVIEW_SYSTEM,
      user: JSON.stringify({
        task: 'month_review',
        period_key: periodKey,
        // §12: the axes the comparison is meant to look along.
        compare_along: ['REPEAT', 'CHANGE', 'BUILD', 'EXPERIMENT', 'ADAPT', 'REFRAME', 'GAIN'],
        this_month: monthLogs.map((l) => ({
          occurred_on: l.occurred_on,
          input_category: l.input_category,
          body: l.body,
          event_summary: analysisById.get(l.id)?.event_summary ?? null,
          journey_role: analysisById.get(l.id)?.journey_role ?? null,
        })),
        gains_this_month: gains.map((g) => ({
          type: g.type,
          label: g.label,
          maturity: g.maturity,
          is_new: g.first_detected_at.slice(0, 7) === periodKey,
        })),
        previous_months: previous,
      }),
      maxTokens: 800,
      temperature: 0.5,
    });

    const parsed = extractJson(raw) as {
      title?: unknown;
      subtitle?: unknown;
      gains?: unknown;
      one_change?: unknown;
    };

    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (title.length === 0) return jsonResponse({ error: 'no title produced' }, 502);

    // Labels are only accepted if they are gains that actually exist: the
    // month's three gains are a selection, never a fresh invention.
    const known = new Set(gains.map((g) => g.label));
    const selected = Array.isArray(parsed.gains)
      ? parsed.gains
          .filter((g): g is string => typeof g === 'string')
          .map((g) => g.trim())
          .filter((g) => known.has(g))
          .slice(0, 3)
      : [];

    const row = {
      user_id: user.id,
      period_key: periodKey,
      title,
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : '',
      gains: selected.length > 0 ? selected : gains.slice(0, 3).map((g) => g.label),
      one_change: typeof parsed.one_change === 'string' ? parsed.one_change.trim() : '',
      model_name: `${provider.name}:${provider.model}`,
      updated_at: new Date().toISOString(),
    };

    const { error: writeError } = await db
      .from('month_reviews')
      .upsert(row, { onConflict: 'user_id,period_key' });
    if (writeError) throw writeError;

    return jsonResponse({
      period_key: row.period_key,
      title: row.title,
      subtitle: row.subtitle,
      gains: row.gains,
      one_change: row.one_change,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
