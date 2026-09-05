// The two stages of §29, in one round trip.
//
// STAGE 1 reads the entry on its own. STAGE 2 compares it with the records
// retrieval turned up and decides whether anything is a movement. Splitting
// them across the network would double the latency of a save for no benefit —
// nothing in between needs to reach the device — but they stay two separate
// model calls, because asking for both at once produces a reading of the entry
// that has already been bent to fit a trajectory.
//
// Runs after the entry is committed. A failure here returns an error and never
// touches the stored record: the person keeps their text whatever the model
// does.
import { createProvider } from '../_shared/llm.ts';
import {
  CONSOLIDATION_SYSTEM,
  CROSS_TIME_SYSTEM,
  ENTRY_EXTRACTION_SYSTEM,
} from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import { retrieveRelatedLogs } from '../_shared/retrieval.ts';
import {
  nominateConsolidations,
  parseCrossTimeReading,
  parseEntryAnalysis,
  type ProgressionType,
} from '../_shared/progressionRules.ts';
import {
  applyProposal,
  evidenceCounts,
  loadProgressions,
  mergeProgressions,
  type ProgressionRow,
} from '../_shared/progressionStore.ts';

const ANALYSIS_VERSION = 'v3-progression';
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
      .select('id, user_id, body, type, subjective_signal, occurred_on, occurred_at')
      .eq('id', logId)
      .single();
    if (error || !log) return jsonResponse({ error: 'log not found' }, 404);
    if (log.user_id !== user.id) return jsonResponse({ error: 'forbidden' }, 403);

    const provider = createProvider();

    // ---- STAGE 1 ---------------------------------------------------------
    const rawExtraction = await provider.complete({
      system: ENTRY_EXTRACTION_SYSTEM,
      user: JSON.stringify({
        task: 'entry_extraction',
        entry: {
          occurred_on: log.occurred_on,
          type: log.type,
          subjective_signal: log.subjective_signal,
          body: log.body,
        },
      }),
      maxTokens: 900,
      temperature: 0.2,
    });

    const analysis = parseEntryAnalysis(extractJson(rawExtraction), log.body);

    await db.from('log_ai_analysis').upsert(
      {
        log_id: log.id,
        event_summary: analysis.eventSummary,
        topics: analysis.topics,
        actors: analysis.actors,
        environment: analysis.environment,
        action: analysis.action ?? null,
        outcome: analysis.outcome ?? null,
        reaction: analysis.reaction ?? null,
        hypothesis: analysis.hypothesis ?? null,
        future_intention: analysis.futureIntention ?? null,
        journey_role: analysis.journeyRole,
        signals: analysis.signals,
        confidence: analysis.confidence,
        keywords: [],
        semantic_tags: analysis.topics,
        model_name: `${provider.name}:${provider.model}`,
        analysis_version: ANALYSIS_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'log_id' }
    );

    // ---- STAGE 2 ---------------------------------------------------------
    const related = await retrieveRelatedLogs(db, user.id, {
      excludeLogId: log.id,
      topics: analysis.topics,
      signals: Object.values(analysis.signals).flat(),
      occurredAt: log.occurred_at,
    });

    // One record on its own is a dot (§31). Nothing to compare, so the second
    // model call is skipped entirely rather than asked and then discarded.
    if (related.length === 0) {
      return jsonResponse({
        analysis: toWire(analysis, log.id),
        progressions: [],
        joined_progression_ids: [],
        emerged: false,
        clarification: null,
      });
    }

    const existing = await loadProgressions(db, user.id);

    const rawCrossTime = await provider.complete({
      system: CROSS_TIME_SYSTEM,
      user: JSON.stringify({
        task: 'cross_time_progression',
        today: {
          log_id: log.id,
          occurred_on: log.occurred_on,
          type: log.type,
          subjective_signal: log.subjective_signal,
          body: log.body,
          event_summary: analysis.eventSummary,
          topics: analysis.topics,
          journey_role: analysis.journeyRole,
        },
        related_logs: related.map((r) => ({
          log_id: r.id,
          occurred_on: r.occurred_on,
          type: r.type,
          subjective_signal: r.subjective_signal,
          body: r.body,
          event_summary: r.event_summary,
          journey_role: r.journey_role,
        })),
        existing_progressions: existing.map((p) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          from_state: p.from_state,
          current_state: p.current_state,
          maturity: p.maturity,
        })),
      }),
      maxTokens: 1600,
      temperature: 0.3,
    });

    const reading = parseCrossTimeReading(
      extractJson(rawCrossTime),
      [log.id, ...related.map((r) => r.id)],
      existing.map((p) => p.id)
    );

    const applied: ProgressionRow[] = [];
    const joined: string[] = [];
    let emerged = false;
    let pool = existing;

    for (const proposal of reading.proposals) {
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
      if (result.emerged) emerged = true;
      pool = result.created
        ? [...pool, result.row]
        : pool.map((p) => (p.id === result.row.id ? result.row : p));
    }

    if (reading.clarification) {
      // A question the person never answered is not repeated for a new entry;
      // §14 allows one outstanding at a time, and the unique index on log_id
      // means a re-run of this function cannot stack a second copy.
      const { count } = await db
        .from('clarifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('answer', null);

      if ((count ?? 0) === 0) {
        await db.from('clarifications').upsert(
          {
            user_id: user.id,
            log_id: log.id,
            question: reading.clarification.question,
            options: reading.clarification.options,
          },
          { onConflict: 'log_id' }
        );
      }
    }

    const surviving = await consolidate(db, provider, user.id);

    const { data: clarificationRow } = await db
      .from('clarifications')
      .select('id, log_id, question, options')
      .eq('log_id', log.id)
      .is('answer', null)
      .maybeSingle();

    return jsonResponse({
      analysis: toWire(analysis, log.id),
      progressions: applied.map((p) => surviving.get(p.id) ?? p),
      joined_progression_ids: joined.map((id) => surviving.get(id)?.id ?? id),
      emerged,
      clarification: clarificationRow ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});

function toWire(
  analysis: ReturnType<typeof parseEntryAnalysis>,
  logId: string
): Record<string, unknown> {
  return {
    log_id: logId,
    event_summary: analysis.eventSummary,
    topics: analysis.topics,
    actors: analysis.actors,
    environment: analysis.environment,
    action: analysis.action ?? null,
    outcome: analysis.outcome ?? null,
    reaction: analysis.reaction ?? null,
    hypothesis: analysis.hypothesis ?? null,
    future_intention: analysis.futureIntention ?? null,
    journey_role: analysis.journeyRole,
    signals: analysis.signals,
    confidence: analysis.confidence,
  };
}

/**
 * Progression consolidation (§30).
 *
 * Surface similarity only nominates a pair; the model has to agree they are
 * the same movement before anything is folded together, and it is told to
 * decline whenever nuance would be lost. A progression the person has edited
 * is theirs and is never a candidate.
 *
 * Returns a map from any absorbed id to the row that now stands for it, so the
 * response never points at a merged progression.
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
