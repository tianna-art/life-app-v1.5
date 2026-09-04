/**
 * Every user-facing string that the spec pins down verbatim lives here so that
 * the forbidden phrasing ("記録が足りません" etc.) cannot creep back in.
 */
export const EMPTY_STATE = {
  log: 'まだ何も残していません。＋から最初の点を置いてみる。',
  map: 'この月の空は、まだ静かです。',
  mapYear: 'この年の空は、まだ静かです。',
  list: 'この月には、まだ記録がありません。',
} as const;

export const LABELS = {
  event: '出来事',
  thought: 'つぶやき',
  all: 'すべて',
  monthly: '月次',
  yearly: '年次',
  seeKeywords: 'キーワードを見る',
  edit: '編集',
  skip: 'スキップ',
  accept: '納得した',
  titleThisMonth: 'この月にタイトルをつける',
  titleThisYear: 'この年にタイトルをつける',
  intentionPrompt: '今月、どんな感じで過ごしたい？',
  saved: '記録しました',
} as const;

/** Guard used in tests: none of these may appear in shipped copy. */
export const FORBIDDEN_PHRASES = [
  '記録が足りません',
  'あなたは',
  '本当のあなた',
  '意味がありました',
] as const;
