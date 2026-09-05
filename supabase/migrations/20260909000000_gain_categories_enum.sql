-- crincran — the six kinds of gain (§2 of the AI design notes).
--
-- Part 1 of 2: the values only. Postgres will not let a value be used in the
-- transaction that created it, so the rows move in 20260909000100.
--
-- Three of the six already exist — evidence, method, connection — and three
-- are new. The four that are going (clarity, capability, choice, recovery)
-- stay in the type: a value cannot be removed from an enum without rewriting
-- every column that uses it, and keeping them costs nothing once nothing
-- writes them.

do $$ begin alter type public.gain_category add value if not exists 'insight'; end $$;
do $$ begin alter type public.gain_category add value if not exists 'criterion'; end $$;
do $$ begin alter type public.gain_category add value if not exists 'option'; end $$;
