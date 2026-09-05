-- crincran — Progression model.
--
-- v2 read each entry for what remained. It could show what a person had, but
-- not where it came from. A Progression is the other thing: several events put
-- in order, and the movement that becomes visible between them.
--
-- Progression is not improvement. Forward, backward, stalled, trial and error,
-- a change of interest, a change of direction, a second attempt — all of it
-- counts as movement, and none of it is graded.
--
-- Nothing is deleted here. v2's gains keep their rows; the three input
-- categories keep theirs. Both stop being read. Re-runnable: every statement
-- is guarded.

-- 1. Vocabulary -------------------------------------------------------------

-- What the person taps. Two drawers, not six, and neither is a judgement:
-- an event is what happened, a thought is what passed through.
-- public.log_type ('event','thought') already exists from v1.5 — the gain
-- migration only dropped its NOT NULL. It comes back as it was.

-- The one thing only the person knows: how it landed for them. Kept apart
-- from the body, because the text and the feeling can disagree and both are
-- true (§6).
do $$ begin create type public.subjective_signal as enum
  ('positive', 'mixed', 'negative');
exception when duplicate_object then null; end $$;

do $$ begin create type public.progression_type as enum
  ('capability', 'strategy', 'interest', 'direction', 'relationship', 'perspective');
exception when duplicate_object then null; end $$;

-- Four rungs, and the wording the person reads is bound to the rung (§12).
-- 'attempt' from the gain model is gone: it described one record, not a
-- movement between records.
do $$ begin create type public.progression_maturity as enum
  ('signal', 'emerging', 'evidenced', 'established');
exception when duplicate_object then null; end $$;

-- What one record does inside a progression (§11).
do $$ begin create type public.progression_evidence_role as enum
  ('origin', 'attempt', 'setback', 'adaptation', 'evidence', 'turning_point', 'current');
exception when duplicate_object then null; end $$;

do $$ begin create type public.progression_verdict as enum ('accepted', 'adjusted');
exception when duplicate_object then null; end $$;

-- §7 adds two roles the gain model had no room for: looking around without
-- committing, and carrying on unchanged. Both are movement worth keeping.
--
-- These run outside a DO block on purpose: ALTER TYPE ... ADD VALUE is not
-- allowed inside one. IF NOT EXISTS already makes them re-runnable.
alter type public.journey_role add value if not exists 'exploration';
alter type public.journey_role add value if not exists 'continuation';

-- 2. logs: two drawers and a signal -----------------------------------------

alter table public.logs add column if not exists subjective_signal public.subjective_signal;

-- Restore the drawer from v1.5 where it survives; otherwise read it off the
-- v2 chip. 'progress' and 'friction' were both about things that happened;
-- 'moved' was about what the person noticed. The body is never touched.
update public.logs
   set type = case
                when input_category = 'moved' then 'thought'::public.log_type
                else 'event'::public.log_type
              end
 where type is null;

-- A record with no signal predates the question. 'mixed' is the honest
-- default: it says nothing, which is what we know.
update public.logs set subjective_signal = 'mixed' where subjective_signal is null;

alter table public.logs alter column type set not null;
alter table public.logs alter column subjective_signal set not null;
alter table public.logs alter column subjective_signal set default 'mixed';

-- The v2 chip stops being read but keeps every row.
alter table public.logs alter column input_category drop not null;

-- 3. log_ai_analysis: what STAGE 1 reads out of one entry (§6) ---------------

alter table public.log_ai_analysis add column if not exists topics text[] not null default '{}';
alter table public.log_ai_analysis add column if not exists actors text[] not null default '{}';
alter table public.log_ai_analysis add column if not exists environment text[] not null default '{}';
alter table public.log_ai_analysis add column if not exists action text;
alter table public.log_ai_analysis add column if not exists outcome text;
alter table public.log_ai_analysis add column if not exists reaction text;
alter table public.log_ai_analysis add column if not exists hypothesis text;
alter table public.log_ai_analysis add column if not exists future_intention text;

-- Six buckets of weak evidence, each an array of short phrases lifted from the
-- body. They are what STAGE 2 matches on; none of them is shown to anyone.
alter table public.log_ai_analysis add column if not exists signals jsonb not null default
  '{"capability":[],"strategy":[],"interest":[],"direction":[],"relationship":[],"perspective":[]}'::jsonb;

-- Retrieval key (§29). Kept as a plain array so the migration runs on a
-- project without pgvector; similarity is computed in the Edge Function.
alter table public.log_ai_analysis add column if not exists embedding real[];

create index if not exists log_ai_analysis_topics_idx
  on public.log_ai_analysis using gin(topics);

-- 4. Progressions ------------------------------------------------------------

create table if not exists public.progressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.progression_type not null,
  -- The person's own words, not the type name (§17).
  title text not null check (length(trim(title)) > 0),
  from_state text,
  current_state text,
  summary text not null default '',
  maturity public.progression_maturity not null default 'signal',
  confidence real not null default 0.3 check (confidence >= 0 and confidence <= 1),
  first_detected_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  -- 納得した / 少し違う (§28). Null until the person has looked.
  verdict public.progression_verdict,
  -- True once the person rewrote the title or summary. Their wording then
  -- outranks the model's on every later pass.
  user_edited boolean not null default false,
  -- Set when this progression was folded into a broader one (§30). The row
  -- survives so its evidence is never orphaned and the merge stays reversible.
  merged_into_id uuid references public.progressions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint progressions_not_merged_into_self
    check (merged_into_id is null or merged_into_id <> id)
);

create unique index if not exists progressions_user_type_title_idx
  on public.progressions(user_id, type, title);

create index if not exists progressions_user_recent_idx
  on public.progressions(user_id, last_updated_at desc);

create table if not exists public.progression_evidence (
  id uuid primary key default gen_random_uuid(),
  progression_id uuid not null references public.progressions(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  role public.progression_evidence_role not null default 'evidence',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(progression_id, log_id)
);

-- HOW IT CHANGED reads this in time order, so the index is the query.
create index if not exists progression_evidence_path_idx
  on public.progression_evidence(progression_id, occurred_at);
create index if not exists progression_evidence_log_idx
  on public.progression_evidence(log_id);

-- 5. Gains become the output, not the input (§22) ----------------------------

alter table public.gains add column if not exists progression_id uuid
  references public.progressions(id) on delete cascade;
alter table public.gains add column if not exists description text;

create index if not exists gains_progression_idx on public.gains(progression_id);

-- 6. The month-end reading is about movement now, not about what remains -----

-- §23 replaces 3 GAINS with 3 PROGRESSIONS. Each entry is a title and the one
-- line that says what changed, so the shape is richer than the old string list
-- and gets its own column rather than being squeezed into the existing one.
alter table public.month_reviews add column if not exists progressions jsonb
  not null default '[]'::jsonb;
alter table public.month_reviews add column if not exists carrying_forward text
  not null default '';

comment on column public.month_reviews.gains is
  'Deprecated 2026-09: v2 3 GAINS. Replaced by month_reviews.progressions.';
comment on column public.month_reviews.one_change is
  'Deprecated 2026-09: replaced by month_reviews.carrying_forward.';

-- 7. Conditional clarification (§14) ----------------------------------------

-- One optional tap, only when the answer would change which progression a
-- record belongs to and the model cannot infer it. Skipping is a valid answer
-- and is recorded as one, so the same question is never asked twice.
create table if not exists public.clarifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  answer text,
  answered_at timestamptz,
  asked_at timestamptz not null default now(),
  unique(log_id)
);

create index if not exists clarifications_pending_idx
  on public.clarifications(user_id, answered_at);

-- 8. Row level security ------------------------------------------------------

alter table public.progressions enable row level security;
alter table public.progression_evidence enable row level security;
alter table public.clarifications enable row level security;

drop policy if exists "progressions_own_select" on public.progressions;
create policy "progressions_own_select" on public.progressions
  for select using (auth.uid() = user_id);

drop policy if exists "progressions_own_update" on public.progressions;
create policy "progressions_own_update" on public.progressions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progression_evidence_own_select" on public.progression_evidence;
create policy "progression_evidence_own_select" on public.progression_evidence
  for select using (
    exists (
      select 1 from public.progressions p
       where p.id = progression_evidence.progression_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "clarifications_own_select" on public.clarifications;
create policy "clarifications_own_select" on public.clarifications
  for select using (auth.uid() = user_id);

drop policy if exists "clarifications_own_update" on public.clarifications;
create policy "clarifications_own_update" on public.clarifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 9. updated_at triggers -----------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['progressions']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- 10. Reading view ------------------------------------------------------------

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
  l.subjective_signal,
  l.body,
  l.created_at,
  a.event_summary,
  a.journey_role,
  a.topics,
  a.confidence
from public.logs l
left join public.log_ai_analysis a on a.log_id = l.id;

-- 11. Deprecated in this release --------------------------------------------
-- logs.input_category and logs.category_id are history columns. public.gains
-- rows written before this release carry progression_id = null and are no
-- longer read; the app builds gains under a progression from now on.
comment on column public.logs.input_category is
  'Deprecated 2026-09: v2 chips. Replaced by logs.type + logs.subjective_signal.';
comment on table public.gains is
  'A gain is what a progression left behind (§22). Rows with progression_id null are v2 leftovers.';
