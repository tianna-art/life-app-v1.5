// The month's reading: its changes, and everything drawn from them (§22, §41).
//
// One call per month, not one per record. It reads what the person put down at
// the start, the month's records, and the trails those records sit on — then
// publishes at most three changes. The map's points, the cards under them, the
// evidence each card prints and whatever settled out are all the same rows.
//
// The map and the summary used to be two calls about the same month, which
// meant nothing made them agree. This function is the fix, and the reason it
// is worth the extra reasoning: a point with no card under it is worse than no
// point at all.
//
// §43 is not asked of the model. `changeRules.ts` answers it here, on the
// parsed output, and drops what does not clear it — with the reasons kept in
// the brief, so a month that published nothing can still be explained.
import { createProvider } from '../_shared/llm.ts';
import { MONTH_CHANGE_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import {
  MAX_CHANGES,
  parseChangeReading,
  type ChangeContext,
  type ChangeTargetType,
} from '../_shared/changeRules.ts';
import { resolveGainCategory } from '../_shared/progressionRules.ts';
import { DIRECTION_AREA_LABELS, DESIRED_SELF_LABELS } from '../_shared/targets.ts';

/** Enough of a month to reason over without sending the whole archive. */
const MAX_RECORDS = 60;
/** How far back a trail is followed for a before-state. */
const MAX_TRAIL_RECORDS = 40;

function monthRange(periodKey: string): { from: string; to: string } {
  const year = Number(periodKey.slice(0, 4));
  const month = Number(periodKey.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${periodKey}-01`, to: `${periodKey}-${String(last).padStart(2, '0')}` };
}

interface LogRow {
  id: string;
  occurred_on: string;
  type: string;
  moment_tags: string[] | null;
  optional_answer: string | null;
  body: string | null;
}

function answerOf(log: LogRow): string {
  return log.optional_answer ?? log.body ?? '';
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
    const year = Number(periodKey.slice(0, 4));
    const month = Number(periodKey.slice(5, 7));
    const { from, to } = monthRange(periodKey);

    // ---- STEP 2: what the month holds ------------------------------------
    const { data: monthRows } = await db
      .from('logs')
      .select('id, occurred_on, type, moment_tags, optional_answer, body')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true })
      .limit(MAX_RECORDS);
    const monthLogs = (monthRows ?? []) as LogRow[];
    if (monthLogs.length === 0) {
      return jsonResponse({ error: 'この月には記録がありません。' }, 400);
    }
    const monthLogIds = new Set(monthLogs.map((l) => l.id));

    // ---- STEP 1: what the person put down at the start --------------------
    const [{ data: directionRow }, { data: themeRow }] = await Promise.all([
      db
        .from('year_directions')
        .select('selected_areas, desired_self_cards, progression_lenses, initial_theme')
        .eq('user_id', user.id)
        .eq('year', year)
        .maybeSingle(),
      db
        .from('month_themes')
        .select('initial_theme')
        .eq('user_id', user.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle(),
    ]);

    const direction = directionRow as {
      selected_areas: string[] | null;
      desired_self_cards: string[] | null;
      progression_lenses: string[] | null;
      initial_theme: string | null;
    } | null;
    const monthTheme = (themeRow as { initial_theme: string | null } | null)?.initial_theme ?? '';

    // The targets, by kind, with the person's own wording. A change is checked
    // against this: one claiming to answer a card they never chose would be
    // the reading inventing the target as well as the change.
    const targets = new Map<ChangeTargetType, Map<string, string>>();

    const monthDeclaration = new Map<string, string>();
    if (monthTheme) monthDeclaration.set(periodKey, monthTheme);
    targets.set('month_declaration', monthDeclaration);

    const yearDirection = new Map<string, string>();
    if (direction?.initial_theme) yearDirection.set(`year:${year}`, direction.initial_theme);
    for (const id of direction?.selected_areas ?? []) {
      const label = DIRECTION_AREA_LABELS[id];
      if (label) yearDirection.set(id, label);
    }
    targets.set('year_direction', yearDirection);

    const desiredSelf = new Map<string, string>();
    for (const id of direction?.desired_self_cards ?? []) {
      const label = DESIRED_SELF_LABELS[id];
      if (label) desiredSelf.set(id, label);
    }
    targets.set('desired_self', desiredSelf);

    // Nothing to check against: this one is what the records turned up on
    // their own, so the reading names it and the code only requires a name.
    targets.set('emerging_direction', new Map());

    // ---- STEP 3: the trails those records sit on --------------------------
    //
    // Not just the month. A before-state has to stand on a record from before
    // (§16), and the moment §37 is about — separate records becoming one line
    // — is by definition not visible inside one month.
    const { data: evidenceRows } = await db
      .from('progression_evidence')
      .select('progression_id, log_id, role, occurred_at')
      .order('occurred_at', { ascending: true });
    const evidence = (evidenceRows ?? []) as Array<{
      progression_id: string;
      log_id: string;
      role: string;
      occurred_at: string;
    }>;

    const { data: progressionRows } = await db
      .from('progressions')
      .select('id, title, pattern, from_state, current_state, summary, maturity, goal_external, merged_into_id')
      .eq('user_id', user.id);
    const progressions = ((progressionRows ?? []) as Array<{
      id: string;
      title: string;
      pattern: string | null;
      from_state: string | null;
      current_state: string | null;
      summary: string;
      maturity: string;
      goal_external: boolean;
      merged_into_id: string | null;
    }>).filter((p) => !p.merged_into_id);

    // Only the trails this month actually moved. A progression with nothing in
    // this month is not this month's change, however strong it is elsewhere.
    const inMonth = progressions.filter((p) =>
      evidence.some((row) => row.progression_id === p.id && monthLogIds.has(row.log_id))
    );

    const trailLogIds = new Set<string>();
    for (const row of evidence) {
      if (inMonth.some((p) => p.id === row.progression_id)) trailLogIds.add(row.log_id);
    }
    const earlierIds = [...trailLogIds].filter((id) => !monthLogIds.has(id)).slice(0, MAX_TRAIL_RECORDS);

    let earlierLogs: LogRow[] = [];
    if (earlierIds.length > 0) {
      const { data: earlierRows } = await db
        .from('logs')
        .select('id, occurred_on, type, moment_tags, optional_answer, body')
        .eq('user_id', user.id)
        .in('id', earlierIds)
        .order('occurred_on', { ascending: true });
      earlierLogs = (earlierRows ?? []) as LogRow[];
    }

    const allLogs = [...earlierLogs, ...monthLogs];
    const byLog = new Map(allLogs.map((l) => [l.id, l]));

    // §34, §35: a record whose only tags are 「モヤモヤ」 or 「楽しかった」 is
    // evidence waiting for something to connect to, and a change standing
    // entirely on one kind is not a change.
    const frictionOnly = new Set<string>();
    const enjoyedOnly = new Set<string>();
    for (const log of allLogs) {
      const tags = log.moment_tags ?? [];
      if (tags.length > 0 && tags.every((t) => t === 'friction')) frictionOnly.add(log.id);
      if (tags.length > 0 && tags.every((t) => t === 'enjoyed')) enjoyedOnly.add(log.id);
    }

    const provider = createProvider();

    const raw = await provider.complete({
      system: MONTH_CHANGE_SYSTEM,
      user: JSON.stringify({
        task: 'month_changes',
        month: periodKey,
        // What they put down, with the ids a change has to point back at.
        targets: {
          month_declaration: [...(targets.get('month_declaration') ?? [])].map(([id, label]) => ({
            id,
            label,
          })),
          year_direction: [...(targets.get('year_direction') ?? [])].map(([id, label]) => ({
            id,
            label,
          })),
          desired_self: [...(targets.get('desired_self') ?? [])].map(([id, label]) => ({
            id,
            label,
          })),
        },
        lenses: direction?.progression_lenses ?? [],
        // The month, in the person's own words.
        month_records: monthLogs.map((l) => ({
          log_id: l.id,
          occurred_on: l.occurred_on,
          log_type: l.type,
          moment_tags: l.moment_tags ?? [],
          answer: answerOf(l) || null,
        })),
        // Everything the month's trails reach back to. Marked as earlier so a
        // before-state can only be built from something that actually is.
        earlier_records: earlierLogs.map((l) => ({
          log_id: l.id,
          occurred_on: l.occurred_on,
          log_type: l.type,
          moment_tags: l.moment_tags ?? [],
          answer: answerOf(l) || null,
        })),
        // The detections, as candidates rather than conclusions.
        candidates: inMonth.map((p) => ({
          progression_id: p.id,
          title: p.title,
          pattern: p.pattern,
          from_state: p.from_state,
          current_state: p.current_state,
          summary: p.summary,
          maturity: p.maturity,
          grew_outside_the_direction: p.goal_external,
          record_ids: evidence
            .filter((row) => row.progression_id === p.id && byLog.has(row.log_id))
            .map((row) => row.log_id),
        })),
      }),
      maxTokens: 4000,
    });

    const context: ChangeContext = {
      knownLogIds: new Set(allLogs.map((l) => l.id)),
      monthLogIds,
      knownProgressionIds: new Set(inMonth.map((p) => p.id)),
      targets,
      frictionOnlyLogIds: frictionOnly,
      enjoyedOnlyLogIds: enjoyedOnly,
    };

    const parsed = extractJson(raw) as Record<string, unknown>;
    const reading = parseChangeReading(parsed, context);

    // The rejections belong in the brief. A month that published nothing is a
    // valid answer (§31), and the only way to tell it apart from a broken run
    // later is to have written down what was considered.
    const briefParts = [
      typeof parsed.brief_markdown === 'string' ? parsed.brief_markdown : '',
      reading.rejected.length > 0
        ? ['', '## 出さなかったもの（ルールによる）', ...reading.rejected.map(
            (r) => `- ${r.title} — ${r.reason}`
          )].join('\n')
        : '',
    ].filter((part) => part.length > 0);

    // ---- Publish ---------------------------------------------------------
    //
    // Replace, never accumulate. Re-reading a month is a new reading of it,
    // not a second opinion stacked beside the first; the rows are deleted
    // first so a change the reading no longer stands behind disappears with
    // it. Evidence and gains go with them by cascade.
    const { error: clearError } = await db
      .from('changes')
      .delete()
      .eq('user_id', user.id)
      .eq('period_type', 'month')
      .eq('year', year)
      .eq('month', month);
    if (clearError) throw new Error(`changes(clear): ${clearError.message}`);

    const modelName = `${provider.name}:${provider.model}`;
    const published: Array<{ id: string; title: string }> = [];

    for (const [index, change] of reading.changes.slice(0, MAX_CHANGES).entries()) {
      const { data: inserted, error: insertError } = await db
        .from('changes')
        .insert({
          user_id: user.id,
          period_type: 'month',
          year,
          month,
          title: change.title,
          linked_target_type: change.linkedTargetType,
          linked_target_id: change.linkedTargetId ?? null,
          linked_target_label: change.linkedTargetLabel,
          before_state: change.beforeState ?? null,
          current_state: change.currentState,
          observation: change.observation,
          target_connection: change.targetConnection,
          confidence: change.confidence,
          position: index,
          progression_id: change.progressionId ?? null,
          model_name: modelName,
        })
        .select('id')
        .single();
      if (insertError) throw new Error(`changes: ${insertError.message}`);

      const changeId = (inserted as { id: string }).id;
      published.push({ id: changeId, title: change.title });

      const { error: evidenceError } = await db.from('change_evidence').insert(
        change.evidence.map((entry, position) => ({
          change_id: changeId,
          log_id: entry.logId,
          role: entry.role,
          occurred_at: `${byLog.get(entry.logId)?.occurred_on ?? from}T00:00:00Z`,
          position,
        }))
      );
      if (evidenceError) throw new Error(`change_evidence: ${evidenceError.message}`);

      // §33: a gain hangs off the change, never off a record on its own.
      const gains = change.gains.flatMap((gain) => {
        const category = resolveGainCategory(gain.category);
        if (!category) return [];
        return [
          {
            user_id: user.id,
            change_id: changeId,
            ...(change.progressionId ? { progression_id: change.progressionId } : {}),
            category,
            label: gain.label,
            confidence: 0.5,
            first_detected_at: new Date().toISOString(),
            last_detected_at: new Date().toISOString(),
          },
        ];
      });
      if (gains.length > 0) {
        const { error: gainError } = await db.from('gains').insert(gains);
        if (gainError) throw new Error(`gains: ${gainError.message}`);
      }
    }

    // The working-out, kept and never rendered.
    const { error: briefError } = await db.from('month_maps').upsert(
      {
        user_id: user.id,
        period_key: periodKey,
        brief_markdown: briefParts.join('\n'),
        points: [],
        lead_reason: '',
        model_name: modelName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_key' }
    );
    if (briefError) throw new Error(`month_maps: ${briefError.message}`);

    return jsonResponse({
      period_key: periodKey,
      changes: published,
      rejected: reading.rejected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
