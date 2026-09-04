-- ============================================================================
-- v1.5 のデータを新スキーマへ取り込む（同じ Supabase プロジェクト内で完結）
--
-- 前提: 20260831000000 / 20260901000000 / 20260901000100 の3本を適用済みで、
--       旧テーブルが logs_v15 / months_v15 / years_v15 に退避されていること。
--
-- 使い方: エディタを空にしてから、このファイルの中身を「全部」貼って Run。
--         書き換えは不要です（722tomone@gmail.com が設定済み）。
--         先に setup-life-map.sql を実行し、アプリでサインアップしておくこと。
--         何度実行しても重複しません（本文一致でスキップ）。
--
-- 変換は不可逆です。旧モデルには 出来事 / つぶやき の区別と編集可能な
-- カテゴリーが無かったため、入口の種類から推定しています。
--   moved / wish  (好きなこと) -> ときめき   / 出来事
--   effort / chose (キャリア)   -> 積み上げ   / 出来事
--   hard          (つぶやき)   -> その他     / つぶやき
-- 月の章(chapter) はその月の末日の「つぶやき」ログとして取り込みます。
-- v1.5 の chapter は jsonb のことがあるため、文字列としても JSON としても読めるようにしています。
-- futures / place / people / tags / tone / angle は *_v15 に残したままです。
-- ============================================================================

do $$
declare
  target_email  text := '722tomone@gmail.com';   -- 設定済み（書き換え不要）
  target_user   uuid;
  inserted_logs int := 0;
  inserted_chap int := 0;
  inserted_ttl  int := 0;
begin
  select id into target_user from auth.users where email = target_email;
  if target_user is null then
    raise exception 'auth.users に % がいません。先にアプリでサインアップしてください。', target_email;
  end if;

  -- プロフィールと初期カテゴリー（アプリ側と同一。既にあれば何もしない）
  insert into public.profiles (id) values (target_user) on conflict (id) do nothing;

  insert into public.categories (user_id, name, slug, sort_order, is_active, is_default, prompt_examples)
  values
    (target_user, '楽しかったこと',   'tokimeki',  0, true, true,
     '["今日ちょっと「いいな」と思ったことは？","つい時間を使ってしまったものは？","また触れたいと思ったものは？"]'::jsonb),
    (target_user, 'できたこと',   'tsumiage',  1, true, true,
     '["今日、少しでも手を動かしたことは？","小さく前に進んだと思えることは？","昨日までより少しできたことは？"]'::jsonb),
    (target_user, '学び',       'kyokun',    2, true, true,
     '["今日の出来事から「次はこうしてみよう」と思ったことは？","次回は少し変えてみたいことは？","今日わかった「こうすると良さそう」は？"]'::jsonb),
    (target_user, 'モヤモヤ', 'hikkakari', 3, true, true,
     '["今日、少し引っかかったことは？","ちょっと悔しかったことは？","「なんか違う」と感じたことは？"]'::jsonb),
    (target_user, '人間関係',     'kankeisei', 4, true, true,
     '["今日、誰かとのやりとりで心地よかった / しんどかったことは？","どんな関わり方だと自分は力を出しやすかった？","誰といる時、自然に動けた？"]'::jsonb),
    (target_user, 'その他',     'sonota',    5, true, true,
     '["今残しておきたいことは？"]'::jsonb)
  on conflict (user_id, slug) do nothing;

  -- ── ログ本体 ────────────────────────────────────────────────────────────
  if to_regclass('public.logs_v15') is not null then
    with mapped as (
      select
        l.body,
        coalesce(l.occurred_at, current_date) as occurred_on,
        case when coalesce(l.kind,'hard') = 'hard' then 'thought' else 'event' end as type,
        case coalesce(l.kind,'hard')
          when 'moved'  then 'tokimeki'
          when 'wish'   then 'tokimeki'
          when 'effort' then 'tsumiage'
          when 'chose'  then 'tsumiage'
          else 'sonota'
        end as slug
      from public.logs_v15 l
      where btrim(coalesce(l.body,'')) <> ''
    )
    insert into public.logs (user_id, occurred_on, type, category_id, body)
    select target_user, m.occurred_on::date, m.type::public.log_type, c.id, btrim(m.body)
    from mapped m
    join public.categories c on c.user_id = target_user and c.slug = m.slug
    where not exists (
      select 1 from public.logs x where x.user_id = target_user and x.body = btrim(m.body)
    );
    get diagnostics inserted_logs = row_count;
  end if;

  -- ── 月の章 → その月末日の「つぶやき」ログ ──────────────────────────────
  if to_regclass('public.months_v15') is not null then
    insert into public.logs (user_id, occurred_on, type, category_id, body)
    select
      target_user,
      (date_trunc('month', (m.ym || '-01')::date) + interval '1 month - 1 day')::date,
      'thought'::public.log_type,
      c.id,
      btrim(coalesce(m.chapter #>> '{}', m.chapter::text))
    from public.months_v15 m
    join public.categories c on c.user_id = target_user and c.slug = 'sonota'
    where btrim(coalesce(m.chapter #>> '{}', m.chapter::text, '')) <> ''
      and not exists (
        select 1 from public.logs x
        where x.user_id = target_user
          and x.body = btrim(coalesce(m.chapter #>> '{}', m.chapter::text))
      );
    get diagnostics inserted_chap = row_count;
  end if;

  -- ── 月タイトル / 年タイトル ─────────────────────────────────────────────
  if to_regclass('public.months_v15') is not null then
    insert into public.period_titles (user_id, period_type, period_key, title, source, is_confirmed)
    select target_user, 'month'::public.period_type, m.ym, btrim(m.title), 'manual'::public.title_source, true
    from public.months_v15 m
    where btrim(coalesce(m.title,'')) <> ''
    on conflict (user_id, period_type, period_key) do nothing;
    get diagnostics inserted_ttl = row_count;
  end if;

  if to_regclass('public.years_v15') is not null then
    insert into public.period_titles (user_id, period_type, period_key, title, source, is_confirmed)
    select target_user, 'year'::public.period_type, y.year::text, btrim(y.title), 'manual'::public.title_source, true
    from public.years_v15 y
    where btrim(coalesce(y.title,'')) <> ''
    on conflict (user_id, period_type, period_key) do nothing;
  end if;

  raise notice 'imported: % logs, % month chapters, % month titles', inserted_logs, inserted_chap, inserted_ttl;
end $$;

-- 取り込み結果の確認
select 'logs'          as t, count(*) from public.logs
union all select 'period_titles', count(*) from public.period_titles
union all select 'categories',    count(*) from public.categories;
