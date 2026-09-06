-- crincran — gains.type stops being required.
--
-- It is the v2 vocabulary that public.gain_category replaced in September.
-- Nothing reads it: the app maps every gain through `category`, and `type`
-- survives only because dropping a column loses the rows written under it.
--
-- Being NOT NULL with no default made it a trap. One writer knew and filled it
-- from the progression's type — a value that means nothing and is documented
-- as meaning nothing. The next writer did not know, and its insert failed at
-- the database: the month published one change, then threw, and the brief that
-- is written last never existed. From outside that reads as a thin month.
--
-- A column nobody reads must not be able to fail a write. Existing rows keep
-- what they have.
alter table public.gains alter column type drop not null;

comment on column public.gains.type is
  'Superseded 2026-09 by gains.category. Nothing reads it; nothing new writes it.';
