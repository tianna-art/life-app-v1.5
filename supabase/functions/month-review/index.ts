// §25 — the month-end reading.
//
// Five sections, and the first two are the point: what the month set out with,
// then what actually happened. §7 forbids reading a divergence as a shortfall
// and forbids the consoling sentence, so when nothing recurred the month is
// allowed to stay undecided.
import { createProvider } from '../_shared/llm.ts';
import { MONTH_REVIEW_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import {
  isGainCategory,
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
  title: string;
  pattern: string | null;
  from_state: string | null;
  current_state: string | null;
  summary: string;
  maturity: ProgressionMaturity;
  goal_external: boolean;
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
    const year = Number(periodKey.slice(0, 4));
    const month = Number(periodKey.slice(5, 7));
    const from = `${periodKey}-01`;
    const to = `${periodKey}-31`;

    const { data: logs } = await db
      .from('logs')
      .select('id, occurred_on, type, moment_tags, ai_question, optional_answer, body')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true });

    const monthLogs = (logs ?? []) as {
      id: string;
      occurred_on: string;
      type: string;
      moment_tags: string[] | null;
      ai_question: string | null;
      optional_answer: string | null;
      body: string | null;
    }[];

    // A month with nothing in it is not summarised, and is not apologised for.
    if (monthLogs.length === 0) return jsonResponse({ title: '' });

    const monthLogIds = new Set(monthLogs.map((l) => l.id));

    const [{ data: allEvidence }, { data: theme }] = await Promise.all([
      db.from('progression_evidence').select('progression_id, log_id, role, occurred_at'),
      db
        .from('month_themes')
        .select('initial_theme')
        .eq('user_id', user.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle(),
    ]);

    const initialTheme = (theme as { initial_theme: string | null } | null)?.initial_theme ?? '';
    const evidence = (allEvidence ?? []) as EvidenceRow[];

    const movedIds = [
      ...new Set(evidence.filter((e) => monthLogIds.has(e.log_id)).map((e) => e.progression_id)),
    ];

    const monthEnd = `${to}T23:59:59.999Z`;
    let ranked: { row: ProgressionRow; count: number }[] = [];

    if (movedIds.length > 0) {
      const { data: rows } = await db
        .from('progressions')
        .select('id, title, pattern, from_state, current_state, summary, maturity, goal_external')
        .eq('user_id', user.id)
        .is('merged_into_id', null)
        .in('id', movedIds);

      ranked = ((rows ?? []) as ProgressionRow[])
        .map((row) => {
          // Where it stood at the end of that month, not where it is now.
          const path = evidence
            .filter((e) => e.progression_id === row.id && e.occurred_at <= monthEnd)
            .map((e) => ({
              logId: e.log_id,
              role: e.role as never,
              occurredAt: e.occurred_at,
            }));
          return { row, summary: summariseEvidencePath(path) };
        })
        // A progression that had not cleared the bar by the end of that month
        // was not a movement in it, whatever it has become since.
        .filter((item) => qualifiesAsProgression(item.summary))
        .sort(
          (a, b) =>
            maturityRank(b.row.maturity) - maturityRank(a.row.maturity) ||
            b.summary.distinctLogCount - a.summary.distinctLogCount
        )
        .slice(0, 3)
        .map((item) => ({ row: item.row, count: item.summary.distinctLogCount }));
    }

    const { data: gains } = await db
      .from('gains')
      .select('progression_id, category, label')
      .in('progression_id', ranked.length > 0 ? ranked.map((r) => r.row.id) : ['00000000-0000-0000-0000-000000000000']);

    const provider = createProvider();
    const raw = await provider.complete({
      system: MONTH_REVIEW_SYSTEM,
      user: JSON.stringify({
        task: 'month_review',
        period_key: periodKey,
        initial_theme: initialTheme || null,
        log_count: monthLogs.length,
        progressions: ranked.map(({ row, count }) => ({
          title: row.title,
          pattern: row.pattern,
          from_state: row.from_state,
          current_state: row.current_state,
          summary: row.summary,
          maturity: row.maturity,
          // §19: a movement that grew outside the year's direction is named as
          // such rather than quietly folded in with the rest.
          goal_external: row.goal_external,
          evidence_count: count,
        })),
        gains: gains ?? [],
        logs: monthLogs.slice(0, 40).map((l) => ({
          occurred_on: l.occurred_on,
          log_type: l.type,
          moment_tags: l.moment_tags ?? [],
          question: l.ai_question,
          answer: l.optional_answer ?? l.body,
        })),
      }),
      maxTokens: 1200,
      temperature: 0.4,
    });

    const parsed = extractJson(raw) as Record<string, unknown>;
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (title.length === 0) return jsonResponse({ title: '' });

    // Titles are pinned to the stored ones: the month screen must name the
    // same progressions the map does, not paraphrases of them.
    const allowed = new Set(ranked.map(({ row }) => row.title));
    const changed = Array.isArray(parsed.changed)
      ? parsed.changed
          .flatMap((item) => {
            if (typeof item !== 'object' || item === null) return [];
            const c = item as Record<string, unknown>;
            const itemTitle = typeof c.title === 'string' ? c.title.trim() : '';
            if (!allowed.has(itemTitle)) return [];
            return [{ title: itemTitle, line: typeof c.line === 'string' ? c.line.trim() : '' }];
          })
          .slice(0, 3)
      : [];

    const gained = Array.isArray(parsed.gained)
      ? parsed.gained
          .flatMap((item) => {
            if (typeof item !== 'object' || item === null) return [];
            const g = item as Record<string, unknown>;
            const label = typeof g.label === 'string' ? g.label.trim() : '';
            // A gain with no category is dropped: guessing one would put a
            // word in the person's mouth about what kind of thing they have.
            if (label.length === 0 || !isGainCategory(g.category)) return [];
            return [{ category: g.category, label }];
          })
          .slice(0, 3)
      : [];

    const titleCandidates = Array.isArray(parsed.title_candidates)
      ? parsed.title_candidates
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
          .slice(0, 3)
      : [];

    const review = {
      initial_theme: initialTheme,
      what_actually_happened:
        typeof parsed.what_actually_happened === 'string'
          ? parsed.what_actually_happened.trim()
          : '',
      changed,
      gained,
      title_candidates: titleCandidates,
      title,
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : '',
    };

    await db.from('month_reviews').upsert(
      {
        user_id: user.id,
        period_key: periodKey,
        initial_theme: review.initial_theme,
        what_actually_happened: review.what_actually_happened,
        progressions: review.changed,
        gained: review.gained,
        title_candidates: review.title_candidates,
        title: review.title,
        subtitle: review.subtitle,
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
