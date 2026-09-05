/**
 * Every user-facing string the spec pins down lives here, so the forbidden
 * register — praise, diagnosis, forced meaning — cannot creep back in through
 * a component someone edits in a hurry.
 */
export const HOME = {
  /** The only question the app ever asks, and it is about facts (§5). */
  question: '今日、何があった？',
  placeholder: '今日のことを、そのまま残す。',
  save: '保存',
  reset: '入力内容を消す',
  signalLabel: '自分にとってどうだった？',
} as const;

export const EMPTY_STATE = {
  /** HOME shows nothing at all when empty — the field is the whole screen. */
  map: 'まだ、中心だけがあります。',
  list: 'この月には、まだ記録がありません。',
  progressionDetail: 'この変化を支える記録は、まだ集まっていません。',
} as const;

export const LABELS = {
  mirror: 'TODAY',
  howItChanged: 'HOW IT CHANGED',
  whatRemains: 'WHAT REMAINS',
  carryingForward: "WHAT YOU'RE CARRYING FORWARD",
  threeProgressions: '3 PROGRESSIONS',
  me: 'ME',
  monthComplete: 'THIS MONTH IS COMPLETE.',
  accepted: '納得した',
  adjusted: '少し違う',
  saveEdit: 'この言い方にする',
  new: 'NEW',
  skip: 'あとで',
  relatedProgressions: 'このログが立っている変化',
  back: '戻る',
} as const;

/**
 * Shown when nothing could honestly be said about a record (§15). Never a
 * substitute progression, never an apology — the day is allowed to stay
 * unread.
 */
export const UNRESOLVED_LINE = '今日は、まだ意味を決めなくていい。';

/** Shown when an entry lands on a trail that already existed (§15, §32). */
export const JOINED_PROGRESSION_LINE = '「{title}」に、新しい点が加わりました。';

/** The one line the emergence moment gets (§32). Quiet on purpose. */
export const PROGRESSION_EMERGED_LINE = '{count}つの出来事が、ひとつの変化としてつながりました。';

/**
 * Guard used in tests: none of these may appear in shipped copy.
 *
 * The first group is diagnosis (§13), the second is praise, the third is the
 * gamification §34 rules out.
 */
export const FORBIDDEN_PHRASES = [
  'あなたは',
  '本当のあなた',
  '天職',
  '意味がありました',
  '素晴らしい',
  '成長しました',
  '成長しています',
  '記録が足りません',
  '連続',
  'ポイント',
] as const;
