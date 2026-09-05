# crincran — Progression rewrite

User creates the dots. AI connects the dots. crincran reveals the progression.

## 0. 何が変わるのか

v2 は Gain を最上位に置いた。「その日から何が残ったか」を読み、それを ME の
周りに並べた。残ったものは見えるが、**どこからどこへ来たのかが見えない**。

v3 の最上位は Progression — 複数の出来事を時間順につないだときに見えてくる
変化の軌跡。Gain はその結果として、必要なときだけ現れる。

Progression = Improvement ではない。前進・後退・停滞・試行錯誤・興味の変化・
方向転換・再挑戦をすべて含む。

## 1. 現状（v2）の要約

画面      MAP | LOG | LIST。HOME = LOG で常時入力欄（§4 と既に一致）
入力      3チップ（進んだ / ひっかかった / 心が動いた）+ 本文
データ    Gain が最上位。GainEvidence / JourneyLink / MonthReview
AI        analyze-log が1回の呼び出しで分析 + Gain提案 + リンクを返す
          関連ログは loadRecentLogs（直近N件）
MAP       ME → GainType → Gain → Evidence の4階層
規律      gainRules.ts がモデル出力をコードでクランプする

## 2. 新仕様と衝突する旧仕様

1. inputCategory（3チップ）
   §3 の TYPE + SIGNAL と役割が重複する。両立させると入力が4タップになり
   §4「10秒」に反する。廃止する。

2. Gain が最上位
   §22「Gain は Progression の結果としてのみ扱う」。gains を progressions
   従属へ移す。

3. MAP の Level 1 が GainType
   §17 が明示的に禁止している。「CAPABILITY」は AI 内部の分類名であって、
   本人の言葉ではない。Level 1 を Progression Theme に置き換える。

4. gain_status（confirmed / possible / unresolved）
   Progression の maturity に吸収される。冗長。

5. type 語彙 3つ
   insight → perspective、connection → relationship、evidence → Gain 側へ。

## 3. Information Architecture

    LEVEL 0   ME
    LEVEL 1   Progression Theme    「人に伝える」「つくる」「働き方」
    LEVEL 2   Progression Step     怖い → 見せる → 伝わらない → 変えた → 初対面
    LEVEL 3   Evidence (log)       タップしたときだけ

Progression detail

    TITLE           人に伝える
    summary         「人に見せることへの抵抗」から「伝え方を試しながら外に出す」へ
    HOW IT CHANGED  4月 … → 5月 … → 6月 … → 7月 … → 8月 …
    WHAT REMAINS    Gain（あれば）
                    納得した / 少し違う

Level 1 のラベルは本人のログから生まれた自然な言葉を使う。AI 内部の
progression_type は保持するが、画面には出さない。

## 4. DB migration

supabase/migrations/20260906000000_progression_model.sql

logs
  type を復活させる。enum log_type ('event','thought') と列は v1.5 から
  残っており、gain migration が not null を外しただけなので復元でよい。
  subjective_signal を追加（positive | mixed | negative）。
  input_category は行を残したまま参照をやめる。

新 enum
  progression_type      capability strategy interest direction
                        relationship perspective
  progression_maturity  signal emerging evidenced established
  progression_evidence_role
                        origin attempt setback adaptation evidence
                        turning_point current
  journey_role に exploration と continuation を追加

新テーブル
  progressions          type title from_state current_state summary
                        maturity confidence first_detected_at
                        last_updated_at verdict user_edited merged_into_id
  progression_evidence  progression_id log_id role occurred_at
  clarifications        log_id question options answer asked_at

既存テーブルの変更
  gains                 progression_id を追加し、Progression 従属にする
  log_ai_analysis       topics actors environment action outcome reaction
                        hypothesis future_intention signals(jsonb)
                        embedding(vector) を追加

データは消さない。v2 の gains は progression_id = null の孤児として残る。

## 5. AI pipeline（§29）

STAGE 1  Single Entry Extraction — analyze-entry
  入力  本文 + type + signal
  出力  event_summary topics actors environment action outcome reaction
        hypothesis future_intention journey_role signals confidence
  規律  本文に存在しないことを書かない。「展示会に行った」から
        「情熱が高まった」を導かない。confidence が低ければ neutral。
  保存  log_ai_analysis + embedding

STAGE 2  Cross-time Progression Analysis — detect-progression
  取得  embedding 近傍 K件 + topic 一致の過去ログ。全ログは送らない。
  検出  REPEAT CHANGE BUILD EXPERIMENT ADAPTATION CONTRAST REFRAME DIRECTION
  判断  create | update | merge | unchanged
  規律  progressionRules.ts が evidence から maturity 上限を計算し、
        モデルの申告をそこで頭打ちにする。

## 6. Progression detection

  1件目            Progression を作らない。点だけ置く（§31）
  2件以上・同テーマ  signal      「〜という兆しがあります」
  類似ログが複数     emerging    「最近、〜する記録が増えています」
  Before/After が揃う evidenced  「以前の〜から、最近は〜へ変化しています」
  月をまたいで反復   established 「この期間を通して、〜が繰り返し確認されています」

maturityCeiling(evidence)

  evidence < 2                      昇格しない
  状態が1つしかない                  signal 止まり
  from ≠ current を具体ログで示せる   evidenced まで
  期間 > 45日 かつ 3ステップ以上      established 可

モデルが established と言っても、根拠が足りなければコードが落とす。

## 7. 実装順（§35）

  Phase 1  調査・計画（この文書）
  Phase 2  DB migration・型・LOG 入力（TYPE + SIGNAL）
  Phase 3  Single Entry Extraction
  Phase 4  retrieval と cross-time 検出
  Phase 5  Progression の create / update / merge
  Phase 6  ME 中心 Radial Progression Map
  Phase 7  Progression detail（HOW IT CHANGED / WHAT REMAINS）
  Phase 8  monthly Progressions
  Phase 9  視覚調整・オフライン・アクセシビリティ・テスト

## 8. 判断に迷ったら

出来事とつぶやきを残すだけで、AI が点と点をつなぎ、自分がどう変わって
きたのかを見せてくれる。

ユーザーには人生を分類させない。
