# crincran

**人には出来事だけを残してもらう。内省はAIが引き受ける。**

その経験から自分に何が残ったのかを、美しく可視化するライフジャーナル。
Expo / React Native + Supabase。

> Automated Reflection × Gain Visualization。
> AI日記ではありません。ユーザーが深い内省をする必要はありません。

体験の目標は 3 つだけです。

- **入力は 10 秒**（アプリを開く → 1 タップ → 一文 → ✓）
- **結果は一瞬で理解できる**（`TODAY'S GAIN` は最大 1 行）
- **時間が経つほど価値が増える**（過去の出来事から、今の自分に残ったものが見える）

---

## 画面

| タブ | 役割 |
| --- | --- |
| **MAP** | ME を中心に、これまでの経験から自分の中に育ったものを見る |
| **LOG** | 残す（ホーム。開いた瞬間から入力できる） |
| **LIST** | 読む（年 → 月 → 日付と一行のアーカイブ） |

```
app/(tabs)/log.tsx     SEPTEMBER 2026 → 今日、何があった？ → 3チップ → 入力欄 → ✓ → TODAY'S GAIN
app/(tabs)/map.tsx     月ストリップ + ME 中心の Radial Gain Map
app/(tabs)/list.tsx    2026 → SEPTEMBER — OUT INTO THE WORLD → 09/03 …
app/log/[id].tsx       全文 + この記録から残ったもの
app/month/[key].tsx    THIS MONTH IS COMPLETE. / TITLE / 3 GAINS / ONE CHANGE
```

---

## Gain とは

> その経験を通して、**未来の自分へ持っていけるものが増えた**こと。

成果だけが Gain ではありません。失敗や停滞からでも、新しい仮説が生まれた／
自分に合わないものが分かった／やり方を変えた／経験した／人とつながった、の
であれば Gain になり得ます。ただし **すべての失敗を無理やり Gain に変換しません**。
根拠がなければ `gain_status = unresolved` のまま残ります。

### 6 分類（AI が内部で付け、ユーザーには分類作業をさせない）

| type | 意味 | 例 |
| --- | --- | --- |
| `capability` | 身についた力 | プレゼンする / ファシリテーション |
| `insight` | 分かったこと | 情報量が多すぎると伝わりにくい |
| `strategy` | 新しく得たやり方 | 最初に結論を言う / まず3人に見せる |
| `direction` | 分かってきた方向 | 自分で企画できる環境に惹かれる |
| `connection` | 増えたつながり | 一緒に制作できる人とつながった |
| `evidence` | 形として残ったもの | 初めてイベントを開催した / 応募した |

### 成熟度（AI が簡単に「身につきました」と断定しないための仕組み）

`signal → attempt → emerging → evidenced → established`

**成熟度はモデルが決めません。** 実際に保存されている根拠の数・期間・
「以前との違い」の有無から上限を計算し、モデルの提案はその上限を超えられません
（`src/ai/gainRules.ts` の `maturityCeiling` / `clampMaturity`）。
一度プレゼンしただけで `established` にはなりません。

### Trial & Error は別レイヤー

各記録は `journey_role`（`attempt` / `setback` / `breakthrough` / `adaptation` /
`learning` / `turning_point` / `neutral`）を持ちます。**Setback は Setback のまま
残ります。** 後日の記録によって関係が生まれたときだけ `journey_links` で接続され、
Gain をタップすると `HOW IT FORMED` としてその紆余曲折が表示されます。

---

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. Supabase プロジェクト

[supabase.com](https://supabase.com) でプロジェクトを作り、`supabase/migrations/`
を番号順に実行します。

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

RLS は全テーブルで有効です。`gains` / `gain_evidence` / `journey_links` /
`month_reviews` は **読み取りのみ**クライアントに開かれており、書き込みは
service role（Edge Function）だけが行います。例外は `gains` の `verdict` と
`label` で、これは「少し違う」を反映するためユーザー自身が更新できます。

### 3. 環境変数

```bash
cp .env.example .env
```

`.env` に入れてよいのは **公開値だけ** です。LLM の API キーはここに置きません。

### 4. Edge Functions（AI）

```bash
cp supabase/functions/.env.example supabase/functions/.env   # 編集する
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy analyze-log
npx supabase functions deploy month-review
```

`LLM_PROVIDER` は `anthropic` / `openai` / `mock`。`mock` は API キー不要で、
**常に「何も読み取れなかった」を返します**。Gain を捏造するモックは、壊れた
パイプラインを動いているように見せてしまうためです。

### 5. 起動

```bash
npm run ios
npm run android
npm run web
```

Supabase 未設定なら自動的に端末内ストア（`LocalRepository`）で動きます。
その場合の解析はモデルなしの控えめな経路（`src/ai/localAnalysis.ts`）で、
繰り返し現れた語だけを `direction` として、実際にやったことだけを `evidence`
として残します。

### 6. デモデータ（任意）

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
SEED_EMAIL=you@example.com SEED_PASSWORD=... npm run seed
```

Gain は seed しません。`analyze-log` が実際に読み取ります。

---

## 開発コマンド

```bash
npm run typecheck        # tsc --noEmit（strict）
npm test                 # jest
npm run sync:gain-rules  # src/ai/gainRules.ts を Edge Function 側へ複製
npm run web
```

`gainRules.ts` は **2 か所に同じ内容で存在します**（Deno から `src/` を import
できないため）。`__tests__/gainRules.parity.test.ts` が差分を検出します。

---

## AI の扱い

- クライアントは **LLM を直接呼びません**。すべて Edge Function 経由です。
- API キーは Edge Function の secret にのみ存在します。
- **モデルが決めること**：何が起きたか / どの記録と関係するか / 何が残ったか。
- **コードが決めること**：それをどこまで言ってよいか（成熟度の上限、
  1 件だけでは `confirmed` にしない、渡していない記録への link は破棄する）。
- 応答は strict JSON。壊れた応答は「何も読み取れなかった」に縮退します
  （`parseLogAnalysis`）。
- **保存と解析は独立しています。** 解析が失敗しても記録は消えません。

### AI が書かないこと

褒めない／人格や適性を断定しない／本文にない事実を足さない／失敗を勝手に
成長に変えない／数値スコアを文中に書かない。禁止表現は `src/constants/copy.ts`
の `FORBIDDEN_PHRASES` に集約し、`copy.test.ts` が検査します。

### Gain consolidation

似た Gain を無限に増やさないため、同一 type 内で表層類似度（文字 bigram の
Dice 係数）が閾値を超えた組だけを**候補**にし、統合するかどうかは LLM の
意味確認に委ねます。「人前で話す」と「人前で緊張する」は表層が近く意味が違う
ため、**類似度だけでは統合しません**。ユーザーが「少し違う」で直した Gain は
統合の対象外です。

---

## v1.5 からの移行

`supabase/migrations/20260905000000_gain_model.sql` が自動で行います。
本文は変更されません。旧カテゴリーは **slug** で対応付けるため、ユーザーが
改名したカテゴリーも正しく移ります。

| 旧カテゴリー（slug） | → 新 inputCategory |
| --- | --- |
| できたこと（`tsumiage`）/ 学び（`kyokun`） | `progress`（進んだ） |
| モヤモヤ（`hikkakari`） | `friction`（ひっかかった） |
| 楽しかったこと（`tokimeki`）/ 人間関係（`kankeisei`）/ その他（`sonota`） | `moved`（心が動いた） |
| ユーザーが作ったカテゴリー | `moved` |

`categories` / `category_insights` / `keyword_reviews` / `monthly_intentions` /
`period_titles` は **行を残したまま参照をやめます**（deprecated）。
`logs.category_id` と `logs.type` は履歴として残り、NOT NULL 制約だけ外れます。

---

## テスト

```bash
npm test
```

| 観点 | ファイル |
| --- | --- |
| 根拠より先に Gain が育たない / 1 件で confirmed にしない | `gainRules.test.ts` |
| 渡していない記録への link を捨てる / 壊れた JSON の縮退 | `gainRules.test.ts` |
| 2 か所の gainRules が一致している | `gainRules.parity.test.ts` |
| 10 秒の入力経路 / 内省を促す質問が無いこと | `composer.test.tsx` |
| TODAY'S GAIN が褒めない・1 つだけ・短い | `todaysGain.test.ts` |
| MAP が ME 中心 / 存在する type だけ / 記録はタップ後 / 月ごとに固定 | `gainGraph.test.ts` |
| モデル無しの経路が失敗を学びに変えない | `localAnalysis.test.ts` |
| 月末の 3 GAINS と、比較根拠が無いときの ONE CHANGE | `monthReview.test.ts` |
| オフラインでも本文を失わない | `offline.queue.test.ts` |
| 禁止表現・禁止機能がコードに存在しない | `copy.test.ts` |
| Google ログイン | `oauth.test.ts` |

---

## MVP に入れていないもの

Chat with AI / 習慣管理 / streak / point / badge / like / follower /
social feed / 性格診断 / 目標達成率 / 円グラフ / レーダーチャート /
詳細な感情トラッカー / 手動タグ / 複雑な検索 / 複雑なオンボーディング。

**最重要指標は「何日連続で書いたか」ではありません。**
過去の自分が残した出来事から、今の自分が持っているものを発見した瞬間です。
