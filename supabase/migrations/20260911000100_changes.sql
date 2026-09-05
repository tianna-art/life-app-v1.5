-- crincran — the Change model, part 2 of 2.
--
-- One object, not two. The map and the summary under it used to be written by
-- two separate model calls about the same month, which meant nothing made them
-- agree: the map drew a point the summary never mentioned, and the summary
-- named a change with no point above it. A row in this table IS the point, IS
-- the card, and carries the records the card prints.
--
-- Progressions stay where they are. They are the detection layer — built one
-- record at a time, spanning months, holding the ten patterns and the merge
-- history. A change is the month's published reading of them: which ones bear
-- on what the person said they wanted, why, and on the strength of which
-- records. Different lifetimes, so different tables.
--
-- Re-runnable: every statement is guarded.

create table if not exists public.changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  period_type public.period_type not null default 'month',
  year integer not null,
  month integer check (month is null or (month >= 1 and month <= 12)),

  -- What changed, in the person's own words. Never a topic: "自分の基準で選ぶ",
  -- not "仕事". The map prints this and the card's heading prints the same
  -- string, so there is one title and not two that have to be kept in step.
  title text not null check (length(trim(title)) > 0),

  -- Which of the things they put down at the start this answers to. Required:
  -- a change nobody can trace back to something they wanted is not published.
  linked_target_type public.change_target_type not null,
  linked_target_id text,
  linked_target_label text not null default '',

  -- Only ever written when a record from before says so. There is no default
  -- and no inference: "以前は決められなかった" invented from a desired-self
  -- card would be the app telling someone a story about their past.
  before_state text,
  current_state text not null default '',

  -- The two halves of the card, in the order §27 fixes them: what the records
  -- show, then what that has to do with what they wanted.
  observation text not null default '',
  target_connection text not null default '',

  confidence public.change_confidence not null default 'signal',

  -- The order the map and the card list share.
  position integer not null default 0,

  -- Where it came from. Kept so a reading is never orphaned from the
  -- detection that produced it, and so a later pass can see what an earlier
  -- one built this on.
  progression_id uuid references public.progressions(id) on delete set null,

  -- 納得した / 少し違う. Null until the person has looked.
  verdict public.progression_verdict,
  user_edited boolean not null default false,

  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One reading of a title per period. Re-generating a month replaces its rows
-- rather than stacking a second opinion beside the first.
create unique index if not exists changes_period_title_idx
  on public.changes(user_id, period_type, year, coalesce(month, 0), title);

create index if not exists changes_user_period_idx
  on public.changes(user_id, year desc, month desc);

-- The records the card prints, in the order it prints them.
--
-- Two or more, always — enforced where the rows are written, because one
-- record is an observation and calling it a change would be the app inventing
-- a trajectory out of a single afternoon.
create table if not exists public.change_evidence (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references public.changes(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  role public.change_evidence_role not null default 'evidence',
  occurred_at timestamptz not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(change_id, log_id)
);

create index if not exists change_evidence_order_idx
  on public.change_evidence(change_id, position);
create index if not exists change_evidence_log_idx
  on public.change_evidence(log_id);

-- A gain belongs to the change it came out of (§33: never straight from a
-- log). The progression link stays for what was written before this existed.
alter table public.gains add column if not exists change_id uuid
  references public.changes(id) on delete cascade;
create index if not exists gains_change_idx on public.gains(change_id);

-- Row level security: the person reads their own; everything is written by
-- the Edge Functions under the service role, the same as progressions.
alter table public.changes enable row level security;
alter table public.change_evidence enable row level security;

drop policy if exists "changes_own_select" on public.changes;
create policy "changes_own_select" on public.changes
  for select using (auth.uid() = user_id);

-- 納得した / 少し違う is the person's own writing, so it is the one thing they
-- may change themselves.
drop policy if exists "changes_own_update" on public.changes;
create policy "changes_own_update" on public.changes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "change_evidence_own_select" on public.change_evidence;
create policy "change_evidence_own_select" on public.change_evidence
  for select using (
    exists (
      select 1 from public.changes c
      where c.id = change_evidence.change_id and c.user_id = auth.uid()
    )
  );

drop trigger if exists touch_changes on public.changes;
create trigger touch_changes before update on public.changes
  for each row execute function public.touch_updated_at();

-- The brief stays: it is the working-out behind a month, kept so a later
-- reading can see what an earlier one thought. What is deprecated is the two
-- columns that made the map a second opinion about the month.
comment on column public.month_maps.points is
  'Deprecated 2026-09: the map is drawn from public.changes. Kept for history.';
comment on column public.month_maps.lead_reason is
  'Deprecated 2026-09: replaced by changes.target_connection on the leading change.';

comment on table public.changes is
  'One published change: the map point, the summary card and its evidence are the same row.';
comment on column public.changes.before_state is
  'Only ever written when a record from before says so. Never inferred from a desired-self card.';
