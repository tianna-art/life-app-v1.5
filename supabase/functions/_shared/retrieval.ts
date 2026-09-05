// Related-log retrieval (§29).
//
// STAGE 2 compares the new record with earlier ones, and §29 is explicit that
// every log must not be sent to the model on every save. This picks a small
// window instead.
//
// The ranking is deliberately not "most recent". A progression that only shows
// up across months — "怖い" in April and "初対面にも説明した" in August — is
// exactly the kind a recency window would never find, so overlap of topic and
// signal decides, and age only breaks ties.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface ContextLog {
  id: string;
  occurred_on: string;
  occurred_at: string;
  type: string;
  moment_tags: string[];
  optional_answer: string | null;
  body: string | null;
  event_summary: string | null;
  journey_role: string | null;
  topics: string[];
}

/** How many earlier records STAGE 2 is allowed to see. */
export const RETRIEVAL_WINDOW = 12;
/** How far back retrieval looks at all. A year is what the map shows. */
const LOOKBACK_DAYS = 400;
/** Rows pulled before ranking. Bounded so a long history stays one query. */
const CANDIDATE_LIMIT = 400;

interface LogRow {
  id: string;
  occurred_on: string;
  occurred_at: string;
  type: string;
  moment_tags: string[] | null;
  optional_answer: string | null;
  body: string | null;
}

interface AnalysisRow {
  log_id: string;
  event_summary: string | null;
  journey_role: string | null;
  topics: string[] | null;
}

function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  let shared = 0;
  for (const item of b) if (set.has(item)) shared += 1;
  // Normalised by the smaller side: two records sharing both of their two
  // topics are as related as two sharing six of six.
  return shared / Math.min(a.length, b.length);
}

/**
 * The window STAGE 2 sees: the records most likely to belong to the same
 * thread as this record, oldest first so the model reads a timeline.
 */
export async function retrieveRelatedLogs(
  db: SupabaseClient,
  userId: string,
  input: {
    excludeLogId: string;
    topics: readonly string[];
    momentTags: readonly string[];
    logType: string;
    occurredAt: string;
  }
): Promise<ContextLog[]> {
  const since = new Date(Date.parse(input.occurredAt) - LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: logs, error } = await db
    .from('logs')
    .select('id, occurred_on, occurred_at, type, moment_tags, optional_answer, body')
    .eq('user_id', userId)
    .neq('id', input.excludeLogId)
    .gte('occurred_on', since)
    .order('occurred_on', { ascending: false })
    .limit(CANDIDATE_LIMIT);
  if (error) throw error;

  const rows = (logs ?? []) as LogRow[];
  if (rows.length === 0) return [];

  const { data: analyses } = await db
    .from('log_ai_analysis')
    .select('log_id, event_summary, journey_role, topics')
    .in(
      'log_id',
      rows.map((r) => r.id)
    );

  const byLog = new Map(((analyses ?? []) as AnalysisRow[]).map((a) => [a.log_id, a]));

  const scored = rows.map((row) => {
    const analysis = byLog.get(row.id);
    const topics = analysis?.topics ?? [];
    const tags = row.moment_tags ?? [];

    // Most v4 records carry no free text at all, so topic overlap is often
    // zero on both sides and cannot be the only signal. What the person
    // tapped is the evidence that always exists (§16), which is why tags and
    // the door carry most of the weight here.
    const tagScore = overlap(input.momentTags, tags);
    const doorScore = row.type === input.logType ? 1 : 0;

    // An unread record scores nothing on topics, so a small floor keeps the
    // newest few reachable while their reading is still in flight — the
    // common case moments after a save.
    const unread = analysis ? 0 : 0.15;

    return {
      row,
      analysis,
      topics,
      score:
        overlap(input.topics, topics) * 0.4 + tagScore * 0.35 + doorScore * 0.15 + unread,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.row.occurred_at.localeCompare(a.row.occurred_at))
    .slice(0, RETRIEVAL_WINDOW)
    // Oldest first: the model is being asked to read a sequence, and giving it
    // one out of order is the easiest way to get a backwards trajectory back.
    .sort((a, b) => a.row.occurred_at.localeCompare(b.row.occurred_at))
    .map(({ row, analysis, topics }) => ({
      id: row.id,
      occurred_on: row.occurred_on,
      occurred_at: row.occurred_at,
      type: row.type,
      moment_tags: row.moment_tags ?? [],
      optional_answer: row.optional_answer,
      body: row.body,
      event_summary: analysis?.event_summary ?? null,
      journey_role: analysis?.journey_role ?? null,
      topics,
    }));
}
