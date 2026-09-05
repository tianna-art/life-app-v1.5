// §26 — the year-end reading.
//
// The same comparison the month makes, one scale up: what the year was thought
// to be about, and what it became. §26 does not ask which was better, and
// neither does this.
import { createProvider } from '../_shared/llm.ts';
import { YEAR_REVIEW_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';
import { isGainCategory, maturityRank, type ProgressionMaturity } from '../_shared/progressionRules.ts';

interface ProgressionRow {
  id: string;
  title: string;
  pattern: string | null;
  from_state: string | null;
  current_state: string | null;
  summary: string;
  maturity: ProgressionMaturity;
  goal_external: boolean;
  first_detected_at: string;
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { year } = (await request.json()) as { year?: number };
    if (!year || year < 2000 || year > 3000) {
      return jsonResponse({ error: 'year is required' }, 400);
    }

    const db = serviceClient();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const [{ count: logCount }, { data: direction }] = await Promise.all([
      db
        .from('logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('occurred_on', from)
        .lte('occurred_on', to),
      db
        .from('year_directions')
        .select('initial_theme')
        .eq('user_id', user.id)
        .eq('year', year)
        .maybeSingle(),
    ]);

    // A year with nothing in it is not summarised.
    if ((logCount ?? 0) === 0) return jsonResponse({ actual_story: '' });

    const initialTheme =
      (direction as { initial_theme: string | null } | null)?.initial_theme ?? '';

    const { data: rows } = await db
      .from('progressions')
      .select(
        'id, title, pattern, from_state, current_state, summary, maturity, goal_external, first_detected_at'
      )
      .eq('user_id', user.id)
      .is('merged_into_id', null)
      .gte('first_detected_at', `${from}T00:00:00Z`)
      .lte('first_detected_at', `${to}T23:59:59Z`);

    const progressions = ((rows ?? []) as ProgressionRow[])
      .sort((a, b) => maturityRank(b.maturity) - maturityRank(a.maturity))
      .slice(0, 8);

    if (progressions.length === 0) return jsonResponse({ actual_story: '' });

    const { data: gains } = await db
      .from('gains')
      .select('progression_id, category, label')
      .in(
        'progression_id',
        progressions.map((p) => p.id)
      );

    const provider = createProvider();
    const raw = await provider.complete({
      system: YEAR_REVIEW_SYSTEM,
      user: JSON.stringify({
        task: 'year_review',
        year,
        initial_theme: initialTheme || null,
        log_count: logCount ?? 0,
        progressions: progressions.map((p) => ({
          title: p.title,
          pattern: p.pattern,
          from_state: p.from_state,
          current_state: p.current_state,
          summary: p.summary,
          maturity: p.maturity,
          // §19: what grew outside the year's direction is named as such. It
          // is often the most interesting thing in a year.
          goal_external: p.goal_external,
        })),
        gains: gains ?? [],
      }),
      maxTokens: 1200,
      temperature: 0.4,
    });

    const parsed = extractJson(raw) as Record<string, unknown>;
    const actualStory =
      typeof parsed.actual_story === 'string' ? parsed.actual_story.trim() : '';
    if (actualStory.length === 0) return jsonResponse({ actual_story: '' });

    const allowed = new Set(progressions.map((p) => p.title));
    const changed = Array.isArray(parsed.progressions)
      ? parsed.progressions
          .flatMap((item) => {
            if (typeof item !== 'object' || item === null) return [];
            const c = item as Record<string, unknown>;
            const title = typeof c.title === 'string' ? c.title.trim() : '';
            if (!allowed.has(title)) return [];
            return [{ title, line: typeof c.line === 'string' ? c.line.trim() : '' }];
          })
          .slice(0, 5)
      : [];

    const gained = Array.isArray(parsed.gained)
      ? parsed.gained
          .flatMap((item) => {
            if (typeof item !== 'object' || item === null) return [];
            const g = item as Record<string, unknown>;
            const label = typeof g.label === 'string' ? g.label.trim() : '';
            if (label.length === 0 || !isGainCategory(g.category)) return [];
            return [{ category: g.category, label }];
          })
          .slice(0, 5)
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
      actual_story: actualStory,
      progressions: changed,
      gained,
      title_candidates: titleCandidates,
    };

    await db.from('year_reviews').upsert(
      {
        user_id: user.id,
        year,
        ...review,
        model_name: `${provider.name}:${provider.model}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,year' }
    );

    return jsonResponse(review);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
