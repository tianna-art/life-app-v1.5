-- Archive the v1.5 tables before the new schema is created.
--
-- v1.5 (the single-file index.html) wrote to public.logs / months / years /
-- futures through PostgREST, keyed by a client-generated `user_key` text
-- column and with no auth. The new schema also defines public.logs — and
-- because it uses `create table if not exists`, an existing v1.5 `logs` table
-- would silently survive, leaving a table with no `type` or `category_id`
-- and an app that fails at runtime for no visible reason.
--
-- This migration runs FIRST (its timestamp sorts before the init migration).
-- It renames the legacy tables out of the way instead of dropping them, and
-- revokes the API roles' access so the archive is no longer served over
-- PostgREST. Nothing is deleted: export or drop *_v15 yourself once the
-- migration into the new tables is done and verified.
--
-- Safe to run on a fresh project: every branch is conditional.

do $$
declare
  legacy text;
  archived text;
begin
  foreach legacy in array array['logs', 'months', 'years', 'futures']
  loop
    archived := legacy || '_v15';

    -- Only touch a table that is actually the v1.5 shape. The marker is the
    -- `user_key` column, which exists in no table of the new schema.
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = legacy
        and column_name = 'user_key'
    ) then
      if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = archived
      ) then
        raise notice 'public.% already exists; leaving public.% untouched.', archived, legacy;
      else
        execute format('alter table public.%I rename to %I', legacy, archived);
        raise notice 'Renamed public.% to public.%', legacy, archived;

        -- The archive is history, not an API surface.
        execute format('revoke all on public.%I from anon, authenticated', archived);
        execute format('alter table public.%I enable row level security', archived);
      end if;
    end if;
  end loop;
end $$;
