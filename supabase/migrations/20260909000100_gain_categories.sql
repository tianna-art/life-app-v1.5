-- crincran — the six kinds of gain, applied.
--
-- Part 2 of 2. 20260909000000 must be applied first.
--
-- Progression is how someone walked; Gain is what the walking left them with.
-- The seven categories mixed the two: `capability` and `recovery` described
-- the walking, and `clarity` and `choice` split one thing across two names.
-- Six now, each of them something a person is left holding:
--
--   evidence    行動・経験した事実
--   method      見つけた方法
--   insight     自分や環境について分かったこと
--   connection  生まれたつながり
--   criterion   判断に使える基準
--   option      新しく増えた可能性
--
-- Where the old rows go, and why:
--   clarity    → insight     the same thing, named for what it is
--   capability → evidence    "can do it now" is the record of having done it
--   choice     → criterion   a decision made is a standard to decide by
--   recovery   → evidence    getting going again is something that happened
--
-- Nothing is deleted. Re-runnable.

update public.gains set category = 'insight'   where category = 'clarity';
update public.gains set category = 'evidence'  where category = 'capability';
update public.gains set category = 'criterion' where category = 'choice';
update public.gains set category = 'evidence'  where category = 'recovery';

comment on type public.gain_category is
  'Six kinds of gain. clarity/capability/choice/recovery are retired 2026-09 and no longer written.';
