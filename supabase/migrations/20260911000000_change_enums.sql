-- crincran — the Change model, part 1 of 2: enum values only.
--
-- Split because Postgres refuses to use a value added by ALTER TYPE ... ADD
-- VALUE inside the transaction that added it, and part 2 both creates tables
-- that use these and needs 'long_term' to be usable.
--
-- Re-runnable: every statement is guarded.

-- Which of the things the person put down at the start this change answers to.
-- A change that answers to none of them is not published: a point on the map
-- the person cannot trace back to something they wanted is a topic, not a
-- change. 'emerging_direction' is the exception and the important one — it is
-- what repeated enjoyment outside the stated direction becomes, and it is a
-- discovery rather than a miss.
do $$ begin create type public.change_target_type as enum
  ('month_declaration', 'year_direction', 'desired_self', 'emerging_direction');
exception when duplicate_object then null; end $$;

-- How much the records will carry. It decides the wording on screen and
-- nothing else: signal says "a record pointing that way", supported says
-- "this is visible", strong is the only one allowed to say "from A to B",
-- and it is the only one that needs evidence from before this month.
do $$ begin create type public.change_confidence as enum
  ('signal', 'supported', 'strong');
exception when duplicate_object then null; end $$;

-- What one record does inside a change. Same vocabulary as the progression
-- trail, minus 'origin' — a change is read from where the person was, and
-- 'before' says that more plainly than 'origin' did.
do $$ begin create type public.change_evidence_role as enum
  ('before', 'attempt', 'friction', 'change', 'evidence', 'current');
exception when duplicate_object then null; end $$;

-- A change that spans more than a year has nowhere to sit otherwise.
alter type public.period_type add value if not exists 'long_term';
