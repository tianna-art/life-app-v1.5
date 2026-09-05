/**
 * Every user-facing string the spec pins down lives here, so the forbidden
 * register — praise, diagnosis, forced meaning — cannot creep back in through
 * a component someone edits in a hurry.
 */
export const HOME = {
  /** The only heading. It is about today, not about meaning (§8). */
  heading: '今日の記録',
  level1: '出来事のカテゴリ',
  level2: 'どんな瞬間だった？',
  /** Placeholder for the optional answer. Says plainly that it is optional. */
  answerPlaceholder: '答えなくても保存できます',
  save: '保存',
  reset: '入力内容を消す',
} as const;

export const ONBOARDING = {
  directionHeading: '今年、どんな方向を育てたい？',
  directionHint: 'いくつでも。あとから変えられます。',
  desiredHeading: 'どんな自分になれたら嬉しい？',
  desiredHint: '選んだものが、AIが見ていく変化になります。',
  lensHeading: '今年は、こんな変化を見ていきます',
  themeHeading: '今年のテーマ',
  themeHint: '目標ではありません。年末にもう一度決めます。',
  writeMyOwn: '自分で書く',
  next: '次へ',
  done: 'はじめる',
} as const;

export const MONTH = {
  themeHeading: '今月のテーマ',
  skip: '今月は決めない',
  startedWith: 'YOU STARTED WITH',
  actuallyHappened: 'WHAT ACTUALLY HAPPENED',
  changed: 'WHAT CHANGED',
  gained: 'WHAT YOU GAINED',
  chooseTitle: 'この月の名前',
} as const;

export const YEAR = {
  thought: 'YOU THOUGHT THIS YEAR WOULD BE ABOUT',
  became: 'IT ACTUALLY BECAME',
} as const;

/**
 * Reading records that were never read (the analysis backfill).
 *
 * Deliberately plain: this is machinery, not part of the daily surface, and
 * saying what it is about to do is the only thing it owes the person.
 */
export const BACKFILL = {
  heading: '読まれていない記録',
  explain: '保存したときに読まれなかった記録を、古いものから1件ずつ読みます。',
  rangeLabel: 'どこまでさかのぼる？',
  none: 'この期間の記録は、すべて読まれています。',
  start: '読みはじめる',
  stop: 'ここでとめる',
  keepOpen: '終わるまで、この画面を開いたままにしてください。',
  order: '記録は起きた順に読みます。順番が変わると、つながりも変わります。',
} as const;

export const EMPTY_STATE = {
  map: 'まだ、中心だけがあります。',
  list: 'この月には、まだ記録がありません。',
  progressionDetail: 'この変化を支える記録は、まだ集まっていません。',
} as const;

export const LABELS = {
  mirror: 'TODAY',
  path: 'PATH',
  before: 'BEFORE',
  current: 'CURRENT',
  whatYouGained: "WHAT YOU'VE GAINED",
  relatedProgressions: 'このログが立っている変化',
  me: 'ME',
  monthComplete: 'THIS MONTH IS COMPLETE.',
  direction: 'この一年の方向',
  thisMonth: '今月にもどる',
  openMonth: 'この月を見る',
  pastMonthNotice: '記録は今日に残ります。',
  accepted: '納得した',
  adjusted: '少し違う',
  saveEdit: 'この言い方にする',
  new: 'NEW',
  back: '戻る',
} as const;

/** Shown when an entry lands on a trail that already existed (§31). */
export const JOINED_LINE = '「{title}」に、新しい点が加わりました。';

/**
 * The one line the emergence moment gets (§32).
 *
 * Quiet on purpose: §32 rules out celebration, so this is a statement of what
 * happened and nothing else.
 */
export const EMERGED_LINE = '{count}つの記録が、ひとつの変化としてつながりました。';

/**
 * Guard used in tests: none of these may appear in shipped copy.
 *
 * The first group is diagnosis (§30), the second is praise, the third is the
 * gamification §29 rules out, and the last is the reflective questioning §12
 * takes off the person's plate.
 */
export const FORBIDDEN_PHRASES = [
  'あなたは',
  '本当のあなた',
  '天職',
  '意味がありました',
  '素晴らしい',
  '成長しました',
  '成長しています',
  '強くなりました',
  '連続',
  'ポイント',
  '達成率',
  '何を学び',
] as const;
