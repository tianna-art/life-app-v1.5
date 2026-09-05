// §6 — Continue / Deepen / Follow the Spark.
//
// Written from last month's records so the person is not asked to invent a
// goal on the first of the month. Three candidates at most, and fewer when
// there is less to go on: a month with nothing behind it gets none, which is
// correct — offering three anyway would be asking for a goal, which is the
// thing §6 exists to avoid.
import { createProvider } from '../_shared/llm.ts';
import { MONTH_THEME_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';

const MAX_THEME_LENGTH = 20;
const MAX_BECAUSE_LENGTH = 30;

interface Candidate {
  source: 'continue' | 'deepen' | 'follow_spark';
  theme: string;
  because: string;
}

function readCandidate(raw: unknown): Candidate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const source = c.source;
  if (source !== 'continue' && source !== 'deepen' && source !== 'follow_spark') return null;
  const theme = typeof c.theme === 'string' ? c.theme.trim() : '';
  if (theme.length === 0 || theme.length > MAX_THEME_LENGTH) return null;
  const because = typeof c.because === 'string' ? c.because.trim().slice(0, MAX_BECAUSE_LENGTH) : '';
  return { source, theme, because };
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { year, month } = (await request.json()) as { year?: number; month?: number };
    if (!year || !month || month < 1 || month > 12) {
      return jsonResponse({ error: 'year and month are required' }, 400);
    }

    const db = serviceClient();
    const previous = previousMonth(year, month);
    const from = `${previous.year}-${pad(previous.month)}-01`;
    const to = `${previous.year}-${pad(previous.month)}-31`;

    const { data: logs } = await db
      .from('logs')
      .select('occurred_on, type, moment_tags, optional_answer, body')
      .eq('user_id', user.id)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: true });

    const previousLogs = (logs ?? []) as {
      occurred_on: string;
      type: string;
      moment_tags: string[] | null;
      optional_answer: string | null;
      body: string | null;
    }[];

    // No previous month, no continuation and nothing to deepen. A first month
    // is offered nothing rather than an invented direction.
    if (previousLogs.length === 0) return jsonResponse({ candidates: [] });

    const [{ data: direction }, { data: previousTheme }, { data: progressions }] =
      await Promise.all([
        db
          .from('year_directions')
          .select('progression_lenses')
          .eq('user_id', user.id)
          .eq('year', year)
          .maybeSingle(),
        db
          .from('month_themes')
          .select('initial_theme, final_theme')
          .eq('user_id', user.id)
          .eq('year', previous.year)
          .eq('month', previous.month)
          .maybeSingle(),
        db
          .from('progressions')
          .select('title, pattern, from_state, current_state, maturity, goal_external')
          .eq('user_id', user.id)
          .is('merged_into_id', null)
          .order('last_updated_at', { ascending: false })
          .limit(8),
      ]);

    const provider = createProvider();
    const raw = await provider.complete({
      system: MONTH_THEME_SYSTEM,
      user: JSON.stringify({
        task: 'month_theme',
        lenses:
          (direction as { progression_lenses: string[] | null } | null)?.progression_lenses ?? [],
        previous_theme: previousTheme ?? null,
        // What is still moving, so `continue` and `deepen` have something to
        // point at rather than being written from the month's mood.
        progressions: progressions ?? [],
        previous_logs: previousLogs.slice(0, 40).map((l) => ({
          occurred_on: l.occurred_on,
          log_type: l.type,
          moment_tags: l.moment_tags ?? [],
          answer: l.optional_answer ?? l.body,
        })),
        // Repeated enjoyment is what `follow_spark` is for (§19), so it is
        // counted here rather than left for the model to notice.
        enjoyed_count: previousLogs.filter((l) => (l.moment_tags ?? []).includes('enjoyed'))
          .length,
      }),
      maxTokens: 1000,
      temperature: 0.5,
    });

    const parsed = extractJson(raw) as { candidates?: unknown };
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates
          .map(readCandidate)
          .filter((c): c is Candidate => c !== null)
          .slice(0, 3)
      : [];

    return jsonResponse({ candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
