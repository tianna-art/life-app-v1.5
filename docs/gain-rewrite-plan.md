# crincran — Gain Journal 大幅アップデート 実装計画

> Single Source of Truth はプロンプト（新仕様）。以下は「旧 v1.5 実装」と「新仕様」の差分と移行手順。

---

## 1. 現在のコードベース（調査結果）

| 層 | 実装 |
|---|---|
| フレームワーク | Expo SDK 57 / expo-router / React Native 0.86 / React 19 / RN Web（Vercel に web export） |
| 状態 | @tanstack/react-query + zustand（`src/state/uiStore.ts`） |
| 永続化 | Supabase（RLS 前提）／`LocalRepository`（AsyncStorage）の二実装 + `src/offline/queue.ts` の outbox |
| 認証 | `useAuth` + `AuthGate` + OAuth（`src/lib/oauth.ts`） |
| AI | Supabase Edge Functions 3本（`analyze-log` / `category-insight` / `period-title`）。API キーは Edge 側のみ |
| 画面 | `(tabs)/map` `(tabs)/log` `(tabs)/list` + `log/[id]` `settings/categories` `onboarding` |
| MAP | `src/map/graph.ts` + `components/map/OrbitGraph.tsx`：**カテゴリー中心**の力学レイアウト |
| DB | `profiles / categories / logs / log_ai_analysis / period_titles / monthly_intentions / category_insights / keyword_reviews` |

再利用できるもの（そのまま活かす）：**認証・Supabase クライアント・repository 抽象・offline queue・react-query 配線・テーマ（`src/theme`）・`Screen/Eyebrow/EmptyState/Toast/HairlineRule/PhoneFrame`・`utils/period`・`utils/similarity`・Edge Function の LLM プロバイダ抽象**。

---

## 2. 旧仕様 → 新仕様 差分一覧

| 領域 | 旧 v1.5 | 新 crincran | 判定 |
|---|---|---|---|
| 中心思想 | ユーザーが分類し、AI がキーワードを要約 | 出来事だけ残す。内省と意味づけは AI | 置換 |
| 入力分類 | ユーザー定義の6カテゴリー（追加・並べ替え・アイコン選択可） | 固定3つ `進んだ / ひっかかった / 心が動いた` | 置換 |
| 入力種別 | `出来事 / つぶやき` の2択が必須 | 廃止（AI が `journey_role` を推定） | 削除 |
| 入力導線 | 種別→カテゴリー→プロンプト質問→本文→✓（4ステップ） | チップ1タップ + 一文 + ✓（10秒） | 置換 |
| 内省の主体 | カテゴリー別の質問でユーザーに考えさせる | 質問を出さない。AI が PICK UP / CONNECT / COMPARE / EXTRACT | 置換 |
| 保存後 | トースト「記録しました」 | `TODAY'S GAIN` を最大1つ、短く | 追加 |
| 解析出力 | `keywords / semantic_tags / tone / confidence` | `event_summary / journey_role / gain_status / gains[] / semantic_tags / possible_links[]` | 置換 |
| 蓄積の単位 | なし（ログ単体の keyword のみ） | **Gain**（6分類 × 成熟度5段階 × evidence 紐付け） | 新規 |
| MAP | カテゴリー中心。ログが星として並ぶ | **ME 中心**。ME → GainType → Gain → Evidence の4階層 | 置換 |
| 期間切替 | 月/年トグル + 前後矢印 | 月のみ、上部を横スワイプ。NEW / CONTINUING を区別 | 置換 |
| 月次 | 月タイトル候補3案をユーザーが確定 + 今月の宣言 | 月末に `TITLE / 3 GAINS / ONE CHANGE` を静かに提示 | 置換 |
| 時間をまたぐ分析 | なし（期間内のキーワード集計のみ） | Cross-Time Reflection（REPEAT/CHANGE/BUILD/EXPERIMENT/ADAPT/REFRAME/GAIN）と `journey_links` | 新規 |
| 失敗の扱い | カテゴリー「モヤモヤ」に置くだけ | `setback` は setback のまま保持。後日ログで初めて接続 | 新規 |
| フィードバック | キーワード3件を「納得した/編集/スキップ」 | Gain 詳細で `納得した / 少し違う` の2択のみ | 簡素化 |
| 設定画面 | カテゴリーの追加・改名・アイコン・並べ替え | 廃止（ユーザーに分類作業をさせない） | 削除 |
| LIST | 年 + 種別フィルタ + 月宣言 + タイトル編集 | 年 → 月見出し（月タイトル）→ 日付と一行 | 簡素化 |

---

## 3. 削除する旧機能（明示）

**画面 / コンポーネント**

- `app/settings/categories.tsx`（カテゴリー管理）
- `app/onboarding/index.tsx`（複雑なオンボーディングは §24 で禁止）
- `components/log/LogTypeToggle.tsx`（出来事/つぶやき）
- `components/log/CategorySelector.tsx` / `components/log/CategoryPrompt.tsx`（内省を促す質問）
- `components/log/InlineComposer.tsx` → `GainComposer` に置換
- `components/settings/IconPicker.tsx` / `components/ui/CategoryMark.tsx` / `components/map/CelestialGlyphs.tsx`
- `components/map/OrbitGraph.tsx` / `StarLogNode.tsx` / `CategoryArticle.tsx` / `CategoryInsightSheet.tsx` / `KeywordReview.tsx`
- `components/titles/MonthlyTitleCard.tsx` / `YearlyTitleCard.tsx` / `TitleEditor.tsx`（タイトルはユーザーが決めない）
- `components/list/LogFilterTabs.tsx`（種別フィルタ）
- `components/log/LogMenu` の「カテゴリーの設定」項目

**ロジック**

- `src/constants/categories.ts` / `src/constants/icons.ts`（カテゴリー辞書・アイコン語彙）
- `src/hooks/useCategories.ts` / `useInsight.ts` / `useIntention.ts` / `useTitles.ts`
- `src/map/graph.ts`（カテゴリー中心レイアウト）→ `src/map/gainGraph.ts`
- `src/ai/article.ts`（カテゴリー記事）
- `src/utils/titleUnlock.ts`（タイトル解禁ルール）
- Edge Function `category-insight/` と `period-title/`

**DB（データは消さない）**

- `categories` / `category_insights` / `keyword_reviews` / `monthly_intentions` / `period_titles` は **テーブルを残したまま参照をやめる**（deprecated 扱い）。`logs.category_id` は履歴として残すが NOT NULL を外す。

---

## 4. DB migration plan

新規 migration: `supabase/migrations/20260905000000_gain_model.sql`（再実行安全）

1. **enum 追加** — `input_category` / `gain_type` / `gain_maturity` / `gain_status` / `journey_role` / `journey_link_relation` / `gain_evidence_relation` / `gain_verdict`
2. **`logs` 拡張**
   - `input_category` 追加
   - **旧データの自動マッピング**（本文は保持）
     | 旧 slug | 旧名称 | → 新 inputCategory |
     |---|---|---|
     | `tsumiage` / `kyokun` | できたこと / 学び | `progress` |
     | `hikkakari` | モヤモヤ | `friction` |
     | `tokimeki` / `kankeisei` / `sonota` | 楽しかったこと / 人間関係 / その他 | `moved` |
     | 上記以外（ユーザー作成） | — | `moved` |
   - backfill 後に `NOT NULL`、`category_id` と `type` は NULL 許容へ
   - `occurred_at timestamptz` を追加（`occurred_on` + `created_at` から backfill）
3. **新テーブル** — `gains` / `gain_evidence` / `journey_links` / `month_reviews`
4. **`log_ai_analysis` 拡張** — `event_summary` / `journey_role` / `gain_status`
5. **RLS** — 新テーブルはすべて `auth.uid() = user_id`。`gains` は本人が select / update（フィードバックと少しの編集）、insert/delete は Edge Function の service role のみ。`gain_evidence` と `journey_links` は所有ログ経由で select のみ
6. **index** — `gains(user_id, type, last_detected_at desc)`、`gain_evidence(gain_id)`、`journey_links(from_log_id)` / `(to_log_id)`、`month_reviews(user_id, period_key)`
7. **view 更新** — `logs_with_analysis` に `input_category` / `event_summary` / `journey_role` / `gain_status`

---

## 5. 新しい画面構造

```
app/
  _layout.tsx            Auth → Stack
  index.tsx              → /log
  (tabs)/
    _layout.tsx          MAP | LOG | LIST（中央 LOG が Home）
    log.tsx              HOME：月 → 「今日、何があった？」→ 3チップ → 常時入力 → ✓ → TODAY'S GAIN
    map.tsx              月ストリップ + ME 中心 Radial Gain Map
    list.tsx             年 → 月見出し（月タイトル）→ 日付と一行
  log/[id].tsx           全文 + この記録から残ったもの
  month/[key].tsx        月末：THIS MONTH IS COMPLETE. / TITLE / 3 GAINS / ONE CHANGE
```

MAP のノード階層

```
Level 0  ME（常に中央）
Level 1  GainType（存在するものだけ・最大6）
Level 2  その人固有の Gain（AI が発見）
Level 3  Evidence（支えているログ／小さな星）
```

Gain をタップ → `HOW IT FORMED`（setback → learning → adaptation → attempt → gain の連なり）+ `納得した / 少し違う`。

通常表示は ME / Gain ノード / 線 のみ。数値・割合・スコアは出さない。

---

## 6. 実装順（プロンプト §31 に準拠）

1. **Phase 1** データモデル・migration・HOME 直接入力・3カテゴリー・保存
2. **Phase 2** 単一ログ Gain 抽出・TODAY'S GAIN・Gain 永続化・成熟度
3. **Phase 3** ME 中心 Radial MAP・Gain → evidence 階層・月スワイプ
4. **Phase 4** cross-time 分析・journey linking・gain consolidation・紆余曲折パス
5. **Phase 5** 月タイトル・3 GAINS・ONE CHANGE
6. **Phase 6** 視覚調整・アニメーション・アクセシビリティ・オフライン・テスト
