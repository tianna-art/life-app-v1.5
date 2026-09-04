-- crincran — カテゴリーのアイコン
--
-- Supabase の SQL Editor で、**エディタを空にしてから、このファイルの中身を
-- 全部**貼って実行してください。ファイル名や行番号は貼らないこと。
-- 何度実行しても結果は同じです（列の追加も、既定マークの設定も、すでに
-- 入っていれば何もしません）。自分で選び直したマークは上書きされません。

-- Category marks.
--
-- A category carries the mark it wears, so the composer, the settings screen
-- and the MAP all draw the same figure for the same drawer. The vocabulary is
-- append-only and mirrored in src/constants/icons.ts — the two lists must stay
-- in step, and __tests__/categoryIcons.test.ts fails if they drift.
--
-- Re-runnable: adding the column, the constraint and the seeding are each
-- guarded, so applying this twice changes nothing.

alter table public.categories
  add column if not exists icon text not null default 'orbit';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_icon_check'
  ) then
    alter table public.categories
      add constraint categories_icon_check check (
        icon in (
          'sun', 'ringed', 'starburst', 'crescent', 'comet',
          'orbit', 'constellation', 'compass', 'spiral', 'phases'
        )
      );
  end if;
end
$$;

-- The six default drawers get their marks. Matched on slug, which is the
-- frozen key: renaming a category never moved it, and this does not either.
-- Only rows still on the default mark are touched, so a user who has already
-- chosen something keeps their choice.
update public.categories set icon = 'starburst' where slug = 'tokimeki'  and icon = 'orbit';
update public.categories set icon = 'sun'       where slug = 'tsumiage'  and icon = 'orbit';
update public.categories set icon = 'compass'   where slug = 'kyokun'    and icon = 'orbit';
update public.categories set icon = 'spiral'    where slug = 'hikkakari' and icon = 'orbit';
update public.categories set icon = 'crescent'  where slug = 'sonota'    and icon = 'orbit';
-- 人間関係 keeps 'orbit': two bodies holding each other in place.
