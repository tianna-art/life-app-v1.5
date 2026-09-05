// The month-end reading (§23).
//
// Three progressions at most, and never padded to three: a month with two
// movements says two, and a month with none is not given a title. The screen
// this feeds is the one place the app speaks at any length, so the evidence
// bar is the same as everywhere else — a progression that has not cleared
// §9's two-record threshold does not appear here either.
import { createProvider } from '../_shared/llm.ts';
import { MONTH_PROGRESSIONS_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import {
  maturityRank,
  qualifiesAsProgression,
  summariseEvidencePath,
  type ProgressionMaturity,
} from '../_shared/progressionRules.ts';

interface EvidenceRow {
  progression_id: string;
  log_id: string;
  role: string;
  occurred_at: string;
}

interface ProgressionRow {
  id: string;
  type: string;
  title: string;
  from_state: string | null;
  current_state: string | null;
  summary: string;
  maturity: ProgressionMaturity;
  first_detected_at: string;
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { period_key: periodKey } = (await request.json()) as { period_key?: string };
    if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) {
      return jsonResponse({ error: 'period_key must be YYYY-MM' }, 400);
    }

    const db = serviceClient();
    const from = `${periodKey}-01`;
    const to = `${periodKey}-31`;

    const { data: logs } = await db
      .from('logs')
      .select('id, occurred_on, type, subjective_signal, body')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true });

    const monthLogs = (logs ?? []) as {
      id: string;
      occurred_on: string;
      type: string;
      subjective_signal: string;
      body: string;
    }[];

    // A month with nothing in it is not summarised, and is not apologised for.
    if (monthLogs.length === 0) return jsonResponse({ title: '' });

    const monthLogIds = new Set(monthLogs.map((l) => l.id));

    const { data: allEvidence } = await db
      .from('progression_evidence')
      .select('progression_id, log_id, role, occurred_at');
    const evidence = (allEvidence ?? []) as EvidenceRow[];

    const movedIds = [
      ...new Set(evidence.filter((e) => monthLogIds.has(e.log_id)).map((e) => e.progression_id)),
    ];
    if (movedIds.length === 0) return jsonResponse({ title: '' });

    const { data: rows } = await db
      .from('progressions')
      .select('id, type, title, from_state, current_state, summary, maturity, first_detected_at')
      .eq('user_id', user.id)
      .is('merged_into_id', null)
      .in('id', movedIds);

    const monthEnd = `${to}T23:59:59.999Z`;

    const ranked = ((rows ?? []) as ProgressionRow[])
      .map((row) => {
        // §24: where it stood at the end of that month, not where it is now.
        const path = evidence
          .filter((e) => e.progression_id === row.id && e.occurred_at <= monthEnd)
          .map((e) => ({
            logId: e.log_id,
            role: e.role as never,
            occurredAt: e.occurred_at,
          }));
        return { row, summary: summariseEvidencePath(path) };
      })
      // A progression that had not yet cleared the bar by the end of the month
      // was not a movement in that month, whatever it has become since.
      .filter((item) => qualifiesAsProgression(item.summary))
      .sort(
        (a, b) =>
          maturityRank(b.row.maturity) - maturityRank(a.row.maturity) ||
          b.summary.distinctLogCount - a.summary.distinctLogCount
      )
      .slice(0, 3);

    if (ranked.length === 0) return jsonResponse({ title: '' });

    const provider = createProvider();
    const raw = await provider.complete({
      system: MONTH_PROGRESSIONS_SYSTEM,
      user: JSON.stringify({
        task: 'month_progressions',
        period_key: periodKey,
        entry_count: monthLogs.length,
        progressions: ranked.map(({ row }) => ({
          title: row.title,
          type: row.type,
          from_state: row.from_state,
          current_state: row.current_state,
          summary: row.summary,
          maturity: row.maturity,
        })),
        entries: monthLogs.slice(0, 40).map((l) => ({
          occurred_on: l.occurred_on,
          type: l.type,
          subjective_signal: l.subjective_signal,
          body: l.body,
        })),
      }),
      maxTokens: 900,
      temperature: 0.4,
    });

    const parsed = extractJson(raw) as {
      title?: unknown;
      subtitle?: unknown;
      progressions?: unknown;
      carrying_forward?: unknown;
    };

    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (title.length === 0) return jsonResponse({ title: '' });

    // The titles are pinned to the stored ones: the month screen must name the
    // same progressions the map does, not paraphrases of them.
    const allowed = new Map(ranked.map(({ row }) => [row.title, row]));
    const progressions = Array.isArray(parsed.progressions)
      ? parsed.progressions
          .flatMap((item) => {
            if (typeof item !== 'object' || item === null) return [];
            const p = item as Record<string, unknown>;
            const itemTitle = typeof p.title === 'string' ? p.title.trim() : '';
            if (!allowed.has(itemTitle)) return [];
            return [
              { title: itemTitle, line: typeof p.line === 'string' ? p.line.trim() : '' },
            ];
          })
          .slice(0, 3)
      : [];

    const review = {
      title,
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : '',
      progressions,
      carrying_forward:
        typeof parsed.carrying_forward === 'string' ? parsed.carrying_forward.trim() : '',
    };

    await db.from('month_reviews').upsert(
      {
        user_id: user.id,
        period_key: periodKey,
        title: review.title,
        subtitle: review.subtitle,
        progressions: review.progressions,
        carrying_forward: review.carrying_forward,
        model_name: `${provider.name}:${provider.model}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_key' }
    );

    return jsonResponse(review);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
