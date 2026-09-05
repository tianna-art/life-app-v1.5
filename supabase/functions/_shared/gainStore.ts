/**
 * Everything the analysis writes, in one place.
 *
 * The Edge Function runs with the service role, so it is the only caller that
 * may create a gain. Each write is scoped by an explicit user id — the service
 * key bypasses RLS, so that scoping is the security boundary, not a nicety.
 */
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  clampMaturity,
  daysBetween,
  maxMaturity,
  normalizeLabel,
  type EvidenceRelation,
  type EvidenceSummary,
  type GainMaturity,
  type GainType,
  type JourneyRole,
  type RawGainProposal,
} from './gainRules.ts';

export interface GainRow {
  id: string;
  user_id: string;
  type: GainType;
  label: string;
  maturity: GainMaturity;
  confidence: number;
  first_detected_at: string;
  last_detected_at: string;
  verdict: 'accepted' | 'adjusted' | null;
  merged_into_id: string | null;
}

export interface ContextLog {
  id: string;
  occurred_on: string;
  occurred_at: string;
  input_category: string;
  body: string;
  event_summary: string | null;
  journey_role: JourneyRole | null;
}

/** Recent records, newest first, as the model's window onto the past. */
export async function loadRecentLogs(
  db: SupabaseClient,
  userId: string,
  excludeLogId: string,
  limit = 40
): Promise<ContextLog[]> {
  const { data, error } = await db
    .from('logs')
    .select('id, occurred_on, occurred_at, input_category, body')
    .eq('user_id', userId)
    .neq('id', excludeLogId)
    .order('occurred_on', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Array<Omit<ContextLog, 'event_summary' | 'journey_role'>>;
  if (rows.length === 0) return [];

  const { data: analyses } = await db
    .from('log_ai_analysis')
    .select('log_id, event_summary, journey_role')
    .in(
      'log_id',
      rows.map((r) => r.id)
    );
  const byLog = new Map(
    ((analyses ?? []) as Array<{
      log_id: string;
      event_summary: string | null;
      journey_role: JourneyRole | null;
    }>).map((a) => [a.log_id, a])
  );

  return rows.map((row) => ({
    ...row,
    event_summary: byLog.get(row.id)?.event_summary ?? null,
    journey_role: byLog.get(row.id)?.journey_role ?? null,
  }));
}

export async function loadGains(db: SupabaseClient, userId: string): Promise<GainRow[]> {
  const { data, error } = await db
    .from('gains')
    .select('*')
    .eq('user_id', userId)
    .is('merged_into_id', null)
    .order('last_detected_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GainRow[];
}

export async function evidenceCounts(
  db: SupabaseClient,
  gainIds: string[]
): Promise<Map<string, number>> {
  if (gainIds.length === 0) return new Map();
  const { data } = await db.from('gain_evidence').select('gain_id').in('gain_id', gainIds);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ gain_id: string }>) {
    counts.set(row.gain_id, (counts.get(row.gain_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * What the stored evidence for a gain actually amounts to — read back from the
 * database rather than taken from the model, which is the whole point of the
 * maturity ceiling.
 */
export async function summariseEvidence(
  db: SupabaseClient,
  gainId: string
): Promise<EvidenceSummary> {
  const { data: evidence } = await db
    .from('gain_evidence')
    .select('log_id, relation')
    .eq('gain_id', gainId);
  const rows = (evidence ?? []) as Array<{ log_id: string; relation: EvidenceRelation }>;
  const logIds = [...new Set(rows.map((r) => r.log_id))];
  if (logIds.length === 0) {
    return { distinctLogCount: 0, spanDays: 0, hasContrast: false, roles: [] };
  }

  const [{ data: logs }, { data: analyses }, { data: links }] = await Promise.all([
    db.from('logs').select('id, occurred_at').in('id', logIds),
    db.from('log_ai_analysis').select('log_id, journey_role').in('log_id', logIds),
    db.from('journey_links').select('relation, to_log_id').in('to_log_id', logIds),
  ]);

  const times = ((logs ?? []) as Array<{ occurred_at: string }>).map((l) => l.occurred_at).sort();
  const first = times[0];
  const last = times[times.length - 1];

  const roles = ((analyses ?? []) as Array<{ journey_role: JourneyRole | null }>)
    .map((a) => a.journey_role)
    .filter((r): r is JourneyRole => r !== null);

  const hasContrast =
    ((links ?? []) as Array<{ relation: string }>).some(
      (l) => l.relation === 'contrast' || l.relation === 'progression' || l.relation === 'adaptation'
    ) || rows.some((r) => r.relation === 'contradicts' || r.relation === 'strengthened');

  return {
    distinctLogCount: logIds.length,
    spanDays: first && last ? daysBetween(first, last) : 0,
    hasContrast,
    roles,
  };
}

export interface AppliedGain {
  row: GainRow;
  created: boolean;
}

/**
 * Attach one proposal to the person's gains.
 *
 * The proposal decides *what* was noticed; the stored evidence decides how far
 * it is allowed to go. A gain the model recognised is strengthened rather than
 * duplicated, and an exact label match is treated as the same gain even when
 * the model forgot to say so.
 */
export async function applyGainProposal(
  db: SupabaseClient,
  input: {
    userId: string;
    logId: string;
    occurredAt: string;
    proposal: RawGainProposal;
    existing: GainRow[];
  }
): Promise<AppliedGain> {
  const label = normalizeLabel(input.proposal.label);
  const matched =
    (input.proposal.existingGainId
      ? input.existing.find((g) => g.id === input.proposal.existingGainId)
      : undefined) ??
    input.existing.find((g) => g.type === input.proposal.type && g.label === label);

  let row: GainRow;
  let created = false;

  if (matched) {
    row = matched;
  } else {
    const { data, error } = await db
      .from('gains')
      .insert({
        user_id: input.userId,
        type: input.proposal.type,
        label,
        maturity: 'signal',
        confidence: input.proposal.confidence,
        first_detected_at: input.occurredAt,
        last_detected_at: input.occurredAt,
      })
      .select()
      .single();
    if (error) {
      // A concurrent save may have created the same (type, label) first.
      const { data: raced } = await db
        .from('gains')
        .select('*')
        .eq('user_id', input.userId)
        .eq('type', input.proposal.type)
        .eq('label', label)
        .maybeSingle();
      if (!raced) throw error;
      row = raced as GainRow;
    } else {
      row = data as GainRow;
      created = true;
    }
  }

  const relation: EvidenceRelation = created ? 'created' : 'strengthened';
  await db.from('gain_evidence').upsert(
    {
      gain_id: row.id,
      log_id: input.logId,
      relation,
      note: input.proposal.evidence.slice(0, 400),
    },
    { onConflict: 'gain_id,log_id' }
  );

  // Now that the evidence exists, recompute what it can carry.
  const summary = await summariseEvidence(db, row.id);
  const maturity = clampMaturity(
    maxMaturity(row.maturity, input.proposal.maturity),
    summary
  );
  const lastDetectedAt =
    input.occurredAt > row.last_detected_at ? input.occurredAt : row.last_detected_at;
  const firstDetectedAt =
    input.occurredAt < row.first_detected_at ? input.occurredAt : row.first_detected_at;

  const { data: updated, error: updateError } = await db
    .from('gains')
    .update({
      maturity,
      confidence: Math.max(row.confidence, input.proposal.confidence),
      first_detected_at: firstDetectedAt,
      last_detected_at: lastDetectedAt,
    })
    .eq('id', row.id)
    .select()
    .single();
  if (updateError) throw updateError;

  return { row: updated as GainRow, created };
}

/**
 * Fold one gain into another (§26).
 *
 * The absorbed row is kept and marked, so the merge is reversible and no
 * evidence is ever orphaned; its evidence is re-pointed at the survivor.
 */
export async function mergeGain(
  db: SupabaseClient,
  input: { sourceId: string; targetId: string; label?: string }
): Promise<void> {
  if (input.sourceId === input.targetId) return;

  const { data: evidence } = await db
    .from('gain_evidence')
    .select('log_id, relation, note')
    .eq('gain_id', input.sourceId);

  for (const row of (evidence ?? []) as Array<{
    log_id: string;
    relation: EvidenceRelation;
    note: string | null;
  }>) {
    await db
      .from('gain_evidence')
      .upsert(
        { gain_id: input.targetId, log_id: row.log_id, relation: row.relation, note: row.note },
        { onConflict: 'gain_id,log_id' }
      );
  }

  await db.from('gains').update({ merged_into_id: input.targetId }).eq('id', input.sourceId);

  const summary = await summariseEvidence(db, input.targetId);
  const { data: target } = await db
    .from('gains')
    .select('maturity, verdict')
    .eq('id', input.targetId)
    .single();

  const patch: Record<string, unknown> = {
    maturity: clampMaturity((target as { maturity: GainMaturity }).maturity, summary),
  };
  // A label the person corrected themselves is never overwritten by a merge.
  if (input.label && (target as { verdict: string | null }).verdict !== 'adjusted') {
    patch.label = normalizeLabel(input.label);
  }
  await db.from('gains').update(patch).eq('id', input.targetId);
}
