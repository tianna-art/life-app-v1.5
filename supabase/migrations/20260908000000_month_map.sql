-- crincran — the month's map brief.
--
-- What a month's map needs in order to be a map rather than a scatter of
-- points: which points it opens with, and why the first one leads.
--
-- The brief is markdown and is not rendered. It is the working-out — the
-- points laid out in order with what each stands on — kept so that a later
-- reading can see what the earlier one thought, and so the reason shown on
-- screen has something behind it other than the model's memory.
--
-- One row per person per month. Re-generating a month replaces it; the
-- generated_at is what says whether the map is still about what is there.
--
-- Re-runnable: every statement is guarded.

create table if not exists public.month_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),

  -- The working-out. Markdown, never shown.
  brief_markdown text not null default '',

  -- The point the month opens with, and the sentence under it. The reason is
  -- reasoned backwards from the year's direction and the cards the person
  -- chose, so it says why this point matters to them rather than why the
  -- model found it interesting.
  lead_progression_id uuid references public.progressions(id) on delete set null,
  lead_reason text not null default '',

  -- The order the points were chosen in, with a line each. Ids only, so a
  -- title the person later corrects is not frozen here.
  points jsonb not null default '[]'::jsonb,

  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_key)
);

create index if not exists month_maps_user_period_idx
  on public.month_maps(user_id, period_key desc);

alter table public.month_maps enable row level security;

drop policy if exists "month_maps_own_select" on public.month_maps;
create policy "month_maps_own_select" on public.month_maps
  for select using (auth.uid() = user_id);

drop trigger if exists touch_month_maps on public.month_maps;
create trigger touch_month_maps before update on public.month_maps
  for each row execute function public.touch_updated_at();

comment on table public.month_maps is
  'The working-out behind one month of the map. brief_markdown is never rendered.';
comment on column public.month_maps.lead_reason is
  'Why the leading point leads, reasoned back from the direction. Not a score.';
