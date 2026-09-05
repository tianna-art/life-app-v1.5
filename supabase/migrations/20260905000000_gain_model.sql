-- crincran — Gain model.
--
-- The product stopped asking the person to classify anything. A record now
-- carries one of three drawers and a body; everything interpretive lives in
-- rows the Edge Function writes beside it: what kind of moment it was, what it
-- connects to, and what stayed.
--
-- Nothing is deleted here. The v1.5 tables (categories, category_insights,
-- keyword_reviews, monthly_intentions, period_titles) keep their rows and stop
-- being read by the app; logs keep their category_id as history. Re-runnable:
-- every statement is guarded.

-- 1. Vocabulary -------------------------------------------------------------

do $$ begin create type public.input_category as enum ('progress', 'friction', 'moved');
exception when duplicate_object then null; end $$;

do $$ begin create type public.gain_type as enum
  ('capability', 'insight', 'strategy', 'direction', 'connection', 'evidence');
exception when duplicate_object then null; end $$;

do $$ begin create type public.gain_maturity as enum
  ('signal', 'attempt', 'emerging', 'evidenced', 'established');
exception when duplicate_object then null; end $$;

do $$ begin create type public.gain_status as enum ('confirmed', 'possible', 'unresolved');
exception when duplicate_object then null; end $$;

do $$ begin create type public.journey_role as enum
  ('attempt', 'setback', 'breakthrough', 'adaptation', 'learning', 'turning_point', 'neutral');
exception when duplicate_object then null; end $$;

do $$ begin create type public.journey_relation as enum
  ('same_theme', 'progression', 'contrast', 'adaptation', 'consequence');
exception when duplicate_object then null; end $$;

do $$ begin create type public.evidence_relation as enum
  ('supports', 'created', 'strengthened', 'contradicts');
exception when duplicate_object then null; end $$;

do $$ begin create type public.gain_verdict as enum ('accepted', 'adjusted');
exception when duplicate_object then null; end $$;

-- 2. logs: three drawers instead of a per-user taxonomy ----------------------

alter table public.logs add column if not exists input_category public.input_category;
alter table public.logs add column if not exists occurred_at timestamptz;

-- Legacy rows carry their drawer through the frozen slug, never the display
-- name: a category the person renamed still maps correctly. The body is never
-- touched. Mirrors src/constants/inputCategories.ts.
update public.logs l
set input_category = case c.slug
    when 'tsumiage'  then 'progress'::public.input_category
    when 'kyokun'    then 'progress'::public.input_category
    when 'hikkakari' then 'friction'::public.input_category
    when 'tokimeki'  then 'moved'::public.input_category
    when 'kankeisei' then 'moved'::public.input_category
    when 'sonota'    then 'moved'::public.input_category
    else 'moved'::public.input_category
  end
from public.categories c
where c.id = l.category_id
  and l.input_category is null;

-- Rows whose category vanished, or that never had one, still get a drawer.
update public.logs set input_category = 'moved' where input_category is null;

-- occurred_at keeps the time of day for anything written from now on; legacy
-- rows only ever knew the date, so they inherit their creation timestamp when
-- it falls on that date and midnight otherwise.
update public.logs
set occurred_at = case
    when created_at::date = occurred_on then created_at
    else occurred_on::timestamptz
  end
where occurred_at is null;

alter table public.logs alter column input_category set not null;
alter table public.logs alter column occurred_at set not null;
alter table public.logs alter column occurred_at set default now();

-- The old required fields become history: present on old rows, absent on new.
alter table public.logs alter column category_id drop not null;
alter table public.logs alter column type drop not null;

-- 3. log_ai_analysis: the single-entry read (§10) ----------------------------

alter table public.log_ai_analysis add column if not exists event_summary text;
alter table public.log_ai_analysis add column if not exists journey_role public.journey_role;
alter table public.log_ai_analysis add column if not exists gain_status public.gain_status;

-- 4. Gains -------------------------------------------------------------------

create table if not exists public.gains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.gain_type not null,
  label text not null check (length(trim(label)) > 0),
  maturity public.gain_maturity not null default 'signal',
  confidence real not null default 0.3 check (confidence >= 0 and confidence <= 1),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  -- The person's verdict (§27). Null until they say something.
  verdict public.gain_verdict,
  -- Set when this gain was folded into a broader one (§26). The row survives
  -- so its evidence is never orphaned and the merge stays reversible.
  merged_into_id uuid references public.gains(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gains_not_merged_into_self check (merged_into_id is null or merged_into_id <> id)
);

-- One label per type per person. Consolidation depends on this being unique.
create unique index if not exists gains_user_type_label_idx
  on public.gains(user_id, type, label);

create index if not exists gains_user_recent_idx
  on public.gains(user_id, last_detected_at desc);

create table if not exists public.gain_evidence (
  gain_id uuid not null references public.gains(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  relation public.evidence_relation not null default 'supports',
  note text,
  created_at timestamptz not null default now(),
  primary key (gain_id, log_id)
);

create index if not exists gain_evidence_log_idx on public.gain_evidence(log_id);

-- 5. Trial & error kept as its own layer (§4) --------------------------------

create table if not exists public.journey_links (
  from_log_id uuid not null references public.logs(id) on delete cascade,
  to_log_id uuid not null references public.logs(id) on delete cascade,
  relation public.journey_relation not null,
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  primary key (from_log_id, to_log_id),
  constraint journey_links_no_self check (from_log_id <> to_log_id)
);

create index if not exists journey_links_to_idx on public.journey_links(to_log_id);

-- 6. Month-end reading (§19) -------------------------------------------------

create table if not exists public.month_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null, -- YYYY-MM
  title text not null,
  subtitle text not null default '',
  -- At most three labels, stored in the order they should be read.
  gains jsonb not null default '[]'::jsonb,
  one_change text not null default '',
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_key)
);

create index if not exists month_reviews_lookup_idx
  on public.month_reviews(user_id, period_key);

-- 7. Row level security ------------------------------------------------------

alter table public.gains enable row level security;
alter table public.gain_evidence enable row level security;
alter table public.journey_links enable row level security;
alter table public.month_reviews enable row level security;

-- Gains are written by the Edge Function (service role, bypasses RLS). The
-- person may read them, and may correct one they said 少し違う about — that is
-- the whole of the feedback surface, so update is the only write they get.
drop policy if exists "gains_own_select" on public.gains;
create policy "gains_own_select" on public.gains
  for select using (auth.uid() = user_id);

drop policy if exists "gains_own_update" on public.gains;
create policy "gains_own_update" on public.gains
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gain_evidence_own_select" on public.gain_evidence;
create policy "gain_evidence_own_select" on public.gain_evidence
  for select using (
    exists (select 1 from public.gains g where g.id = gain_evidence.gain_id and g.user_id = auth.uid())
  );

drop policy if exists "journey_links_own_select" on public.journey_links;
create policy "journey_links_own_select" on public.journey_links
  for select using (
    exists (select 1 from public.logs l where l.id = journey_links.from_log_id and l.user_id = auth.uid())
  );

drop policy if exists "month_reviews_own_select" on public.month_reviews;
create policy "month_reviews_own_select" on public.month_reviews
  for select using (auth.uid() = user_id);

-- 8. updated_at triggers for the new tables ----------------------------------

do $$
declare t text;
begin
  foreach t in array array['gains', 'month_reviews']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- 9. Reading view ------------------------------------------------------------

drop view if exists public.logs_with_analysis;
create view public.logs_with_analysis
with (security_invoker = true)
as
select
  l.id,
  l.user_id,
  l.occurred_on,
  l.occurred_at,
  l.input_category,
  l.body,
  l.created_at,
  a.event_summary,
  a.journey_role,
  a.gain_status,
  a.semantic_tags
from public.logs l
left join public.log_ai_analysis a on a.log_id = l.id;

-- 10. Deprecated in this release --------------------------------------------
-- public.categories, public.category_insights, public.keyword_reviews,
-- public.monthly_intentions and public.period_titles keep every row and are no
-- longer read by the app. logs.category_id and logs.type are history columns.
comment on table public.categories is 'Deprecated 2026-09: v1.5 per-user drawers. Kept for history.';
comment on table public.category_insights is 'Deprecated 2026-09: replaced by public.gains.';
comment on table public.keyword_reviews is 'Deprecated 2026-09: replaced by gains.verdict.';
comment on table public.monthly_intentions is 'Deprecated 2026-09: the app no longer asks the person to declare a month.';
comment on table public.period_titles is 'Deprecated 2026-09: replaced by public.month_reviews.';
