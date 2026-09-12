-- crincran — 方向と足跡のモデル。
--
-- The progression / gain / change / lens model is retired here and the tables
-- that carried it move to an archive schema rather than being dropped: there
-- is production data in them, and a migration that destroys data on the way
-- past is not a migration anyone can run twice.
--
-- Re-runnable. Every step is guarded.

create schema if not exists archive_v2;

-- ---------------------------------------------------------------------------
-- Retire the old model
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  live_rows bigint;
begin
  foreach t in array array[
    'progressions', 'progression_evidence', 'gains', 'gain_evidence',
    'journey_links', 'changes', 'change_evidence', 'clarifications',
    'month_maps', 'category_insights', 'keyword_reviews', 'month_reviews',
    'lenses', 'lens_answers', 'month_themes', 'year_reviews',
    'monthly_intentions', 'log_ai_analysis'
  ]
  loop
    continue when not exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = t);

    -- Already archived once. A table of the same name back in public means an
    -- earlier migration recreated an empty shell; that can go. One with rows
    -- in it is real data, and silently dropping or merging it would be worse
    -- than stopping here and letting a person look at it.
    if exists (select 1 from information_schema.tables
                where table_schema = 'archive_v2' and table_name = t) then
      execute format('select count(*) from public.%I', t) into live_rows;
      if live_rows = 0 then
        execute format('drop table public.%I cascade', t);
      else
        raise exception
          'public.% has % row(s) and archive_v2.% already exists. Archive or merge it by hand before re-running.',
          t, live_rows, t;
      end if;
      continue;
    end if;

    execute format('alter table public.%I set schema archive_v2', t);
    execute format('revoke all on archive_v2.%I from anon, authenticated', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- ビジョンボード — no period, sits above everything
-- ---------------------------------------------------------------------------
create table if not exists public.vision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vision_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 方向
-- ---------------------------------------------------------------------------
create table if not exists public.year_directions (
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  direction text not null,
  keywords text[] not null default '{}',
  answers text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, year)
);

-- A replaced direction is kept. Changing your mind is part of the record.
create table if not exists public.year_direction_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  direction text not null,
  replaced_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'antenna_id') then
    create type antenna_id as enum
      ('progress', 'self_understanding', 'spark', 'sustainable', 'values');
  end if;
end
$$;

create table if not exists public.month_directions (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null check (period_key ~ '^\d{4}-\d{2}$'),
  antenna_ids antenna_id[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key),
  -- Two at a time. The database says so because the reading downstream
  -- assumes it: a month's cards are grouped by the アンテナ they answer to.
  constraint month_directions_at_most_two check (cardinality(antenna_ids) <= 2)
);

-- ---------------------------------------------------------------------------
-- 記録
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'log_input_method') then
    create type log_input_method as enum ('typed', 'voice');
  end if;
  if not exists (select 1 from pg_type where typname = 'log_source') then
    create type log_source as enum ('manual', 'future_memo', 'flow');
  end if;
end
$$;

-- logs survives the rewrite. It keeps its body, its date and its owner, and
-- loses the columns that belonged to the retired model.
--
-- The whole table is copied first. Dropping a column is not reversible, and
-- the records in here are the only thing in the product that cannot be
-- regenerated, so the copy is made before anything is altered.
do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'archive_v2' and table_name = 'logs_before_direction_model') then
    execute 'create table archive_v2.logs_before_direction_model as table public.logs';
    execute 'revoke all on archive_v2.logs_before_direction_model from anon, authenticated';
  end if;
end
$$;

alter table public.logs add column if not exists period_key text;
alter table public.logs add column if not exists detail_id text;
alter table public.logs add column if not exists input_method log_input_method not null default 'typed';
alter table public.logs add column if not exists source log_source not null default 'manual';
alter table public.logs add column if not exists source_id uuid;

-- Backfill before the constraint, so existing rows are not rejected by it.
update public.logs
   set period_key = to_char(coalesce(occurred_on, created_at::date), 'YYYY-MM')
 where period_key is null;

alter table public.logs alter column period_key set not null;

-- A record may have no day: one entered for a past month knows the month and
-- nothing more, and inventing a day would put it on one that did not happen.
alter table public.logs alter column occurred_on drop not null;
alter table public.logs alter column occurred_on drop default;

/*
 * category_id changes meaning here.
 *
 * It used to be a uuid pointing at a per-user row in `categories`. The アンテナ
 * tree is now fixed content that ships with the app — the same five アンテナ
 * and the same categories for everyone — so the column holds that tree's own
 * id ('progress_did'), and the foreign key goes with the table it pointed at.
 * Rows are copied as text so nothing already written is lost.
 */
alter table public.logs drop constraint if exists logs_category_id_fkey;

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'logs' and column_name = 'category_id') = 'uuid' then
    alter table public.logs alter column category_id type text using category_id::text;
  end if;
end
$$;

-- A view over the old shape stands in the way of the columns it selects. It
-- described the retired model — a record joined to its analysis — and nothing
-- reads it now, so it goes before them.
drop view if exists public.logs_with_analysis;

-- The retired model's columns. Their contents are in the copy above.
alter table public.logs drop column if exists type;
alter table public.logs drop column if exists input_category;
alter table public.logs drop column if exists occurred_at;
alter table public.logs drop column if exists subjective_signal;
alter table public.logs drop column if exists moment_tags;
alter table public.logs drop column if exists ai_question;
alter table public.logs drop column if exists optional_answer;

-- `categories` held a per-user copy of a tree that is now code. It is archived
-- rather than dropped: the names in it were edited by hand.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'categories')
     and not exists (select 1 from information_schema.tables
              where table_schema = 'archive_v2' and table_name = 'categories') then
    execute 'alter table public.categories set schema archive_v2';
    execute 'revoke all on archive_v2.categories from anon, authenticated';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 未来メモ
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'future_type') then
    create type future_type as enum ('interest', 'place', 'movie', 'book', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'future_date_kind') then
    create type future_date_kind as enum ('none', 'by', 'after');
  end if;
  if not exists (select 1 from pg_type where typname = 'future_status') then
    create type future_status as enum ('future', 'completed', 'trashed');
  end if;
end
$$;

create table if not exists public.future_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type future_type not null default 'interest',
  title text not null,
  memo text not null default '',
  target_date date,
  date_kind future_date_kind not null default 'none',
  favorite boolean not null default false,
  status future_status not null default 'future',
  completed_at timestamptz,
  heart_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'いつでも' carries no date, and a date without a kind cannot be read.
  constraint future_memos_date_matches_kind
    check ((date_kind = 'none' and target_date is null)
        or (date_kind <> 'none' and target_date is not null))
);

-- ---------------------------------------------------------------------------
-- 感情クエスト
-- ---------------------------------------------------------------------------
create table if not exists public.flow_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entries jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 読み取り — summary, cards, hypothesis
-- ---------------------------------------------------------------------------
/*
 * 要約 — for a month or a year, and rewritable by the person it is about.
 *
 * Two bodies, not one. `body` is what the reading produced; `body_user` is
 * what the person wrote. Keeping them apart is what lets a summary be
 * regenerated without silently discarding someone's own words, and what makes
 * it possible to tell later which of the two you are reading. The screen shows
 * `body_user` when it exists.
 */
create table if not exists public.period_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null default 'month' check (period_type in ('month', 'year')),
  period_key text not null,
  keywords text[] not null default '{}',
  body text not null default '',
  body_user text,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_type, period_key),
  constraint period_summaries_three_words check (cardinality(keywords) <= 3),
  constraint period_summaries_key_matches_type check (
    (period_type = 'month' and period_key ~ '^\d{4}-\d{2}$')
    or (period_type = 'year' and period_key ~ '^\d{4}$')
  )
);

create table if not exists public.month_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null check (period_key ~ '^\d{4}-\d{2}$'),
  antenna_id antenna_id not null,
  label text not null,
  text text not null,
  why text not null default '',
  note text not null default '',
  evidence_log_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  -- A card with nothing behind it is not a reading. The rule lives here so no
  -- client, and no future function, can write one.
  constraint month_insights_needs_evidence check (cardinality(evidence_log_ids) >= 1)
);

create table if not exists public.month_hypotheses (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null check (period_key ~ '^\d{4}-\d{2}$'),
  text text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

-- ---------------------------------------------------------------------------
-- 足跡タイトル — periods before the app included
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'period_titles'
       and column_name = 'is_confirmed'
  ) then
    alter table public.period_titles drop column is_confirmed;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Two kinds of table. The ones the person writes get the usual rule. The
-- reading — summary, cards, hypothesis — is owned by the Edge Functions: a
-- signed-in client may read its own and nothing more. A client that can write
-- its own 見立て can write one with invented records behind it, and the check
-- constraint above cannot tell a real log id from a made-up one.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'vision_items', 'vision_words', 'year_directions', 'year_direction_history',
    'month_directions', 'future_memos', 'flow_sessions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own', t);
  end loop;

  -- 見立て and 仮説 are readings: they carry evidence, and a client that can
  -- write one can write one with invented records behind it. Select only.
  foreach t in array array['month_insights', 'month_hypotheses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
      t || '_read', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end
$$;

/*
 * 要約 is different, and an earlier version of this migration got it wrong by
 * treating it the same.
 *
 * A summary is a description of someone's own month, and they have to be able
 * to rewrite it. What they must not be able to do is put words in the
 * reading's mouth — so the write is narrowed by column rather than refused:
 * body_user is theirs, keywords and body belong to the function.
 */
alter table public.period_summaries enable row level security;

drop policy if exists period_summaries_read on public.period_summaries;
create policy period_summaries_read on public.period_summaries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists period_summaries_write_own_words on public.period_summaries;
create policy period_summaries_write_own_words on public.period_summaries
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists period_summaries_start_own_words on public.period_summaries;
create policy period_summaries_start_own_words on public.period_summaries
  for insert to authenticated with check (user_id = auth.uid());

revoke insert, update, delete on public.period_summaries from authenticated;
-- An UPDATE needs to read the columns it filters by and the ones the policy
-- checks, so the select grant is not optional here: without it the person
-- cannot edit their own summary at all. (Supabase grants this by default; it
-- is stated anyway so the migration stands on its own.)
grant select on public.period_summaries to authenticated;
-- Column-level, so the reading's own fields stay out of reach even though the
-- row is writable. A summary the person writes before any reading exists has
-- no keywords and no body, which is exactly what it should look like.
grant update (body_user, updated_at) on public.period_summaries to authenticated;
grant insert (user_id, period_type, period_key, body_user, updated_at)
  on public.period_summaries to authenticated;

create index if not exists logs_user_period_idx on public.logs (user_id, period_key);
create index if not exists future_memos_user_status_idx on public.future_memos (user_id, status);
create index if not exists month_insights_user_period_idx on public.month_insights (user_id, period_key);
create index if not exists period_summaries_user_idx on public.period_summaries (user_id, period_type, period_key);
