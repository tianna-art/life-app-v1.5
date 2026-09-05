# crincran — Lens rewrite (v4)

Future gives direction. Daily life gives evidence. AI connects the changes.
The past shows the gain.

## 0. 何が変わるのか

v3 は「点と点をつなぐ」ところまでは作った。足りないのは二つ。

一つ目は Lens。何を Progress として観測するかが、誰にとっても同じだった。
同じ「人に見せた」でも、その人が何を育てたいかによって意味が変わる。
Year Direction と Desired Self は、その観測の向きを決めるために置く。
達成率を出すためではない。

二つ目は入力の重さ。v3 は本文を必須にしていた。忙しくて棚卸しする余裕が
ない人に、毎日一文を書かせるのは重い。v4 は本文を任意にし、
Level 1 と Level 2 のタップだけで証拠が残るようにする。

## 1. 現状（v3）

    画面   MAP | LOG | LIST + log/[id] + progression/[id] + month/[key]
    入力   TYPE 2択 + 本文【必須】+ SIGNAL（＋/±/−）
    モデル logs / log_ai_analysis / progressions / progression_evidence
           / gains / clarifications / month_reviews
    AI     analyze-entry（STAGE 1 → retrieval → STAGE 2）
           month-progressions
    規律   progressionRules.ts が maturity 上限をコードで計算

## 2. 新仕様と衝突する旧仕様

1. SIGNAL（＋/±/−）
   moment tags が同じ役割を持つ。両方残すと入力が5ステップになり
   §14 の「5〜15秒」に反する。「楽しかった」「モヤモヤ」の方が
   具体的な証拠になる。廃止する。

2. 本文必須
   §14 が「自由記述なしでも保存可能」と定める。logs.body の NOT NULL と
   length > 0 制約を両方外す。

3. clarifications テーブル
   v3 の「任意の1タップ質問」は v4 の Level 3 質問に統合される。
   質問が2種類あると、ユーザーには区別がつかない。参照をやめる。

4. gains.confidence を分類軸にすること
   §20 が明示的に禁止する。列は残すが、内部順序にのみ使う。

## 3. 最も壊れやすい設計判断

§19「Gap は採点軸ではなく検出優先度」。

Year Direction を持つと、実装は自然と「達成率」に寄る。防ぐために、
Lens は progressions に一切書かない。STAGE 2 のプロンプトに検出優先度と
してのみ渡す。DB に「目標との一致度」を持たせない。持たせた瞬間に、
それを画面に出したくなる。

同じ理由で、Goal 外の Progression を削除しない。特に「楽しかった」が
繰り返し現れたものは GOAL-EXTERNAL DISCOVERY として別枠で残す（§19）。
当初のテーマと違う方向が育つことは、失敗ではなく発見である。

## 4. Information Architecture

    年始（初回のみ）
      onboarding/direction   今年どんな方向を育てたい？（複数選択）
      onboarding/desired     どんな自分になれたら嬉しい？（カード）
      onboarding/lens        AI:「今年はこんな変化を見ていきます」
      onboarding/theme       Year Theme 3候補

    月初
      month/theme            Continue / Deepen / Follow the Spark

    毎日（HOME）
      LEVEL 1  自分の行動 / 人との関わり / つぶやき
      LEVEL 2  楽しかった やってみた 初めて モヤモヤ
               変えてみた 発見した 自分で決めた（複数可）
      LEVEL 3  AI の一言質問 + 任意入力
      ✓

    月末   YOU STARTED WITH / WHAT ACTUALLY HAPPENED / WHAT CHANGED
           / WHAT YOU GAINED / FINAL TITLE 3候補
    年末   YOU THOUGHT THIS YEAR WOULD BE ABOUT / IT ACTUALLY BECAME

## 5. User Flow

    開く → LEVEL 1 → LEVEL 2 を1〜3個 → (質問が出る) → ✓

Level 3 は保存を待たせない。タグを選んだ時点で質問が出て、答えなくても
✓ で保存できる。目標 5〜15秒。

## 6. DB migration

supabase/migrations/20260907000000_lens_model.sql

    Level 1   log_type に 'self_action' 'relationship' を追加
              'event' → 'self_action' に移送。'thought' はそのまま
    Level 2   moment_tag enum 7種。logs.moment_tags を配列で追加
    Level 3   logs.ai_question / logs.optional_answer
              logs.body を nullable に。length 制約を外す
    GAP       year_directions / month_themes
    Pattern   progression_pattern enum（P1-P10）。progressions.pattern
    Role      progression_evidence_role に 'friction' を追加
    Gain      gain_category enum 7種。gains.category
    Month     month_reviews に initial_theme / what_actually_happened
              / gains / title_candidates

データは消さない。subjective_signal と clarifications は行を残したまま
参照をやめる。

## 7. AI pipeline

    STAGE 0  質問生成（保存前・低レイテンシ）
      入力 Level1 + Level2 + Year Direction + Lens + Month Theme
      出力 一言質問1つ（10〜40字）
      失敗 テーブル引きの既定質問へフォールバック。保存は止めない

    STAGE 1  単一ログの構造化（保存後）
      Level 1 / 2 は User Evidence。AI はこれを上書きしない
      本文がない場合、themes はタグと質問と回答から作る

    STAGE 2  横断検出
      retrieval に moment_tag の重なりを加点
      P1-P10 を検出。パターンごとに必要条件を課す
      Lens 関連を上位に。ただし Goal 外も捨てない

## 8. Progression detection

    P1 NAMING     discovered が2回以上、後ほど具体的
    P2 FIRST-ACT  thought → tried|first_time（同テーマ）
    P3 REPEAT     同テーマの tried が3回以上
    P4 SOLO       relationship+助け → self_action で同テーマ
    P5 PIVOT      friction → changed → tried|first_time  ← 3点必須（§18）
    P6 EXPOSE     self_action → relationship → 対象が広がる
    P7 OWN-CALL   self_decided が2回以上
    P8 TRANSFER   同じ method が別テーマで再出現
    P9 REFRAME    friction → discovered で捉え方が変わる
    P10 BOUNDARY  friction → self_decided

maturity 上限は v3 の maturityCeiling を引き継ぐ。根拠から計算し、
モデルの申告はそこで頭打ちにする。

## 9. Level 3 question generation

    1. Lens 対応表（Level1 × Level2 × Lens）を引く
       決定的・即座・オフラインでも動く
    2. AI が文脈で1つに絞る／言い換える
    3. 失敗・遅延したら 1 の結果をそのまま出す

質問は必ず事実を聞く。§12 の禁止例（「何を学びましたか」「なぜそう
感じた」「どんな意味が」）はコード側の禁止語リストで弾き、テストで
検証する。

## 10. 実装順（§33）

    Phase 2  Year Direction / Desired Self / Lens / Year Theme
    Phase 3  Month Theme（Continue / Deepen / Follow the Spark）
    Phase 4  Daily Home（Level 1 / 2 / 3）
    Phase 5  Single Log Evidence Extraction
    Phase 6  Cross-time retrieval と Pattern detection
    Phase 7  Progression の永続化 / merge / maturity
    Phase 8  Gain mapping
    Phase 9  ME 中心の Progression Map
    Phase 10 Month End / Year End
    Phase 11 仕上げ

## 11. 判断に迷ったら

crincran は「最短距離でどこまで来たか」ではなく、
「曲がりながら、何が自分の中に残ってきたか」を見せる。
