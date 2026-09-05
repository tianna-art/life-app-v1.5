# crincran

**日々の小さな記録だけを残せば、AIが過去の点と点をつなぎ、
自分がどう変化し、何を獲得してきたのかを Evidence とともに見せる。**

Expo / React Native + Supabase。

> Future gives direction. Daily life gives evidence.
> AI connects the changes. The past shows the gain.

忙しくて人生を棚卸しする余裕がない人のためのジャーナルです。
毎日一文を書く必要はありません。**2タップで記録が残ります。**

---

## crincran が対抗しているもの

「成功まで最短距離で進むことだけが価値」という考え方です。

試した / 迷った / モヤモヤした / 失敗した / 方法を変えた / 人と出会った /
楽しかった / 方向を変えた / 自分で決めた / 新しく分かった —
これらの紆余曲折も、時間を通して見ることで Progression や Gain になり得ます。

ただし **「苦しんだから成長した」とは断定しません。**
重要なのは失敗そのものではなく、その後に何を試したか・何を変えたか・
何が分かったか・何を選んだか という Evidence です。

---

## 4つの層

```
1. GAP / DIRECTION   どんな自分でありたいか
2. DAILY EVIDENCE    日々実際に起きたこと
3. PROGRESSION       過去から現在へ、何がどう変化したか
4. GAIN              その変化を通して現在の自分に何が残ったか
```

**Gap は現在の自分を採点するために使いません。**
「その人にとって何を Progress として観測するか」を AI が判断する Lens です。

この原則を守るために、`year_directions` テーブルには
**目標との距離を持てる列を作っていません**。作った瞬間に画面に出したくなります。
`__tests__/copy.test.ts` がその不在を検証しています。

---

## 入力（§8-§14）

```
今日の記録

どこから残す？
[自分の行動] [人との関わり] [つぶやき]

どんな瞬間だった？
[楽しかった][やってみた][初めて][モヤモヤ][変えてみた][発見した][自分で決めた]

前と何を変えた？          ← AIが生成する一言質問
[ 答えなくても保存できます ]

                                    ✓
```

**自由記述なしで保存できます。** Level 1 と Level 2 がそのまま Evidence です。
目標は 5〜15秒。

### なぜ Level 1 と Level 2 を分けるのか（§15）

Level 1 は「何についての Evidence か」、Level 2 は「その Evidence がどんな性質か」。

```
人との関わり + 楽しかった + 初めて
  → 新しい人間関係の中で生まれた Positive Discovery

自分の行動 + モヤモヤ + 変えてみた
  → 行動 → friction → adaptation
```

同じ Level 2 でも、Level 1 によって Progression 上の意味が変わります。

### Level 3 の質問（§11-§13）

目的は深く考えさせることではありません。
**AI が Progression を測るために足りない Evidence を1つだけ受け取ること**です。

| ❌ | ⭕ |
| --- | --- |
| この経験から何を学びましたか？ | 前と何を変えてみた？ |
| なぜそう感じたのでしょう？ | 誰に見せてみた？ |
| どんな意味がありましたか？ | 何が一番引っかかった？ |

質問は `src/constants/questions.ts` の表が**即座に**答え、AI はそれを
上回れるときだけ差し替えます。禁止語を含む質問はコードが弾きます
（`__tests__/questions.test.ts`）。ネットワークは任意であって、速いわけではありません。

---

## Progression の10パターン（§17, §18）

```
P1  NAMING     曖昧 → 具体的に言える
P2  FIRST-ACT  考える → 試す
P3  REPEAT     一度 → 繰り返す
P4  SOLO       助けが必要 → 自分でもできる
P5  PIVOT      うまくいかない → やり方を変える → 再試行
P6  EXPOSE     自分の内側 → 身近な人 → 外部
P7  OWN-CALL   他人基準 → 自分で決める
P8  TRANSFER   ある場面の方法 → 別の場面でも使う
P9  REFRAME    問題Aだと思っていた → 別の捉え方
P10 BOUNDARY   受け入れる → 条件をつける / 断る
```

**形が記録に現れていなければ、そのパターンとは呼びません。**
`patternSatisfied` が時間順に検査します。PIVOT は「モヤモヤ → 変えてみた →
やってみた」の3点が必要で、**同じ日に3つのタグが付いただけでは通りません**。
1つの瞬間は変化ではないからです。

形が示せなければ pattern を落とします。近いパターンに読み替えません。
それは同じ過大主張に別の名前をつけるだけです。

### 成熟度

| maturity | 条件 | 言い方 |
| --- | --- | --- |
| `signal` | 2件以上 | 「〜という記録が、いくつか現れています」 |
| `emerging` | 3件以上 または 2か月以上 | 「最近、〜が増えています」 |
| `evidenced` | before/after が具体ログで示せる | 「以前の記録とくらべて、〜が変わってきています」 |
| `established` | 4件・2か月・45日・3役割以上 | 「この期間を通して、〜が繰り返し確認されています」 |

モデルが `established` と答えても、根拠が足りなければコードが落とします。
**1件では Progression を作りません**（§31）。

---

## Goal 外も捨てない（§19）

Year Direction は検出優先度を上げるだけで、**フィルタではありません**。

当初「専門性を高めたい」だった人の記録に、デザイン・企画・ワークショップで
「楽しかった」が繰り返し現れたら、それは `goal_external = true` として残ります。

> 当初のテーマとは別に、『人と体験をつくる』記録が繰り返し現れています。

当初のテーマと違う方向が育つことは、失敗ではなく発見です。

---

## Gain の7分類（§20）

`clarity` `capability` `method` `choice` `evidence` `connection` `recovery`

**Confidence は Gain Category ではありません。**
Confidence は、これらの Evidence を見た結果、本人に生まれるものです。

Gain は1ログから直接生成しません。

```
Log → Evidence → Cross-time Progression → Gain
```

---

## 画面

| タブ | 役割 |
| --- | --- |
| **MAP** | ME を中心に、自分がどう変化してきたかを見る |
| **LOG** | 残す（ホーム） |
| **LIST** | 読む（年 → 月 → 日付） |

```
app/onboarding/direction.tsx  今年どんな方向を育てたい？
app/onboarding/desired.tsx    どんな自分になれたら嬉しい？
app/onboarding/lens.tsx       今年は、こんな変化を見ていきます
app/onboarding/theme.tsx      今年のテーマ（3候補 / 自分で書く / 決めない）
app/month/theme.tsx           CONTINUE / DEEPEN / FOLLOW THE SPARK
app/(tabs)/log.tsx            Level 1 → Level 2 → Level 3 → ✓
app/(tabs)/map.tsx            ME 中心の Radial Progression Map
app/progression/[id].tsx      TITLE / PATH / WHAT YOU'VE GAINED
app/month/[key].tsx           YOU STARTED WITH / WHAT ACTUALLY HAPPENED
                              / WHAT CHANGED / WHAT YOU GAINED
app/year/[year].tsx           YOU THOUGHT... / IT ACTUALLY BECAME
```

### 月末・年末（§7, §25, §26）

月初テーマと実際がズレていても、**未達として扱いません**。

| ❌ | ⭕ |
| --- | --- |
| 予定通りではありませんでしたが、必ず意味がありました | 当初の方向とは違いましたが、今月は『○○』の記録が繰り返し現れました |
| | 今月はまだ、この変化の意味を決めなくてよさそうです |

繰り返し現れたものが何もなければ、月は未決定のままにします。

---

## AI パイプライン

```
STAGE 0  generate-question  保存前・低レイテンシ。表が先に答える
STAGE 1  analyze-log        1ログを構造化。Level 1/2 は上書きしない
STAGE 2  analyze-log        retrieval で絞った関連ログと時間軸で比較
                            → P1-P10 を検出 → コードが形を検査
```

**retrieval は「最近のN件」ではありません。** v4 は本文のない記録が普通なので、
topic の重なりだけでは足りません。**タップされたタグと入口**が重みの大半を持ちます。
それが常に存在する Evidence だからです。

---

## セットアップ

### 1. Supabase

マイグレーションは2つに分かれています。**この順で**適用してください。

```
20260907000000_lens_enums.sql   enum への値追加のみ
20260907000100_lens_model.sql   それ以外すべて
```

分けてあるのは、`ALTER TYPE ... ADD VALUE` で追加した値を同じ
トランザクション内で使えないためです。

**ブラウザだけで適用できます:**
GitHub の **Actions → Run migration → Run workflow** で、ファイル名を指定し
`confirm` に `APPLY` と入力します。Supabase Management API を使うので、
Edge Function 用に登録済みの `SUPABASE_ACCESS_TOKEN` だけで足ります。

CLI を使う場合:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 2. Edge Function

**Actions → Deploy Edge Functions → Run workflow**。
`supabase/functions/` 配下の全関数を自動で見つけてデプロイします。

必要なシークレット3つ:
`SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` / `ANTHROPIC_API_KEY`

CLI を使う場合:

```bash
cp supabase/functions/.env.example supabase/functions/.env   # 編集する
npx supabase secrets set --env-file supabase/functions/.env
for d in supabase/functions/*/; do
  n=$(basename "$d"); [ "$n" = "_shared" ] && continue
  npx supabase functions deploy "$n"
done
```

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

`progressionRules.ts` は **2か所に同じ内容で存在します**（Deno から `src/` を
import できないため）。`__tests__/progressionRules.parity.test.ts` が差分を
検出します。片方だけ直すと、オフライン経路とオンライン経路が同じ根拠に対して
違う強さの主張をしてしまいます。

### テストが守っているもの

| 何を | どこで |
| --- | --- |
| PIVOT が3点揃わないと成立しない | `patternRules.test.ts` |
| 同じ日に3タグでは PIVOT にならない | `patternRules.test.ts` |
| 形が示せないパターンは落とす（読み替えない） | `patternRules.test.ts` |
| 質問が「学び」「意味」「なぜ」を含まない | `questions.test.ts` |
| 同じタグでも入口が違えば質問が変わる | `questions.test.ts` |
| 入口とタグだけで保存できる | `composer.test.tsx` |
| 質問が出るのは聞くことができてから | `composer.test.tsx` |
| 本文なしでも Mirror が成立する | `mirror.test.ts` |
| モヤモヤを学びに変換しない | `mirror.test.ts` |
| 1件では Progression を作らない | `localAnalysis.test.ts` |
| 月末に3件を無理に作らない / 未決定を許す | `monthReview.test.ts` |
| Lens テーブルに達成度の列がない | `copy.test.ts` |
| streak / badge / 達成率がソースに存在しない | `copy.test.ts` |
| 2か所の progressionRules が一致している | `progressionRules.parity.test.ts` |

---

## v3 からの移行

**データは消しません。**

| v3 | v4 |
| --- | --- |
| TYPE 2択（出来事 / つぶやき） | Level 1 3択（自分の行動 / 人との関わり / つぶやき） |
| SIGNAL ＋ / ± / − | moment tags 7種・複数選択 |
| 本文【必須】 | 本文は任意（Level 3 の回答） |
| Gain に分類なし | Gain 7分類 |
| evidence role `setback` | `friction` |

`subjective_signal` と `clarifications` は行を残したまま参照をやめます。
v3 の記録は `positive → 楽しかった` / `negative → モヤモヤ` で
タグに橋渡しされます。

---

## MVP に入れないもの（§29）

streak / point / score / badge / ranking / social feed / likes / follower /
mood graph / emotion chart / 目標達成率 / habit tracker / AIセラピー /
性格診断 / 長いAIチャット / 毎日の長文reflection / 手動タグ / 複雑な分析dashboard

---

## 判断に迷ったら

> crincran は「最短距離でどこまで来たか」ではなく、
> 「曲がりながら、何が自分の中に残ってきたか」を見せる。
