// STAGE 1 and STAGE 2, in one round trip.
//
// STAGE 1 reads the record on its own. STAGE 2 compares it with what retrieval
// turned up and decides whether anything is a movement. Splitting them across
// the network would double the latency of a save for no benefit — nothing in
// between needs to reach the device — but they stay two separate model calls,
// because asking for both at once produces a reading of the record that has
// already been bent to fit a trajectory.
//
// Runs after the record is committed. A failure here returns an error and
// never touches what was stored: the person keeps what they tapped whatever
// the model does.
import { createProvider } from '../_shared/llm.ts';
import {
  CONSOLIDATION_SYSTEM,
  CROSS_TIME_SYSTEM,
  LOG_EXTRACTION_SYSTEM,
} from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import { retrieveRelatedLogs } from '../_shared/retrieval.ts';
import {
  MIN_EVIDENCE_FOR_PROGRESSION,
  nominateConsolidations,
  parseCrossTimeReading,
  parseLogAnalysis,
  type ProgressionType,
} from '../_shared/progressionRules.ts';
import {
  applyProposal,
  evidenceCounts,
  loadProgressions,
  mergeProgressions,
  type ProgressionRow,
} from '../_shared/progressionStore.ts';

const ANALYSIS_VERSION = 'v4-lens';
/** Consolidation asks the model; a couple of questions per save is enough. */
const MAX_CONSOLIDATION_CHECKS = 2;

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { log_id: logId } = (await request.json()) as { log_id?: string };
    if (!logId) return jsonResponse({ error: 'log_id is required' }, 400);

    const db = serviceClient();
    const { data: log, error } = await db
      .from('logs')
      .select(
        'id, user_id, type, moment_tags, ai_question, optional_answer, body, occurred_on, occurred_at'
      )
      .eq('id', logId)
      .single();
    if (error || !log) return jsonResponse({ error: 'log not found' }, 404);
    if (log.user_id !== user.id) return jsonResponse({ error: 'forbidden' }, 403);

    const answer: string = log.optional_answer ?? log.body ?? '';
    const provider = createProvider();

    // ---- STAGE 1 ---------------------------------------------------------
    const rawExtraction = await provider.complete({
      system: LOG_EXTRACTION_SYSTEM,
      user: JSON.stringify({
        task: 'log_extraction',
        record: {
          occurred_on: log.occurred_on,
          log_type: log.type,
          moment_tags: log.moment_tags ?? [],
          question: log.ai_question,
          answer: answer || null,
        },
      }),
      maxTokens: 800,
      temperature: 0.2,
    });

    const analysis = parseLogAnalysis(extractJson(rawExtraction), answer);

    await db.from('log_ai_analysis').upsert(
      {
        log_id: log.id,
        event_summary: analysis.eventSummary,
        topics: analysis.themes,
        actors: analysis.people,
        action: analysis.action ?? null,
        outcome: analysis.outcome ?? null,
        friction: analysis.friction ?? null,
        discovery: analysis.discovery ?? null,
        adaptation: analysis.adaptation ?? null,
        choice: analysis.choice ?? null,
        environment_note: analysis.environment ?? null,
        interest_signal: analysis.interestSignal ?? null,
        journey_role: analysis.journeyRole ?? null,
        confidence: analysis.confidence,
        keywords: [],
        semantic_tags: analysis.themes,
        model_name: `${provider.name}:${provider.model}`,
        analysis_version: ANALYSIS_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'log_id' }
    );

    // ---- STAGE 2 ---------------------------------------------------------
    const related = await retrieveRelatedLogs(db, user.id, {
      excludeLogId: log.id,
      topics: analysis.themes,
      momentTags: log.moment_tags ?? [],
      logType: log.type,
      occurredAt: log.occurred_at,
    });

    // One record on its own is a dot (§31). Nothing to compare, so the second
    // model call is skipped entirely rather than asked and then discarded.
    if (related.length === 0) {
      return jsonResponse({
        analysis: toWire(analysis, log.id),
        progressions: [],
        joined_progression_ids: [],
        emerged_progression_id: null,
      });
    }

    const [existing, lenses] = await Promise.all([
      loadProgressions(db, user.id),
      loadLenses(db, user.id, log.occurred_on),
    ]);

    const rawCrossTime = await provider.complete({
      system: CROSS_TIME_SYSTEM,
      user: JSON.stringify({
        task: 'cross_time_progression',
        // The lens raises priority; it never filters (§19).
        lenses,
        today: {
          log_id: log.id,
          occurred_on: log.occurred_on,
          log_type: log.type,
          moment_tags: log.moment_tags ?? [],
          question: log.ai_question,
          answer: answer || null,
          event_summary: analysis.eventSummary,
          themes: analysis.themes,
        },
        related_logs: related.map((r) => ({
          log_id: r.id,
          occurred_on: r.occurred_on,
          log_type: r.type,
          moment_tags: r.moment_tags,
          answer: r.optional_answer ?? r.body,
          event_summary: r.event_summary,
        })),
        existing_progressions: existing.map((p) => ({
          id: p.id,
          type: p.type,
          pattern: p.pattern,
          title: p.title,
          from_state: p.from_state,
          current_state: p.current_state,
          maturity: p.maturity,
        })),
      }),
      maxTokens: 1600,
      temperature: 0.3,
    });

    const proposals = parseCrossTimeReading(
      extractJson(rawCrossTime),
      [log.id, ...related.map((r) => r.id)],
      existing.map((p) => p.id)
    );

    const applied: ProgressionRow[] = [];
    const joined: string[] = [];
    let emergedId: string | null = null;
    let emergedCount = 0;
    let pool = existing;

    for (const proposal of proposals) {
      const result = await applyProposal(db, {
        userId: user.id,
        logId: log.id,
        occurredAt: log.occurred_at,
        proposal,
        existing: pool,
      });
      // null means the proposal did not clear the two-record bar.
      if (!result) continue;

      applied.push(result.row);
      joined.push(result.row.id);
      // §32's moment: separate points becoming a line. Only the first one is
      // announced — two at once would make it an event rather than a noticing.
      if (result.emerged && !emergedId) {
        emergedId = result.row.id;
        emergedCount = Math.max(
          MIN_EVIDENCE_FOR_PROGRESSION,
          (await evidenceCounts(db, [result.row.id])).get(result.row.id) ?? 0
        );
      }
      pool = result.created
        ? [...pool, result.row]
        : pool.map((p) => (p.id === result.row.id ? result.row : p));
    }

    const surviving = await consolidate(db, provider, user.id);

    return jsonResponse({
      analysis: toWire(analysis, log.id),
      progressions: applied.map((p) => surviving.get(p.id) ?? p),
      joined_progression_ids: joined.map((id) => surviving.get(id)?.id ?? id),
      emerged_progression_id: emergedId ? (surviving.get(emergedId)?.id ?? emergedId) : null,
      emerged_count: emergedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});

/**
 * What the person said they wanted to grow this year (§4, §19).
 *
 * Absent is a working state: a person who never opened the year screens has
 * no lens, and the reading runs without one — it simply has no priority to
 * apply.
 */
async function loadLenses(
  db: ReturnType<typeof serviceClient>,
  userId: string,
  occurredOn: string
): Promise<string[]> {
  const year = Number(occurredOn.slice(0, 4));
  const { data } = await db
    .from('year_directions')
    .select('progression_lenses')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle();
  const row = data as { progression_lenses: string[] | null } | null;
  return row?.progression_lenses ?? [];
}

function toWire(
  analysis: ReturnType<typeof parseLogAnalysis>,
  logId: string
): Record<string, unknown> {
  return {
    log_id: logId,
    event_summary: analysis.eventSummary,
    themes: analysis.themes,
    people: analysis.people,
    action: analysis.action ?? null,
    outcome: analysis.outcome ?? null,
    friction: analysis.friction ?? null,
    discovery: analysis.discovery ?? null,
    adaptation: analysis.adaptation ?? null,
    choice: analysis.choice ?? null,
    environment: analysis.environment ?? null,
    interest_signal: analysis.interestSignal ?? null,
    journey_role: analysis.journeyRole ?? null,
    confidence: analysis.confidence,
  };
}

/**
 * Progression consolidation.
 *
 * Surface similarity only nominates a pair; the model has to agree they are
 * the same movement before anything is folded together, and it is told to
 * decline whenever nuance would be lost. A progression the person has edited
 * is theirs and is never a candidate.
 */
async function consolidate(
  db: ReturnType<typeof serviceClient>,
  provider: ReturnType<typeof createProvider>,
  userId: string
): Promise<Map<string, ProgressionRow>> {
  const result = new Map<string, ProgressionRow>();
  const progressions = await loadProgressions(db, userId);
  if (progressions.length < 2) return result;

  const counts = await evidenceCounts(
    db,
    progressions.map((p) => p.id)
  );

  const candidates = nominateConsolidations(
    progressions.map((p) => ({
      id: p.id,
      type: p.type as ProgressionType,
      title: p.title,
      evidenceCount: counts.get(p.id) ?? 0,
      userEdited: p.user_edited,
    }))
  ).slice(0, MAX_CONSOLIDATION_CHECKS);

  const byId = new Map(progressions.map((p) => [p.id, p]));

  for (const candidate of candidates) {
    const source = byId.get(candidate.sourceId);
    const target = byId.get(candidate.targetId);
    if (!source || !target) continue;

    let merge = false;
    let title: string | undefined;
    try {
      const raw = await provider.complete({
        system: CONSOLIDATION_SYSTEM,
        user: JSON.stringify({
          task: 'progression_consolidation',
          type: target.type,
          a: target.title,
          b: source.title,
        }),
        maxTokens: 200,
        temperature: 0.1,
      });
      const parsed = extractJson(raw) as { merge?: unknown; label?: unknown };
      merge = parsed.merge === true;
      if (typeof parsed.label === 'string' && parsed.label.trim().length > 0) {
        title = parsed.label.trim();
      }
    } catch {
      // Unreachable model, or an unusable answer: leave both standing.
      continue;
    }

    if (!merge) continue;
    await mergeProgressions(db, {
      sourceId: source.id,
      targetId: target.id,
      ...(title ? { title } : {}),
    });

    const { data: refreshed } = await db
      .from('progressions')
      .select('*')
      .eq('id', target.id)
      .maybeSingle();
    if (refreshed) result.set(source.id, refreshed as ProgressionRow);
  }

  return result;
}
