/**
 * Every user-facing string the spec pins down lives here, so the forbidden
 * register — praise, diagnosis, forced meaning — cannot creep back in through
 * a component someone edits in a hurry.
 */
export const HOME = {
  // There is no heading. §8 wants the app to open one tap from recording, and
  // a line naming the screen you are already looking at is one more thing to
  // read before the first tap. The two labels below are the whole prompt.
  date: 'いつのこと？',
  level1: '出来事のカテゴリ',
  level2: '感情のカテゴリ',
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
  /** §25 names this section, and it is not 'Progression Summary' (§2). */
  changed: '今月見えた変化',
  gained: 'WHAT YOU GAINED',
  chooseTitle: 'この月の名前',
} as const;

/**
 * The summary card (§26).
 *
 * Four labels in one place, because their order is the argument: the person's
 * own records, then what those show, then what that has to do with what they
 * put down at the start. Nothing here may read as a verdict on the month.
 */
export const CHANGE = {
  heading: '今月見えた変化',
  fromRecords: '記録から',
  before: '以前の記録では',
  observation: '見えてきたこと',
  targetConnection: 'ありたい姿とのつながり',
  allEvidence: 'この変化のもとになった記録',
  /** §31: nothing yet is a real answer, and is said without apology. */
  none: '今月はまだ、過去との差がはっきり見える変化はありません。',
} as const;

export const YEAR = {
  thought: 'YOU THOUGHT THIS YEAR WOULD BE ABOUT',
  became: 'IT ACTUALLY BECAME',
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
  allCategories: 'すべて',
  allMoments: 'すべての瞬間',
  generateMap: 'MAPを生成する',
  tryAgain: 'もう一度試す',
  openMap: 'MAPを見にいく',
  regenerateMap: 'MAPを再生成する',
  new: 'NEW',
  evidence: 'この気づきの根拠',
  evidenceNote: 'この見方のもとになった記録です。書いたままを出しています。',
  close: '閉じる',
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
