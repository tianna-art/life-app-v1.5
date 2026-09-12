-- crincran — 記録を Google のアカウントへ寄せる
--
-- Supabase の SQL Editor で、**エディタを空にしてから、このファイルの中身を
-- 全部**貼って実行してください。
--
-- 722tomone@gmail.com（メール認証）に残っている記録を
-- crincran.life@gmail.com（Google）へ移します。
--
-- 何度実行しても結果は同じです。移すものが無ければ何もしません。
-- 移す前に、移す側の行をまるごと archive_v2 に控えます。

do $$
declare
  from_id uuid;
  to_id   uuid;
  moved   bigint;
begin
  select id into from_id from auth.users where email = '722tomone@gmail.com';
  select id into to_id   from auth.users where email = 'crincran.life@gmail.com';

  if from_id is null or to_id is null then
    raise exception 'どちらかのアカウントが見つかりません（from=%, to=%）', from_id, to_id;
  end if;
  if from_id = to_id then
    raise notice '同じアカウントです。何もしません。';
    return;
  end if;

  -- 控え。user_id を書き換える前の姿を一度だけ残します。
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'archive_v2' and table_name = 'logs_before_account_move') then
    execute 'create table archive_v2.logs_before_account_move as
             select * from public.logs where user_id = $1' using from_id;
    execute 'revoke all on archive_v2.logs_before_account_move from anon, authenticated';
  end if;

  update public.logs set user_id = to_id where user_id = from_id;
  get diagnostics moved = row_count;
  raise notice '記録を % 件移しました。', moved;

  -- 足跡タイトルは (user_id, period_type, period_key) で一意なので、
  -- 移す先に同じ期間の名前が既にある場合は、移さずに置いていきます。
  -- 名前は本人が付けたものなので、勝手に上書きしません。
  update public.period_titles p set user_id = to_id
   where p.user_id = from_id
     and not exists (
       select 1 from public.period_titles q
        where q.user_id = to_id
          and q.period_type = p.period_type
          and q.period_key = p.period_key);
  get diagnostics moved = row_count;
  raise notice '足跡タイトルを % 件移しました。', moved;
end
$$;

-- 結果
select u.email,
       (select count(*) from public.logs l where l.user_id = u.id) as logs,
       (select count(*) from public.period_titles t where t.user_id = u.id) as titles
  from auth.users u
 order by u.created_at;
