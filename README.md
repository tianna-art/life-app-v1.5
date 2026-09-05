# crincran

**出来事とつぶやきを残すだけで、AI が点と点をつなぎ、自分がどう変わってきたのかを見せてくれる。**

Expo / React Native + Supabase。

> User creates the dots. AI connects the dots. crincran reveals the progression.
>
> AI日記ではありません。ユーザーが深い内省をする必要はありません。

体験の目標は 3 つだけです。

- **入力は 10 秒**（開く → タイプ → 一文 → ＋ / ± / − → ✓）
- **意味づけは AI**（ユーザーは分類も内省もしない）
- **時間が経つほど価値が増える**（30 日後、変化の軌跡が見える）

---

## 最重要原則

**ユーザーには人生を分類させない。**

これは成長か。成功か。失敗か。何を学んだか。— それを考えるのはユーザーの
仕事ではありません。ユーザーは出来事を残すだけです。

---

## Progression とは

> 複数の出来事を時間順につないだときに見えてくる、
> 行動・考え方・能力・興味・方向性・関係性などの**変化の軌跡**。

**Progression = Improvement ではありません。** 前進・後退・停滞・試行錯誤・
興味の変化・方向転換・再挑戦は、すべて等しく変化として扱います。

```
4月  「人に企画を見せるのが怖い」
5月  「初めて友達に見せた」
6月  「情報が多くて伝わらなかった」
7月  「結論から説明してみた」
8月  「初対面の人にも説明した」
```

これを AI は次のように整理します。

```
TITLE   人に伝える
FROM    人に見せることへの抵抗
TO      伝え方を試しながら外に出す
```

### 6 分類（内部専用。画面には出ない）

`capability` `strategy` `interest` `direction` `relationship` `perspective`

MAP のノードに `CAPABILITY` のような分類名は**絶対に出しません**。
表示されるのは、ユーザー自身の記録から生まれた「人に伝える」「働き方」の
ような自然な言葉だけです。

### Gain は Progression の結果

Progression が「どう変わってきたか」なら、Gain は「その過程から**現在の自分に
残っているもの**」です。Gain のカテゴリーをユーザーに入力させることはありません。

---

## 画面

| タブ | 役割 |
| --- | --- |
| **MAP** | ME を中心に、自分がどう変化してきたかを見る |
| **LOG** | 残す（ホーム。開いた瞬間から入力できる） |
| **LIST** | 読む（年 → 月 → 日付と一行のアーカイブ） |

```
app/(tabs)/log.tsx      SEPTEMBER 2026 → 今日、何があった？
                        → [出来事][つぶやき] → 入力欄 → ＋ ± − → ✓
app/(tabs)/map.tsx      月ストリップ + ME 中心の Radial Progression Map
app/(tabs)/list.tsx     2026 → SEPTEMBER → 09/03 …
app/log/[id].tsx        全文 + TYPE + ＋/±/− + このログが立っている変化
app/progression/[id].tsx  TITLE / HOW IT CHANGED / WHAT REMAINS
app/month/[key].tsx     THIS MONTH IS COMPLETE. / TITLE / 3 PROGRESSIONS
                        / WHAT YOU'RE CARRYING FORWARD
```

---

## 入力（§3）

原則 3 つだけです。

| | |
| --- | --- |
| **TYPE** | 出来事 / つぶやき |
| **BODY** | 自由記述 |
| **SIGNAL** | ＋ / ± / − |

`＋ ± −` は本人にしか分からない一次情報として、本文とは**別に**保持します。
画面には記号だけを出し、意味の説明は出しません（読み上げラベルにだけ入れます）。
「成功」「失敗」という語は使いません。

**アプリが毎回聞いてはいけないこと**（§5）: 「なぜそう感じましたか？」
「そこから何を学びましたか？」「次はどうしますか？」「あなたの強みは？」

---

## MAP の階層（§18）

```
LEVEL 0   ME
LEVEL 1   Progression Theme    「人に伝える」「つくる」「働き方」
LEVEL 2   Progression Step     怖い → 見せる → 伝わらない → 変えた → 初対面
LEVEL 3   Evidence (log)       タップしたときだけ
```

均等な円グラフのようには配置しません。月ごとにシードされた乱数で、MEから
それぞれ異なる方向・距離へ有機的に枝が伸びます。棒グラフ・円グラフ・スコア・
`%`・レーダーチャートは**使いません**。

月は横スワイプで切り替えます。Progression は月をまたいで存在しますが、月表示
では「その月時点でどこまで来ていたか」を出すので、6月→7月→8月と移動すると
同じ Progression が少しずつ育つのが見えます。

---

## 成熟度（§12）

AI は簡単に「あなたは変わった」と断定しません。文章は成熟度に紐づきます。

| maturity | 条件 | 言い方 |
| --- | --- | --- |
| `signal` | 2 件以上の弱い兆候 | 「〜という兆しがあります」 |
| `emerging` | 3 件以上、または 2 か月以上 | 「最近、〜が増えています」 |
| `evidenced` | Before / After が具体ログで示せる | 「以前とくらべて、〜が変わってきています」 |
| `established` | 4 件以上・2 か月以上・45 日以上・3 役割以上 | 「この期間を通して、〜が繰り返し確認されています」 |

**1 件では Progression を作りません**（§31）。初日は点が 1 つ置かれるだけです。

上限は**コードで**計算されます（`src/ai/progressionRules.ts` の
`maturityCeiling` / `clampMaturity`）。モデルが `established` と答えても、
根拠が足りなければ `signal` に落とされます。プロンプトでは上げられません。

---

## AI パイプライン（§29）

```
STAGE 1  analyze-entry  1 ログを構造化（比較しない）
         event_summary / topics / actors / environment / action / outcome
         / reaction / hypothesis / future_intention / journey_role
         / signals(6分類) / confidence

STAGE 2  同じ関数内  retrieval で関連ログを取得 → 時間軸で比較
         REPEAT / CHANGE / BUILD / EXPERIMENT / ADAPTATION
         / CONTRAST / REFRAME / DIRECTION
         → create | update | unchanged
```

**毎回全ログを LLM に送りません。** `_shared/retrieval.ts` が topic と signal
の重なりで最大 12 件に絞ります。「最近の N 件」ではなく重なりで選ぶのは、
4 月と 8 月にまたがる軌跡こそ recency window では見つからないからです。

`month-progressions` が月末の読み取りを担当します。

### AI がやってはいけないこと（§13）

「あなたは創造的な人です」「本当のあなたは〜」「あなたの天職は〜」
「この失敗には意味がありました」「あなたは成長しました」

代わりに Evidence を見せます。

> 4月には『人に見せるのが怖い』という記録がありました。
> 8月には初対面の人へ説明した記録があります。

---

## 条件付き質問（§14）

毎回は聞きません。Progression の判定に重要で、AI では推測できない情報がある
場合だけ、任意の 1 タップ質問を 1 つだけ出します。スキップも回答として記録
するので、同じ質問は二度出ません。

---

## データモデル

```
logs                    type / body / subjective_signal / occurred_at
log_ai_analysis         STAGE 1 の構造化結果 + topics + signals
progressions            type / title / from_state / current_state / summary
                        / maturity / verdict / user_edited / merged_into_id
progression_evidence    progression_id / log_id / role / occurred_at
gains                   progression_id / label / description
clarifications          log_id / question / options / answer
month_reviews           title / subtitle / progressions / carrying_forward
```

RLS は全テーブルで有効です。`progressions` / `progression_evidence` / `gains`
への書き込みは service role（Edge Function）だけが行います。例外は
`progressions.verdict` と `clarifications.answer` — これはユーザー本人のものです。

---

## セットアップ

### 1. Supabase

[supabase.com](https://supabase.com) でプロジェクトを作り、`supabase/migrations/`
を順に適用します。

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

CLI を使わない場合は、ダッシュボードの **SQL Editor** に各マイグレーションを
順に貼り付けて実行しても同じです。すべて再実行可能です。

### 2. Edge Function

```bash
cp supabase/functions/.env.example supabase/functions/.env   # 編集する
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy analyze-entry
npx supabase functions deploy month-progressions
```

ターミナルを使わない場合は、GitHub の **Actions → Deploy Edge Functions →
Run workflow** から同じことができます。必要なシークレットは
`SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` / `ANTHROPIC_API_KEY` の 3 つです。

`LLM_PROVIDER=mock` は **常に「何も読み取れなかった」を返します**。
Progression を捏造するモックは、壊れたパイプラインを隠してしまうためです。

### 3. アプリ

```bash
cp .env.example .env   # EXPO_PUBLIC_SUPABASE_URL / ANON_KEY
npm install
npm start
```

---

## 開発

```bash
npm run typecheck
npm test
npm run sync:progression-rules  # src/ai/progressionRules.ts を Edge Function 側へ複製
npm run seed                    # 実際に軌跡になるサンプルを投入
```

`progressionRules.ts` は **2 か所に同じ内容で存在します**（Deno から `src/` を
import できないため）。`__tests__/progressionRules.parity.test.ts` が差分を
検出します。片方だけ直すと、オフライン経路とオンライン経路が同じ根拠に対して
違う強さの主張をしてしまうためです。

seed は Progression を作りません。`analyze-entry` が実際に読み取ります。

### テストが守っているもの

| 何を | どこで |
| --- | --- |
| 1 件では Progression を作らない | `progressionRules.test.ts` |
| 根拠がなければ maturity が上がらない | `progressionRules.test.ts` |
| 渡していないログを evidence にしない | `progressionRules.test.ts` |
| 2 か所の progressionRules が一致している | `progressionRules.parity.test.ts` |
| MAP の Level 1 に分類名が出ない | `progressionGraph.test.ts` |
| 開くまで step を描かない | `progressionGraph.test.ts` |
| 保存直後の 1 行が褒めない・助言しない | `mirror.test.ts` |
| 月末に 3 件を無理に作らない | `monthReview.test.ts` |
| 入力が TYPE + 本文 + SIGNAL だけで完了する | `composer.test.tsx` |
| 禁止表現がコピーに現れない | `copy.test.ts` |
| オフラインで TYPE と SIGNAL が失われない | `offline.queue.test.ts` |

---

## v2（Gain モデル）からの移行

`supabase/migrations/20260906000000_progression_model.sql` が行います。
**データは消しません。**

| v2 | v3 |
| --- | --- |
| 3 チップ（進んだ / ひっかかった / 心が動いた） | TYPE（出来事 / つぶやき）+ SIGNAL（＋ / ± / −） |
| Gain が最上位 | Progression が最上位。Gain はその結果 |
| MAP Level 1 = GainType | MAP Level 1 = Progression Theme（本人の言葉） |
| 3 GAINS | 3 PROGRESSIONS + WHAT YOU'RE CARRYING FORWARD |

`logs.type` は v1.5 の列がそのまま残っていたので復元します。`input_category`
は行を残したまま参照をやめます。v2 の `gains` は `progression_id = null` の
まま残り、読まれなくなります。

---

## MVP に入れないもの（§34）

AI チャット / habit tracker / streak / badge / point / ranking / social feed /
likes / followers / 性格診断 / 目標達成率 / 手動タグ付け / 複雑なカテゴリー /
詳細な感情記録 / 大量の質問 / 長い AI レポート / 円グラフ / 棒グラフ /
レーダーチャート

---

## 判断に迷ったら

> 出来事とつぶやきを残すだけで、AI が点と点をつなぎ、
> 自分がどう変わってきたのかを見せてくれる。
