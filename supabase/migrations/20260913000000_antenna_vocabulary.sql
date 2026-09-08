-- crincran — ANTENNA × CATEGORY × DETAIL.
--
-- The input vocabulary is replaced. A record used to carry a door
-- (自分の行動 / 人との関わり / つぶやき) and any number of moment tags. It now
-- carries one category out of fifteen — five antennas by three — and one
-- detail under it. The category says what kind of day it was; the detail says
-- what about it; the free text says what happened.
--
-- The lens moves with it. It used to be the year's: ten directions and
-- thirty-one desired-self cards, chosen once. It is now the month's: up to two
-- antennas, chosen again every month. A month is the unit of observation, and
-- a lens that cannot be re-aimed stops matching the person before the year is
-- out.
--
-- Ids are stored; labels are not. `values_admired` reads 「いいなと思った」
-- today and read 「憧れた」 before, and no row had to be rewritten. Labels may
-- change freely. An id is never renamed and never reused.
--
-- Nothing is dropped. `type`, `moment_tags` and the year's cards stay where
-- they are: they hold records someone actually wrote, and a reading made under
-- them is still a reading that was shown.
--
-- Re-runnable: every statement is guarded.

-- 1. The name `category_id` is wanted, and a dead v1.5 column is holding it ---
--
-- It pointed at public.categories, the v1.5 free-form category table. Nothing
-- has read it since the gain model landed, and it is the right name for the
-- thing arriving now.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'logs' and column_name = 'category_id'
       and data_type = 'uuid'
  ) then
    alter table public.logs rename column category_id to legacy_category_id;
  end if;
end $$;

comment on column public.logs.legacy_category_id is
  'Deprecated: v1.5 free-form category. Nothing reads it; nothing new writes it.';

-- 2. What a record carries now ---------------------------------------------

alter table public.logs add column if not exists category_id text;
alter table public.logs add column if not exists detail_id text;

-- How the record was left, and who classified it. A free-text entry has no
-- category until something reads it, and saying which of the two put it there
-- is what lets a wrong one be found later.
do $$ begin create type public.log_input_method as enum ('category', 'free_text', 'voice', 'flow');
exception when duplicate_object then null; end $$;
do $$ begin create type public.classification_source as enum ('user', 'ai');
exception when duplicate_object then null; end $$;
do $$ begin create type public.classification_status as enum ('confirmed', 'pending', 'unclassified');
exception when duplicate_object then null; end $$;

alter table public.logs add column if not exists input_method public.log_input_method
  not null default 'category';
alter table public.logs add column if not exists classification_source public.classification_source
  not null default 'user';
alter table public.logs add column if not exists classification_status public.classification_status
  not null default 'confirmed';

-- Secondary categories the classifier also saw. Kept beside the chosen one
-- rather than instead of it: a record can be evidence for a second antenna
-- without the person having filed it there.
alter table public.logs add column if not exists ai_signals jsonb not null default '[]'::jsonb;

-- The fifteen. A check rather than an enum: adding one is an ALTER TABLE that
-- takes effect immediately, where ALTER TYPE ... ADD VALUE cannot be used in
-- the transaction that adds it — which is what made journey_role a trap.
-- A test compares this list with the domain's own, in both directions.
do $$ begin
  alter table public.logs drop constraint if exists logs_category_id_known;
  alter table public.logs add constraint logs_category_id_known check (
    category_id is null or category_id in (
      'progress_did', 'progress_learned', 'progress_tried',
      'self_good', 'self_hard', 'self_fun',
      'spark_inspired', 'spark_recharged', 'spark_curious',
      'sustainable_easy', 'sustainable_absorbed', 'sustainable_relieved',
      'values_important', 'values_wrong', 'values_admired'
    )
  );
end $$;

create index if not exists logs_category_idx on public.logs(user_id, category_id);

-- 3. The lens is the month's now --------------------------------------------

alter table public.month_themes add column if not exists antenna_ids text[]
  not null default '{}'::text[];

do $$ begin
  alter table public.month_themes drop constraint if exists month_themes_antennas_known;
  alter table public.month_themes add constraint month_themes_antennas_known check (
    cardinality(antenna_ids) <= 2
    and antenna_ids <@ array[
      'progress', 'self_understanding', 'spark', 'sustainable', 'values'
    ]::text[]
  );
end $$;

comment on column public.month_themes.antenna_ids is
  'Up to two, chosen at the start of the month. The axes the month-end pass reads along.';

comment on column public.logs.category_id is
  'One of fifteen: five antennas by three. Ids are stored, labels are not.';
comment on column public.logs.detail_id is
  'One option under the category. Its meaning depends on the category it sits in.';
