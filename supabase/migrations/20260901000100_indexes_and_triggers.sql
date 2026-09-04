-- Additive hardening on top of the base schema. Nothing here changes a column
-- or a policy defined in 20260901000000_init.sql.

-- updated_at maintenance -----------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'categories', 'logs', 'log_ai_analysis', 'period_titles',
    'monthly_intentions', 'category_insights', 'keyword_reviews'
  ]
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Query paths actually used by the app ---------------------------------------
create index if not exists categories_user_sort_idx
  on public.categories(user_id, sort_order);

create index if not exists period_titles_user_type_key_idx
  on public.period_titles(user_id, period_type, period_key);

create index if not exists monthly_intentions_user_key_idx
  on public.monthly_intentions(user_id, period_key);

create index if not exists category_insights_lookup_idx
  on public.category_insights(user_id, period_type, period_key, category_id);

-- A category that has history must never be hard-deleted; the FK below is
-- already restrictive, this makes the intent explicit and the error readable.
create or replace function public.prevent_category_delete_with_history()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.logs where category_id = old.id) then
    raise exception
      'Category % has logs and cannot be deleted. Set is_active = false instead.', old.id
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists categories_soft_delete_guard on public.categories;
create trigger categories_soft_delete_guard
  before delete on public.categories
  for each row execute function public.prevent_category_delete_with_history();

-- New signups get their profile row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
