// The single-entry reading (§9, §10).
//
// Runs after the entry is already committed. A failure here returns an error
// to the caller and never touches the stored record: the person keeps their
// text whatever the model does.
//
// What the model decides: what happened, what it connects to, and what — if
// anything — remained. What the code decides: how far any of that is allowed
// to go. The second half is in `_shared/gainRules.ts` and is not negotiable
// by prompt.
import { createProvider } from '../_shared/llm.ts';
import { GAIN_ANALYSIS_SYSTEM, CONSOLIDATION_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import {
  clampStatus,
  nominateConsolidations,
  parseLogAnalysis,
  type GainType,
} from '../_shared/gainRules.ts';
import {
  applyGainProposal,
  evidenceCounts,
  loadGains,
  loadRecentLogs,
  mergeGain,
  summariseEvidence,
  type GainRow,
} from '../_shared/gainStore.ts';

const ANALYSIS_VERSION = 'v2-gain';
/** Consolidation asks the model; a handful of questions per save is enough. */
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
      .select('id, user_id, body, input_category, occurred_on, occurred_at')
      .eq('id', logId)
      .single();
    if (error || !log) return jsonResponse({ error: 'log not found' }, 404);
    if (log.user_id !== user.id) return jsonResponse({ error: 'forbidden' }, 403);

    const [recent, existingGains] = await Promise.all([
      loadRecentLogs(db, user.id, logId),
      loadGains(db, user.id),
    ]);

    const provider = createProvider();
    const raw = await provider.complete({
      system: GAIN_ANALYSIS_SYSTEM,
      user: JSON.stringify({
        task: 'gain_analysis',
        today: {
          log_id: log.id,
          occurred_on: log.occurred_on,
          input_category: log.input_category,
          body: log.body,
        },
        recent_logs: recent.map((r) => ({
          log_id: r.id,
          occurred_on: r.occurred_on,
          input_category: r.input_category,
          body: r.body,
          event_summary: r.event_summary,
          journey_role: r.journey_role,
        })),
        existing_gains: existingGains.map((g) => ({
          id: g.id,
          type: g.type,
          label: g.label,
          maturity: g.maturity,
        })),
      }),
      maxTokens: 1200,
      temperature: 0.3,
    });

    const parsed = parseLogAnalysis(
      extractJson(raw),
      recent.map((r) => r.id),
      existingGains.map((g) => g.id)
    );

    // Links first: the evidence summary reads them when it decides whether a
    // gain has anything showing a difference from before.
    if (parsed.possibleLinks.length > 0) {
      await db.from('journey_links').upsert(
        parsed.possibleLinks.map((link) => ({
          from_log_id: link.previousLogId,
          to_log_id: log.id,
          relation: link.relation,
          confidence: link.confidence,
        })),
        { onConflict: 'from_log_id,to_log_id' }
      );
    }

    const applied: GainRow[] = [];
    let pool = existingGains;
    for (const proposal of parsed.gains) {
      const result = await applyGainProposal(db, {
        userId: user.id,
        logId: log.id,
        occurredAt: log.occurred_at,
        proposal,
        existing: pool,
      });
      applied.push(result.row);
      pool = result.created
        ? [...pool, result.row]
        : pool.map((g) => (g.id === result.row.id ? result.row : g));
    }

    // A first sighting is never `confirmed`, whatever the model said.
    const strongest = applied.length
      ? Math.max(
          ...(await Promise.all(
            applied.map(async (g) => (await summariseEvidence(db, g.id)).distinctLogCount)
          ))
        )
      : 0;
    const gainStatus = applied.length === 0 ? 'unresolved' : clampStatus(parsed.gainStatus, strongest);

    await db.from('log_ai_analysis').upsert(
      {
        log_id: log.id,
        event_summary: parsed.eventSummary || log.body.slice(0, 120),
        journey_role: parsed.journeyRole,
        gain_status: gainStatus,
        semantic_tags: parsed.semanticTags,
        keywords: [],
        model_name: `${provider.name}:${provider.model}`,
        analysis_version: ANALYSIS_VERSION,
        raw_json: parsed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'log_id' }
    );

    const surviving = await consolidate(db, provider, user.id);

    return jsonResponse({
      analysis: {
        log_id: log.id,
        event_summary: parsed.eventSummary,
        journey_role: parsed.journeyRole,
        gain_status: gainStatus,
        semantic_tags: parsed.semanticTags,
      },
      gains: applied.map((g) => surviving.get(g.id) ?? g),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});

/**
 * Gain consolidation (§26).
 *
 * Surface similarity only nominates a pair; the model has to agree that they
 * mean the same thing before anything is folded together, and it is told to
 * decline whenever nuance would be lost. Returns a map from any absorbed id to
 * the row that now stands for it, so the response never points at a merged
 * gain.
 */
async function consolidate(
  db: ReturnType<typeof serviceClient>,
  provider: ReturnType<typeof createProvider>,
  userId: string
): Promise<Map<string, GainRow>> {
  const result = new Map<string, GainRow>();
  const gains = await loadGains(db, userId);
  if (gains.length < 2) return result;

  const counts = await evidenceCounts(
    db,
    gains.map((g) => g.id)
  );
  const candidates = nominateConsolidations(
    gains.map((g) => ({
      id: g.id,
      type: g.type as GainType,
      label: g.label,
      evidenceCount: counts.get(g.id) ?? 0,
    }))
  ).slice(0, MAX_CONSOLIDATION_CHECKS);

  const byId = new Map(gains.map((g) => [g.id, g]));

  for (const candidate of candidates) {
    const source = byId.get(candidate.sourceId);
    const target = byId.get(candidate.targetId);
    if (!source || !target) continue;
    // A gain the person has already corrected is theirs; leave it alone.
    if (source.verdict === 'adjusted' || target.verdict === 'adjusted') continue;

    let merge = false;
    let label: string | undefined;
    try {
      const raw = await provider.complete({
        system: CONSOLIDATION_SYSTEM,
        user: JSON.stringify({
          task: 'gain_consolidation',
          type: target.type,
          a: target.label,
          b: source.label,
        }),
        maxTokens: 200,
        temperature: 0.1,
      });
      const parsed = extractJson(raw) as { merge?: unknown; label?: unknown };
      merge = parsed.merge === true;
      if (typeof parsed.label === 'string' && parsed.label.trim().length > 0) {
        label = parsed.label.trim();
      }
    } catch {
      // Unreachable model, or unusable answer: leave both gains standing.
      continue;
    }

    if (!merge) continue;
    await mergeGain(db, {
      sourceId: source.id,
      targetId: target.id,
      ...(label ? { label } : {}),
    });

    const { data: refreshed } = await db
      .from('gains')
      .select('*')
      .eq('id', target.id)
      .maybeSingle();
    if (refreshed) result.set(source.id, refreshed as GainRow);
  }

  return result;
}
