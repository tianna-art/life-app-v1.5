/**
 * Every user-facing string the spec pins down lives here, so the forbidden
 * register — praise, diagnosis, forced meaning — cannot creep back in through
 * a component someone edits in a hurry.
 */
export const HOME = {
  /** The only question the app ever asks. It is about facts, not meaning. */
  question: '今日、何があった？',
  placeholder: '今日のことを、そのまま残す。',
  save: '保存',
  reset: '入力内容を消す',
} as const;

export const EMPTY_STATE = {
  /** HOME shows nothing at all when empty — the field is the whole screen. */
  map: 'まだ、中心だけがあります。',
  list: 'この月には、まだ記録がありません。',
  gainDetail: 'この Gain を支える記録は、まだ1件です。',
} as const;

export const LABELS = {
  todaysGain: "TODAY'S GAIN",
  howItFormed: 'HOW IT FORMED',
  me: 'ME',
  monthComplete: 'THIS MONTH IS COMPLETE.',
  threeGains: '3 GAINS',
  oneChange: 'ONE CHANGE',
  accepted: '納得した',
  adjusted: '少し違う',
  saveEdit: 'この言い方にする',
  new: 'NEW',
  continuing: 'CONTINUING',
  back: '戻る',
} as const;

/**
 * Shown when nothing could honestly be extracted (§8). Never a substitute
 * gain, never an apology — the day is simply allowed to stay unread.
 */
export const UNRESOLVED_LINE = '今日は、まだ意味を決めなくていい。';

/** Guard used in tests: none of these may appear in shipped copy. */
export const FORBIDDEN_PHRASES = [
  '記録が足りません',
  'あなたは',
  '本当のあなた',
  '意味がありました',
  '素晴らしい',
  '成長しています',
  '連続',
] as const;
