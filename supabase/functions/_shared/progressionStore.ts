// Writing progressions, evidence and gains.
//
// Everything the model proposed passes through here, and everything here
// passes through `progressionRules.ts` before it lands: the maturity a row
// ends up with is computed from the evidence actually stored, never from what
// the model asked for.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  clampMaturity,
  maxMaturity,
  normalizeTitle,
  qualifiesAsProgression,
  summariseEvidencePath,
  type ProgressionEvidenceRole,
  type ProgressionMaturity,
  type ProgressionType,
  type RawProgressionProposal,
} from './progressionRules.ts';

export interface ProgressionRow {
  id: string;
  user_id: string;
  type: ProgressionType;
  title: string;
  from_state: string | null;
  current_state: string | null;
  summary: string;
  maturity: ProgressionMaturity;
  confidence: number;
  first_detected_at: string;
  last_updated_at: string;
  verdict: 'accepted' | 'adjusted' | null;
  user_edited: boolean;
  merged_into_id: string | null;
}

interface EvidenceRow {
  log_id: string;
  role: ProgressionEvidenceRole;
  occurred_at: string;
}

export async function loadProgressions(
  db: SupabaseClient,
  userId: string
): Promise<ProgressionRow[]> {
  const { data, error } = await db
    .from('progressions')
    .select('*')
    .eq('user_id', userId)
    .is('merged_into_id', null)
    .order('last_updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProgressionRow[];
}

/** The stored path for one progression, in time order. */
export async function loadEvidencePath(
  db: SupabaseClient,
  progressionId: string
): Promise<EvidenceRow[]> {
  const { data, error } = await db
    .from('progression_evidence')
    .select('log_id, role, occurred_at')
    .eq('progression_id', progressionId)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EvidenceRow[];
}

export async function evidenceCounts(
  db: SupabaseClient,
  progressionIds: readonly string[]
): Promise<Map<string, number>> {
  if (progressionIds.length === 0) return new Map();
  const { data, error } = await db
    .from('progression_evidence')
    .select('progression_id, log_id')
    .in('progression_id', progressionIds);
  if (error) throw error;

  const perProgression = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { progression_id: string; log_id: string }[]) {
    const set = perProgression.get(row.progression_id) ?? new Set<string>();
    set.add(row.log_id);
    perProgression.set(row.progression_id, set);
  }
  return new Map([...perProgression].map(([id, set]) => [id, set.size]));
}

/** The row that now stands for a (type, title), following any merge. */
async function resolveByTitle(
  db: SupabaseClient,
  userId: string,
  type: ProgressionType,
  title: string
): Promise<ProgressionRow | null> {
  const { data } = await db
    .from('progressions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('title', title)
    .maybeSingle();
  if (!data) return null;

  let row = data as ProgressionRow;
  const seen = new Set<string>();
  while (row.merged_into_id && !seen.has(row.id)) {
    seen.add(row.id);
    const { data: next } = await db
      .from('progressions')
      .select('*')
      .eq('id', row.merged_into_id)
      .maybeSingle();
    if (!next) break;
    row = next as ProgressionRow;
  }
  return row;
}

export interface AppliedProgression {
  row: ProgressionRow;
  created: boolean;
  /** True when this save is what took it past the two-record threshold (§32). */
  emerged: boolean;
}

/**
 * Applies one proposal.
 *
 * The order matters and is the whole point: evidence is written first, the
 * maturity ceiling is computed from what is now stored, and only then is the
 * row updated. A model that asked for `established` on two records gets
 * `signal`, and no prompt change can alter that.
 *
 * Returns null when the proposal does not clear §9's two-record bar — the
 * dot stays a dot.
 */
export async function applyProposal(
  db: SupabaseClient,
  input: {
    userId: string;
    logId: string;
    occurredAt: string;
    proposal: RawProgressionProposal;
    existing: readonly ProgressionRow[];
  }
): Promise<AppliedProgression | null> {
  const { proposal } = input;
  const title = normalizeTitle(proposal.title);
  if (title.length === 0) return null;

  // The entry being read always stands in its own progression, even when the
  // model forgot to list it.
  const evidence = new Map<string, ProgressionEvidenceRole>();
  for (const item of proposal.evidence) evidence.set(item.logId, item.role);
  if (!evidence.has(input.logId)) evidence.set(input.logId, 'current');

  if (evidence.size < 2) return null;

  const match =
    (proposal.progressionId
      ? input.existing.find((p) => p.id === proposal.progressionId)
      : undefined) ??
    input.existing.find((p) => p.type === proposal.type && normalizeTitle(p.title) === title);

  let row: ProgressionRow;
  let created = false;

  if (match) {
    row = match;
  } else {
    const { data, error } = await db
      .from('progressions')
      .insert({
        user_id: input.userId,
        type: proposal.type,
        title,
        from_state: proposal.fromState ?? null,
        current_state: proposal.currentState ?? null,
        summary: proposal.summary,
        maturity: 'signal',
        confidence: proposal.confidence,
        first_detected_at: input.occurredAt,
        last_updated_at: input.occurredAt,
      })
      .select('*')
      .single();

    if (error) {
      // (user_id, type, title) is unique across merged rows too, and
      // loadProgressions only ever showed the unmerged ones. Landing on a
      // progression that was folded away earlier is a real case, and the
      // evidence belongs on whatever now stands for it — not on the floor.
      const existing = await resolveByTitle(db, input.userId, proposal.type, title);
      if (!existing) throw error;
      row = existing;
    } else {
      row = data as ProgressionRow;
      created = true;
    }
  }

  const before = await loadEvidencePath(db, row.id);
  const beforeQualified = qualifiesAsProgression(
    summariseEvidencePath(
      before.map((e) => ({ logId: e.log_id, role: e.role, occurredAt: e.occurred_at }))
    )
  );

  // Occurred_at per evidence row comes from the log it points at, not from the
  // entry being saved: HOW IT CHANGED is only in order if these are real dates.
  const logIds = [...evidence.keys()];
  const { data: logs } = await db
    .from('logs')
    .select('id, occurred_at')
    .in('id', logIds)
    .eq('user_id', input.userId);
  const occurredById = new Map(
    ((logs ?? []) as { id: string; occurred_at: string }[]).map((l) => [l.id, l.occurred_at])
  );

  const rows = logIds
    .filter((id) => occurredById.has(id))
    .map((id) => ({
      progression_id: row.id,
      log_id: id,
      role: evidence.get(id) ?? 'evidence',
      occurred_at: occurredById.get(id) as string,
    }));

  if (rows.length > 0) {
    const { error } = await db
      .from('progression_evidence')
      .upsert(rows, { onConflict: 'progression_id,log_id' });
    if (error) throw error;
  }

  const after = await loadEvidencePath(db, row.id);
  const summary = summariseEvidencePath(
    after.map((e) => ({ logId: e.log_id, role: e.role, occurredAt: e.occurred_at }))
  );

  // A progression that still cannot clear the bar is left at signal rather
  // than deleted: the evidence is real, only the claim would not be.
  const maturity = clampMaturity(maxMaturity(row.maturity, proposal.maturity), summary);

  const updates: Record<string, unknown> = {
    maturity,
    confidence: Math.max(row.confidence, proposal.confidence),
    last_updated_at: input.occurredAt,
  };

  // The person's own wording outranks the model's, permanently (§28).
  if (!row.user_edited) {
    if (proposal.summary) updates.summary = proposal.summary;
    if (proposal.fromState && !row.from_state) updates.from_state = proposal.fromState;
    if (proposal.currentState) updates.current_state = proposal.currentState;
  }

  const { data: updated, error: updateError } = await db
    .from('progressions')
    .update(updates)
    .eq('id', row.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  const finalRow = updated as ProgressionRow;
  const emerged = !beforeQualified && qualifiesAsProgression(summary);

  if (proposal.gain && qualifiesAsProgression(summary)) {
    // A gain that cannot be written is not worth losing the progression over:
    // (user_id, type, label) is unique, so two progressions of the same type
    // arriving at the same wording will collide, and the movement is the part
    // that matters.
    try {
      await upsertGain(db, {
        progressionId: finalRow.id,
        label: proposal.gain.label,
        description: proposal.gain.description,
        confidence: proposal.confidence,
        occurredAt: input.occurredAt,
      });
    } catch {
      // Left for the next save to attempt again.
    }
  }

  return { row: finalRow, created, emerged };
}

/**
 * What a progression left behind (§22).
 *
 * Written only once the progression itself stands up, so a gain can never be
 * the thing that appears first — it is an output of movement, not a label the
 * model attaches to a single record.
 */
async function upsertGain(
  db: SupabaseClient,
  input: {
    progressionId: string;
    label: string;
    description?: string | undefined;
    confidence: number;
    occurredAt: string;
  }
): Promise<void> {
  const label = normalizeTitle(input.label);
  if (label.length === 0) return;

  const { data: existing } = await db
    .from('gains')
    .select('id')
    .eq('progression_id', input.progressionId)
    .eq('label', label)
    .maybeSingle();

  if (existing) {
    await db
      .from('gains')
      .update({ last_detected_at: input.occurredAt })
      .eq('id', (existing as { id: string }).id);
    return;
  }

  // gains.type predates the progression model and is still NOT NULL; the
  // progression's own type is the honest value for it now.
  const { data: progression } = await db
    .from('progressions')
    .select('user_id, type')
    .eq('id', input.progressionId)
    .single();
  if (!progression) return;
  const owner = progression as { user_id: string; type: ProgressionType };

  await db.from('gains').insert({
    user_id: owner.user_id,
    progression_id: input.progressionId,
    // The v2 enum has no 'interest'/'relationship'/'perspective'; those fall
    // back to the widest v2 bucket, which nothing reads any more.
    type: mapToLegacyGainType(owner.type),
    label,
    description: input.description ?? null,
    confidence: input.confidence,
    first_detected_at: input.occurredAt,
    last_detected_at: input.occurredAt,
  });
}

/** Bridges progression_type onto the surviving v2 gain_type column. */
function mapToLegacyGainType(type: ProgressionType): string {
  switch (type) {
    case 'capability':
      return 'capability';
    case 'strategy':
      return 'strategy';
    case 'direction':
    case 'interest':
      return 'direction';
    case 'relationship':
      return 'connection';
    case 'perspective':
    default:
      return 'insight';
  }
}

/** Folds one progression into another; both rows survive (§30). */
export async function mergeProgressions(
  db: SupabaseClient,
  input: { sourceId: string; targetId: string; title?: string }
): Promise<void> {
  // Evidence moves so the survivor's path is complete; the source row stays
  // behind as a redirect, which keeps the merge reversible.
  const path = await loadEvidencePath(db, input.sourceId);
  if (path.length > 0) {
    await db.from('progression_evidence').upsert(
      path.map((e) => ({
        progression_id: input.targetId,
        log_id: e.log_id,
        role: e.role,
        occurred_at: e.occurred_at,
      })),
      { onConflict: 'progression_id,log_id' }
    );
  }

  await db.from('gains').update({ progression_id: input.targetId }).eq('progression_id', input.sourceId);
  await db.from('progressions').update({ merged_into_id: input.targetId }).eq('id', input.sourceId);

  if (input.title) {
    await db.from('progressions').update({ title: input.title }).eq('id', input.targetId);
  }

  // The absorbed evidence can lift the survivor a rung; recompute rather than
  // leaving it where it was.
  const merged = await loadEvidencePath(db, input.targetId);
  const summary = summariseEvidencePath(
    merged.map((e) => ({ logId: e.log_id, role: e.role, occurredAt: e.occurred_at }))
  );
  const { data: target } = await db
    .from('progressions')
    .select('maturity')
    .eq('id', input.targetId)
    .single();
  if (target) {
    await db
      .from('progressions')
      .update({
        maturity: clampMaturity((target as { maturity: ProgressionMaturity }).maturity, summary),
      })
      .eq('id', input.targetId);
  }
}
