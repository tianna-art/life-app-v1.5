/*
 * 先月からの変化 / 去年との違い — the comparison between two periods.
 *
 * This is the most dangerous reading in the product, and the table is shaped
 * to make the dangerous version hard to store rather than merely discouraged.
 *
 * A comparison needs material on both sides. The failure it invites is not an
 * invented sentence but a true-sounding one: put a month with one record
 * beside a month with five and 「増えた」 writes itself, when the only thing
 * that changed is how much somebody felt like writing. So both evidence
 * columns are required to be non-empty — a comparison that cannot name records
 * from both periods is not a comparison — and the rest of that rule (how thin
 * a side may be, what words may not be used) lives in src/ai/reading.ts, where
 * it can be tested against real proposals.
 *
 * Like 見立て and 仮説, this is select-only for clients. A comparison carries
 * evidence, and anything a client can write it can write with nothing behind.
 */

create table if not exists public.period_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('month', 'year')),
  -- The period being named, and the one it is held up against.
  period_key text not null,
  compare_key text not null,
  -- progression 一段進んだ / clarification 同じ問いがはっきりした /
  -- continuity 変わっていないものがある。None of them is a verdict.
  kind text not null check (kind in ('progression', 'clarification', 'continuity')),
  title text not null,
  summary text not null,
  previous_log_ids uuid[] not null default '{}',
  current_log_ids uuid[] not null default '{}',
  -- What the comparison cannot see. Shown, not hidden in a tooltip.
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, period_type, period_key, compare_key),
  constraint period_changes_key_matches_type check (
    (period_type = 'month' and period_key ~ '^\d{4}-\d{2}$' and compare_key ~ '^\d{4}-\d{2}$')
    or (period_type = 'year' and period_key ~ '^\d{4}$' and compare_key ~ '^\d{4}$')
  ),
  -- Both sides, always. A "change" quoting one period is a description.
  constraint period_changes_needs_both_sides check (
    cardinality(previous_log_ids) >= 1 and cardinality(current_log_ids) >= 1
  ),
  constraint period_changes_compares_two_periods check (period_key <> compare_key)
);

alter table public.period_changes enable row level security;

drop policy if exists period_changes_read on public.period_changes;
create policy period_changes_read on public.period_changes
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.period_changes from authenticated;
grant select on public.period_changes to authenticated;

create index if not exists period_changes_user_period_idx
  on public.period_changes (user_id, period_type, period_key);
