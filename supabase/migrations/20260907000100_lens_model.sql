-- crincran — Lens model.
--
-- v3 connected the dots. Two things were missing.
--
-- The first is a lens. What counts as progress was the same for everybody. The
-- same "showed it to someone" means different things depending on what a
-- person is trying to grow, so a year's direction now decides what the reading
-- looks for. It decides nothing about whether they succeeded.
--
-- The second is the weight of writing. v3 required a sentence every time.
-- Someone with no room to take stock of their life does not have room for that
-- either, so the body becomes optional and two taps are enough to leave
-- evidence behind.
--
-- Part 2 of 2. The enum values this file relies on are added by
-- 20260907000000_lens_enums.sql, which must be applied first: Postgres will
-- not let a value be used in the transaction that created it.
--
-- Nothing is deleted here. The subjective signal and the v3 clarifications
-- keep their rows and stop being read. Re-runnable: every statement is
-- guarded.

-- 1. Level 2 — what kind of moment it was (§10) ------------------------------

-- Seven, and more than one may be true at once: "first time" and "enjoyed" and
-- "friction" can all describe the same afternoon. None of them is a verdict —
-- 'friction' in particular is not a failure and is never read as one (§10).
do $$ begin create type public.moment_tag as enum
  ('enjoyed', 'tried', 'first_time', 'friction', 'changed', 'discovered', 'self_decided');
exception when duplicate_object then null; end $$;

-- 2. logs: two taps are enough (§14) -----------------------------------------

alter table public.logs add column if not exists moment_tags public.moment_tag[]
  not null default '{}';

-- Level 3. The question is stored beside the answer because the answer is only
-- readable next to what was asked, and because the question the model chose is
-- itself evidence of what it was missing at the time.
alter table public.logs add column if not exists ai_question text;
alter table public.logs add column if not exists optional_answer text;

-- The body was required in v3 and is optional now. Both the NOT NULL and the
-- non-empty check have to go; the constraint name is looked up rather than
-- assumed, since it was created inline.
alter table public.logs alter column body drop not null;

do $$
declare c text;
begin
  select con.conname into c
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'logs'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%body%';
  if c is not null then
    execute format('alter table public.logs drop constraint %I', c);
  end if;
end $$;

-- The v3 signal stops being read: the moment tags say the same thing with more
-- detail, and keeping both would make the input five steps instead of three.
alter table public.logs alter column subjective_signal drop not null;

-- Records written under v3 carry their drawer forward. 'event' was "something
-- that happened", which is what self_action means now.
update public.logs set type = 'self_action' where type = 'event';

-- A v3 record has no tags. Its signal is the closest thing to one, and this is
-- the only place the two vocabularies are bridged.
update public.logs
   set moment_tags = case
                       when subjective_signal = 'positive' then array['enjoyed']::public.moment_tag[]
                       when subjective_signal = 'negative' then array['friction']::public.moment_tag[]
                       else '{}'::public.moment_tag[]
                     end
 where moment_tags = '{}'::public.moment_tag[]
   and subjective_signal is not null;

create index if not exists logs_moment_tags_idx on public.logs using gin(moment_tags);

-- 2b. log_ai_analysis: what STAGE 1 reads out of one record (§16) ------------

-- Two v3 columns already mean what v4 needs and keep their names, so the rows
-- written before this release stay readable: `topics` is themes and `actors`
-- is people. The rest get their own columns rather than being squeezed into
-- near-matches — `environment` is already a text[] in v3, so the single note
-- v4 wants cannot reuse it.
alter table public.log_ai_analysis add column if not exists friction text;
alter table public.log_ai_analysis add column if not exists discovery text;
alter table public.log_ai_analysis add column if not exists adaptation text;
alter table public.log_ai_analysis add column if not exists choice text;
alter table public.log_ai_analysis add column if not exists interest_signal text;
alter table public.log_ai_analysis add column if not exists environment_note text;

-- 3. The lens (§2-§5) --------------------------------------------------------

do $$ begin create type public.theme_source as enum
  ('continue', 'deepen', 'follow_spark', 'custom', 'none');
exception when duplicate_object then null; end $$;

-- One row per person per year.
--
-- What is deliberately absent: any column that could hold a score, a
-- completion rate, or a distance from the target. §1 is explicit that the gap
-- is a lens and not a mark, and a column for "how close are they" would be on
-- a screen within a month of existing.
create table if not exists public.year_directions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  -- Ids from src/constants/areas.ts. Stored as text so the catalogue can grow
  -- without a migration (§3).
  selected_areas text[] not null default '{}',
  desired_self_cards text[] not null default '{}',
  -- What the model decided to watch for, in the person's own vocabulary.
  -- Read by STAGE 2 as detection priority, never written back to as a result.
  progression_lenses text[] not null default '{}',
  initial_theme text,
  final_theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, year)
);

create table if not exists public.month_themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  initial_theme text,
  final_theme text,
  source public.theme_source not null default 'none',
  -- The three the model offered, kept so the month screen can show what was
  -- not chosen without asking for them again.
  candidates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, year, month)
);

-- 4. Progression patterns (§17) ----------------------------------------------

-- The ten shapes a change can take. This is the real vocabulary now: the six
-- progression types from v3 stay for grouping during consolidation, but what
-- makes a progression detectable is its pattern.
do $$ begin create type public.progression_pattern as enum
  ('naming', 'first_act', 'repeat', 'solo', 'pivot', 'expose',
   'own_call', 'transfer', 'reframe', 'boundary');
exception when duplicate_object then null; end $$;

alter table public.progressions add column if not exists pattern public.progression_pattern;

-- §19: a progression that grew outside the year's direction is kept and
-- marked, not discarded. Repeated "enjoyed" is the case this exists for.
alter table public.progressions add column if not exists goal_external boolean
  not null default false;

-- 5. Gain categories (§20) ---------------------------------------------------

-- Seven, and confidence is not among them. §20 is explicit: confidence is what
-- a person feels after seeing these, not a thing the app can hand them.
do $$ begin create type public.gain_category as enum
  ('clarity', 'capability', 'method', 'choice', 'evidence', 'connection', 'recovery');
exception when duplicate_object then null; end $$;

alter table public.gains add column if not exists category public.gain_category;

-- 6. Month and year reviews (§25, §26) ---------------------------------------

alter table public.month_reviews add column if not exists initial_theme text;
alter table public.month_reviews add column if not exists what_actually_happened text;
alter table public.month_reviews add column if not exists gained jsonb
  not null default '[]'::jsonb;
alter table public.month_reviews add column if not exists title_candidates jsonb
  not null default '[]'::jsonb;

create table if not exists public.year_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  -- What they thought it would be about, copied from year_directions at the
  -- time of the reading so a later edit cannot rewrite the comparison.
  initial_theme text not null default '',
  -- What it actually became.
  actual_story text not null default '',
  progressions jsonb not null default '[]'::jsonb,
  gained jsonb not null default '[]'::jsonb,
  title_candidates jsonb not null default '[]'::jsonb,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, year)
);

-- 7. Row level security ------------------------------------------------------

alter table public.year_directions enable row level security;
alter table public.month_themes enable row level security;
alter table public.year_reviews enable row level security;

-- The lens is the one thing in this model the person owns outright: they pick
-- the areas, the cards and the theme, so unlike progressions these are theirs
-- to insert and update directly.
drop policy if exists "year_directions_own_all" on public.year_directions;
create policy "year_directions_own_all" on public.year_directions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "month_themes_own_all" on public.month_themes;
create policy "month_themes_own_all" on public.month_themes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "year_reviews_own_select" on public.year_reviews;
create policy "year_reviews_own_select" on public.year_reviews
  for select using (auth.uid() = user_id);

-- 8. updated_at triggers -----------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['year_directions', 'month_themes', 'year_reviews']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- 9. Reading view -----------------------------------------------------------

drop view if exists public.logs_with_analysis;
create view public.logs_with_analysis
with (security_invoker = true)
as
select
  l.id,
  l.user_id,
  l.occurred_on,
  l.occurred_at,
  l.type,
  l.moment_tags,
  l.ai_question,
  l.optional_answer,
  l.body,
  l.created_at,
  a.event_summary,
  a.journey_role,
  a.topics,
  a.confidence
from public.logs l
left join public.log_ai_analysis a on a.log_id = l.id;

-- 10. Deprecated in this release ---------------------------------------------

comment on column public.logs.subjective_signal is
  'Deprecated 2026-09: v3 ＋/±/−. Replaced by logs.moment_tags.';
comment on column public.logs.body is
  'Deprecated 2026-09 as a required field. v4 writes free text to optional_answer.';
comment on table public.clarifications is
  'Deprecated 2026-09: v3 one-tap question. Replaced by the Level 3 question on logs.';
comment on column public.gains.confidence is
  'Internal ordering only. §20 forbids confidence from being a gain category or a shown value.';
comment on table public.year_directions is
  'A lens, not a target (§1). Nothing here records how close the person is to anything.';
