// The month's map, before it is drawn.
//
// One call per month, not one per record: it reads the points the month
// already produced, the records behind them, and what the person said they
// wanted to grow this year, and writes the working-out plus the one sentence
// that goes under the leading point.
//
// Runs after the month's records have been read, because it has nothing to
// work with until they have.
import { createProvider } from '../_shared/llm.ts';
import { MONTH_MAP_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';

const MAX_POINTS = 5;
/** A point has to be tellable apart into at least this many things. */
const MIN_BRANCHES = 2;
/** More than this under one point and the sky stops being readable. */
const MAX_BRANCHES = 4;
/** Enough of a month to reason over without sending the whole archive. */
const MAX_RECORDS = 40;

function monthRange(periodKey: string): { from: string; to: string } {
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const from = `${periodKey}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${periodKey}-${String(last).padStart(2, '0')}` };
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { month_key: periodKey } = (await request.json()) as { month_key?: string };
    if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) {
      return jsonResponse({ error: 'month_key must look like 2026-08' }, 400);
    }

    const db = serviceClient();
    const { from, to } = monthRange(periodKey);

    // ---- what the month holds -------------------------------------------
    const { data: logRows } = await db
      .from('logs')
      .select('id, occurred_on, type, moment_tags, optional_answer, body')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true })
      .limit(MAX_RECORDS);
    const logs = (logRows ?? []) as Array<{
      id: string;
      occurred_on: string;
      type: string;
      moment_tags: string[] | null;
      optional_answer: string | null;
      body: string | null;
    }>;

    if (logs.length === 0) {
      return jsonResponse({ error: 'この月には記録がありません。' }, 400);
    }

    const monthLogIds = new Set(logs.map((l) => l.id));

    const { data: evidenceRows } = await db
      .from('progression_evidence')
      .select('progression_id, log_id, role, occurred_at');
    const evidence = ((evidenceRows ?? []) as Array<{
      progression_id: string;
      log_id: string;
      role: string;
      occurred_at: string;
    }>).filter((row) => monthLogIds.has(row.log_id));

    const { data: progressionRows } = await db
      .from('progressions')
      .select('id, title, from_state, current_state, summary, maturity, pattern, merged_into_id')
      .eq('user_id', user.id);
    const progressions = ((progressionRows ?? []) as Array<{
      id: string;
      title: string;
      from_state: string | null;
      current_state: string | null;
      summary: string | null;
      maturity: string;
      pattern: string | null;
      merged_into_id: string | null;
    }>).filter((p) => !p.merged_into_id);

    const inMonth = progressions.filter((p) =>
      evidence.some((row) => row.progression_id === p.id)
    );

    if (inMonth.length === 0) {
      return jsonResponse({ error: 'この月にはまだ点がありません。' }, 400);
    }

    // ---- the lens, which is what makes the reason a reason ---------------
    const year = Number(periodKey.slice(0, 4));
    const { data: directionRow } = await db
      .from('year_directions')
      .select('selected_areas, desired_self_cards, progression_lenses, initial_theme')
      .eq('user_id', user.id)
      .eq('year', year)
      .maybeSingle();

    const { data: themeRow } = await db
      .from('month_themes')
      .select('initial_theme')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('month', Number(periodKey.slice(5, 7)))
      .maybeSingle();

    const byLog = new Map(logs.map((l) => [l.id, l]));
    const provider = createProvider();

    const raw = await provider.complete({
      system: MONTH_MAP_SYSTEM,
      user: JSON.stringify({
        task: 'month_map',
        month: periodKey,
        direction: directionRow ?? null,
        month_theme: themeRow?.initial_theme ?? null,
        points: inMonth.map((p) => ({
          id: p.id,
          title: p.title,
          from_state: p.from_state,
          current_state: p.current_state,
          summary: p.summary,
          maturity: p.maturity,
          pattern: p.pattern,
          // The records of this month that moved it, in the person's words.
          records: evidence
            .filter((row) => row.progression_id === p.id)
            .map((row) => byLog.get(row.log_id))
            .filter((l): l is NonNullable<typeof l> => Boolean(l))
            .map((l) => ({
              occurred_on: l.occurred_on,
              log_type: l.type,
              moment_tags: l.moment_tags ?? [],
              answer: l.optional_answer ?? l.body ?? null,
            })),
        })),
        // Everything else the month holds, so the brief can name what is
        // repeating without being a point yet.
        other_records: logs
          .filter((l) => !evidence.some((row) => row.log_id === l.id))
          .map((l) => ({
            occurred_on: l.occurred_on,
            log_type: l.type,
            moment_tags: l.moment_tags ?? [],
            answer: l.optional_answer ?? l.body ?? null,
          })),
      }),
      maxTokens: 3000,
    });

    const parsed = extractJson(raw) as {
      brief_markdown?: unknown;
      lead_progression_id?: unknown;
      lead_reason?: unknown;
      points?: unknown;
    };

    const known = new Set(inMonth.map((p) => p.id));
    const knownLogs = new Set(logs.map((l) => l.id));

    // Only points that exist and branches that stand on records that exist.
    // A point the model invented would appear on the map with nothing under
    // it, and a branch citing a record from another month would send the
    // person somewhere the reading never looked.
    const seen = new Set<string>();
    const points = (Array.isArray(parsed.points) ? parsed.points : []).flatMap((raw) => {
      if (typeof raw !== 'object' || raw === null) return [];
      const point = raw as Record<string, unknown>;
      const id = typeof point.progression_id === 'string' ? point.progression_id : '';
      if (!known.has(id) || seen.has(id)) return [];

      const branches = (Array.isArray(point.branches) ? point.branches : []).flatMap((b) => {
        if (typeof b !== 'object' || b === null) return [];
        const branch = b as Record<string, unknown>;
        const label = typeof branch.label === 'string' ? branch.label.trim() : '';
        const logIds = (Array.isArray(branch.log_ids) ? branch.log_ids : []).filter(
          (v): v is string => typeof v === 'string' && knownLogs.has(v)
        );
        if (label.length === 0 || logIds.length === 0) return [];
        return [
          {
            label,
            summary: typeof branch.summary === 'string' ? branch.summary.trim() : '',
            log_ids: logIds,
          },
        ];
      });

      // Two or more, or it is not a point of its own — it belongs inside
      // another one, and the map is meant to get smaller rather than carry a
      // point that only restates itself.
      if (branches.length < MIN_BRANCHES) return [];
      seen.add(id);
      return [{ progression_id: id, branches: branches.slice(0, MAX_BRANCHES) }];
    });

    const kept = points.slice(0, MAX_POINTS);

    const proposedLead =
      typeof parsed.lead_progression_id === 'string' &&
      kept.some((p) => p.progression_id === parsed.lead_progression_id)
        ? parsed.lead_progression_id
        : (kept[0]?.progression_id ?? null);

    const record = {
      user_id: user.id,
      period_key: periodKey,
      brief_markdown: typeof parsed.brief_markdown === 'string' ? parsed.brief_markdown : '',
      lead_progression_id: proposedLead,
      lead_reason: typeof parsed.lead_reason === 'string' ? parsed.lead_reason.trim() : '',
      points: kept,
      model_name: `${provider.name}:${provider.model}`,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from('month_maps')
      .upsert(record, { onConflict: 'user_id,period_key' });
    // Unchecked writes are how the last silent failure hid. If it did not
    // store, the caller hears about it.
    if (error) throw new Error(`month_maps: ${error.message}`);

    return jsonResponse({
      period_key: periodKey,
      lead_progression_id: record.lead_progression_id,
      lead_reason: record.lead_reason,
      points: record.points,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
