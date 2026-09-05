-- crincran — forget every reading, keep every record.
--
-- The records are what the person wrote; the readings are what the model made
-- of them. When a reading was made under a version that has since changed —
-- or, as here, when an analysis write was failing silently and left
-- progressions standing on records marked unread — the readings are wrong and
-- the records are fine.
--
-- What goes: the per-record analysis, the progressions and their evidence and
-- gains, the month briefs, and the month and year readings. All of it is
-- derived, and all of it can be made again from the records.
--
-- What stays: every log, the year's direction, the month themes. Nothing the
-- person wrote or chose is touched.
--
-- Re-runnable, and safe to run on an account that has never been read.

do $$
declare
  uid uuid;
  removed_analysis integer;
  removed_progressions integer;
begin
  select id into uid from auth.users where lower(email) = lower('__DEMO_EMAIL__');
  if uid is null then
    raise exception 'このメールアドレスのアカウントが見つかりません: %', '__DEMO_EMAIL__';
  end if;

  delete from public.log_ai_analysis a
   using public.logs l
   where l.id = a.log_id and l.user_id = uid;
  get diagnostics removed_analysis = row_count;

  -- Evidence and gains hang off progressions and go with them.
  delete from public.progressions where user_id = uid;
  get diagnostics removed_progressions = row_count;

  delete from public.month_maps where user_id = uid;
  delete from public.month_reviews where user_id = uid;
  delete from public.year_reviews where user_id = uid;

  raise notice 'crincran reset: % readings, % progressions forgotten for %',
    removed_analysis, removed_progressions, '__DEMO_EMAIL__';
end $$;
