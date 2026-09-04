-- crincran Supabase / PostgreSQL schema
-- Draft 2026.09

create extension if not exists "pgcrypto";

do $$ begin
  create type public.log_type as enum ('event', 'thought');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.period_type as enum ('month', 'year');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_status as enum ('pending', 'accepted', 'edited', 'skipped');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.title_source as enum ('manual', 'ai');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_default boolean not null default false,
  prompt_examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  type public.log_type not null,
  category_id uuid not null references public.categories(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logs_user_date_idx
  on public.logs(user_id, occurred_on desc);

create index if not exists logs_category_idx
  on public.logs(category_id, occurred_on desc);

create table if not exists public.log_ai_analysis (
  log_id uuid primary key references public.logs(id) on delete cascade,
  keywords text[] not null default '{}',
  semantic_tags text[] not null default '{}',
  tone text,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  model_name text,
  analysis_version text not null default 'v1',
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.period_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type public.period_type not null,
  period_key text not null, -- YYYY-MM or YYYY
  title text not null,
  source public.title_source not null default 'manual',
  is_confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_type, period_key)
);

create table if not exists public.monthly_intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null, -- YYYY-MM
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_key)
);

create table if not exists public.category_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type public.period_type not null,
  period_key text not null,
  category_id uuid not null references public.categories(id),
  insight text not null,
  keywords jsonb not null default '[]'::jsonb,
  evidence_log_ids uuid[] not null default '{}',
  status public.review_status not null default 'pending',
  model_name text,
  analysis_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_type, period_key, category_id)
);

create table if not exists public.keyword_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_id uuid not null references public.category_insights(id) on delete cascade,
  original_keywords jsonb not null,
  final_keywords jsonb,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, insight_id)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.logs enable row level security;
alter table public.log_ai_analysis enable row level security;
alter table public.period_titles enable row level security;
alter table public.monthly_intentions enable row level security;
alter table public.category_insights enable row level security;
alter table public.keyword_reviews enable row level security;

-- Helper policies.
-- Re-run safely by dropping known policy names first.

drop policy if exists "profiles_own_all" on public.profiles;
create policy "profiles_own_all"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "categories_own_all" on public.categories;
create policy "categories_own_all"
on public.categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "logs_own_all" on public.logs;
create policy "logs_own_all"
on public.logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "period_titles_own_all" on public.period_titles;
create policy "period_titles_own_all"
on public.period_titles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "monthly_intentions_own_all" on public.monthly_intentions;
create policy "monthly_intentions_own_all"
on public.monthly_intentions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "category_insights_own_all" on public.category_insights;
create policy "category_insights_own_all"
on public.category_insights
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "keyword_reviews_own_all" on public.keyword_reviews;
create policy "keyword_reviews_own_all"
on public.keyword_reviews
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- AI analysis table access through owning log.
drop policy if exists "log_ai_analysis_own_select" on public.log_ai_analysis;
create policy "log_ai_analysis_own_select"
on public.log_ai_analysis
for select
using (
  exists (
    select 1
    from public.logs l
    where l.id = log_ai_analysis.log_id
      and l.user_id = auth.uid()
  )
);

-- Direct client writes to AI analysis are intentionally not allowed.
-- Use a service-role Edge Function.

-- Useful view
create or replace view public.logs_with_analysis
with (security_invoker = true)
as
select
  l.*,
  c.name as category_name,
  a.keywords,
  a.semantic_tags,
  a.tone,
  a.confidence
from public.logs l
join public.categories c on c.id = l.category_id
left join public.log_ai_analysis a on a.log_id = l.id;

-- Seed helper is application-side because categories are per-user.
-- Default category definitions:
-- ときめき / 積み上げ / 教訓 / ひっかかり / 関係性 / その他
