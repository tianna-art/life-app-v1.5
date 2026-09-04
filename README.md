# crincran

**KEEP THE DREAM BREATHING. / 夢に呼吸を。**

日々の出来事・つぶやきを軽く残し、それが時間とともに自分だけの星図として
見えてくるライフジャーナル。Expo / React Native + Supabase。

> このリポジトリは v1.5（単一ファイルの HTML PWA）から
> `crincran_implementation_spec.md` に沿って全面的に書き換えられています。
> 旧データの取り込み手順は [旧バージョンからの移行](#旧バージョンからの移行) を参照。

---

## 画面

| タブ | 役割 |
| --- | --- |
| **MAP** | 感じる / つながりを見る |
| **LOG** | 残す（ホーム） |
| **LIST** | 読む / 時系列で振り返る |

---

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. Supabase プロジェクト

[supabase.com](https://supabase.com) でプロジェクトを作り、SQL エディタで
`supabase/migrations/` の 2 ファイルを番号順に実行します。CLI を使う場合：

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

RLS は `20260901000000_init.sql` の中で全テーブルに対して有効化されており、
すべての行が `auth.uid()` で絞り込まれます。

### 3. 環境変数

```bash
cp .env.example .env
```

`.env` に入れてよいのは **公開値だけ** です。

| 変数 | 内容 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Project Settings → API の URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key（RLS で保護されるためクライアント可） |
| `EXPO_PUBLIC_USE_LOCAL_STORE` | `1` で端末内ストアのみ（UI 確認用） |

**LLM の API キーはこのファイルに置きません。** Edge Function の secret として
のみ存在します（後述）。

### 4. Edge Functions（AI）

```bash
cp supabase/functions/.env.example supabase/functions/.env   # 編集する
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy analyze-log
npx supabase functions deploy category-insight
npx supabase functions deploy period-title
```

`LLM_PROVIDER` は `anthropic` / `openai` / `mock` から選べます。`mock` は
API キー不要で、決めつけを含まない固定 JSON を返すため CI とローカルに向きます。

### 4b. Google ログイン（任意）

1. **Google Cloud Console** → APIs & Services → Credentials →
   Create Credentials → **OAuth client ID** → Application type: **Web application**
   - Authorized redirect URIs に **Supabase のコールバック**を追加：
     `https://<project-ref>.supabase.co/auth/v1/callback`
   - 初回は OAuth consent screen の設定を求められます（External / アプリ名 / 連絡先）
2. **Supabase** → Authentication → Sign In / Providers → **Google** を有効化し、
   Client ID と Client Secret を貼り付けて保存
3. **Supabase** → Authentication → URL Configuration
   - Site URL: 本番の URL
   - Additional Redirect URLs に、プレビュー URL と `crincran://auth-callback` を追加
     （後者がないと iOS / Android から戻ってこられません）

アプリ側は実装済みです。web はページごとリダイレクトし、ネイティブは
アプリ内ブラウザを開いて `crincran://auth-callback` で閉じ、受け取った code を
PKCE で交換します（`src/lib/oauth.ts`）。

### 5. 起動

```bash
npm run ios      # iOS シミュレータ
npm run android
npm run web
```

### 6. デモデータ（任意）

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
SEED_EMAIL=you@example.com SEED_PASSWORD=... npm run seed
```

service role key はこのスクリプト（ローカル実行）でのみ使います。アプリには入りません。

---

## 開発コマンド

```bash
npm run typecheck   # tsc --noEmit（strict）
npm test            # jest
npm run web         # ブラウザで確認
```

---

## Vercel

`vercel.json` が `expo export --platform web` を実行し `dist/` を配信します。
Vercel の Environment Variables に `EXPO_PUBLIC_SUPABASE_URL` と
`EXPO_PUBLIC_SUPABASE_ANON_KEY` を設定してください。

---

## 構成

```
app/                         Expo Router
├─ _layout.tsx               providers / auth gate
├─ index.tsx                 → /log へリダイレクト（ホームは LOG）
├─ (tabs)/                   map.tsx / log.tsx / list.tsx
├─ log/[id].tsx              記録の詳細
├─ settings/categories.tsx   追加・改名・並び替え・非表示
└─ onboarding/index.tsx

components/
├─ navigation/BottomMuseumNav.tsx
├─ log/                      LogComposer / LogTypeToggle / CategorySelector / CategoryPrompt
├─ map/                      ConstellationMap / CelestialCategoryNode / StarLogNode /
│                            CategoryInsightSheet / KeywordReview / CelestialGlyphs
├─ list/                     YearSelector / LogFilterTabs / MonthSection / TruncatedLogRow
├─ titles/                   MonthlyTitleCard / YearlyTitleCard / TitleEditor
└─ ui/                       Screen / BrassButton / EmptyState / Toast / …

src/
├─ theme/                    暗い西洋美術館 × プラネタリウム × 古い天体図
├─ types/                    ドメイン型
├─ constants/                初期カテゴリー・確定コピー
├─ data/                     Repository interface + Supabase / Local 実装
├─ hooks/                    TanStack Query
├─ ai/                       Edge Function クライアント・strict JSON パーサ
├─ map/layout.ts             月次 / 年次のレイアウトアルゴリズム
├─ offline/queue.ts          オフライン送信キュー
└─ utils/                    period / similarity / titleUnlock / text

supabase/
├─ migrations/               スキーマ + RLS
└─ functions/                analyze-log / category-insight / period-title
```

---

## AI の扱い

- クライアントは **LLM を直接呼びません**。すべて Edge Function 経由です。
- API キーは Edge Function の secret にのみ存在します。
- プロバイダは `supabase/functions/_shared/llm.ts` の interface で抽象化されています。
- プロンプトには診断・人格断定・意味づけの禁止が明記されています
  （`supabase/functions/_shared/prompts.ts`）。
- 応答は strict JSON。形が崩れた応答は `src/ai/types.ts` のパーサが破棄します。
- **ログ保存と AI 解析は独立しています。** 解析が失敗してもログは消えません。

### MAP の意味リンク

`semantic_tags` の Jaccard 類似度が `0.34` 以上のログ同士を薄く接続します。
1 ログあたり最大 2 本。類似度そのものは UI に出しません。

---

## 旧バージョンからの移行

旧 crincran（単一ファイル HTML / `localStorage` の `crincran.v1`）のデータは
エクスポート JSON から取り込めます。

```bash
# 1. 旧アプリの設定シートから「書き出し」→ crincran-YYYY-MM-DD.json
# 2. 新アプリでサインアップしてから：
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_EMAIL=you@example.com \
  npx tsx scripts/migrate-legacy.ts ./crincran-2026-09-04.json
```

対応は次のとおりです。旧モデルには 出来事 / つぶやき の区別と編集可能な
カテゴリーが無かったため、変換は不可逆です。

| 旧 | 新 |
| --- | --- |
| `moved` 好きなこと | カテゴリー **ときめき** / 出来事 |
| `effort` キャリア | カテゴリー **積み上げ** / 出来事 |
| `hard` つぶやき | カテゴリー **その他** / つぶやき |
| 月の章（chapter） | その月の末日の **つぶやき** ログ |
| 月タイトル / 年タイトル | `period_titles`（manual・確定済み） |
| Future Memo | MVP に該当機能なし → `*.unmapped.json` に退避 |
| place / people / tags | 本文を書き換えないため退避のみ |
| tone / angle | 同上 |

捨てずに `<入力ファイル>.unmapped.json` へ書き出します。

---

## テスト

```bash
npm test
```

70 件。仕様の受け入れ条件に対応しています。

| 観点 | ファイル |
| --- | --- |
| 出来事 / つぶやきの保存、カテゴリー必須、カスタムカテゴリー、ソフト削除 | `logs.repository.test.ts`, `composer.test.tsx` |
| LIST のフィルターと 1 行省略 | `list.filter.test.ts` |
| 月次 / 年次タイトルの AI 解禁条件 | `titleUnlock.test.ts` |
| MAP が使用カテゴリーのみ表示 / 期間を混ぜない / 意味リンク上限 | `map.layout.test.ts` |
| キーワードの 編集・スキップ・納得した と並び順 | `keywordReview.test.tsx` |
| AI 失敗でログが消えない / 壊れた JSON の破棄 | `aiFailure.test.ts` |
| オフラインキュー | `offline.queue.test.ts` |
| 禁止表現がコードに存在しない | `copy.test.ts` |
| Google ログイン（code 交換・キャンセル・web/native の分岐） | `oauth.test.ts` |

`jest.forceExit` を有効にしています。jest-expo + RN 0.86 の組み合わせで
テスト終了後もハンドルが 1 つ残るためで、テスト自体のリークではありません
（`--detectOpenHandles` は個別スイートで何も報告しません）。

---

## MVP に入れていないもの

Like / フォロワー / ストリーク / スコア / 円グラフ / パーセンテージ /
性格診断 / 適職断定 / AI による人格断定 / 毎日アートを選ぶ導線 /
「5 カテゴリーを埋めよう」表示 / 月をまたいだ通常 MAP の混在 / タグ入力の必須化。
