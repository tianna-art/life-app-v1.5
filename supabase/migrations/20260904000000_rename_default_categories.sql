-- Rename the six default categories to the wording the app now ships.
--
-- Only rows still carrying the original default name are touched: a category a
-- user renamed themselves keeps their wording. Slugs are left alone on purpose
-- — they are the stable key every log is joined on, so this is a display-name
-- change and nothing else.

update public.categories set name = '楽しかったこと', updated_at = now()
  where slug = 'tokimeki'  and name = 'ときめき';
update public.categories set name = 'できたこと',   updated_at = now()
  where slug = 'tsumiage'  and name = '積み上げ';
update public.categories set name = '学び',         updated_at = now()
  where slug = 'kyokun'    and name = '教訓';
update public.categories set name = 'モヤモヤ',     updated_at = now()
  where slug = 'hikkakari' and name = 'ひっかかり';
update public.categories set name = '人間関係',     updated_at = now()
  where slug = 'kankeisei' and name = '関係性';
