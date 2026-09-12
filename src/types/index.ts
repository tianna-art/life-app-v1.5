/**
 * Domain types for crincran.
 *
 * The product is a direction and the footprints left while walking it, and the
 * order between those two is the whole point:
 *
 *   ビジョンボード   the scenery, with no period attached
 *   年の方向         one sentence for the year
 *   月の方向         up to two アンテナ — what to watch this month
 *   記録             what actually happened
 *   見えてきたこと   what the records suggest, with the records attached
 *   足跡タイトル     the name given afterwards to time already lived
 *
 * A direction is not a destination. Nothing in this file records how close
 * anyone is to anything: no progress, no achievement, no match rate. 足跡
 * タイトル in particular is a name for the road walked, never a verdict on
 * whether the direction was reached.
 */

// ---------------------------------------------------------------------------
// ビジョンボード — the top layer, with no period
// ---------------------------------------------------------------------------

/** One piece of scenery the person wants to live toward. */
export interface VisionItem {
  id: string;
  text: string;
  sortOrder: number;
}

/** A word they want to keep. Their own, or a common phrase — never a quote. */
export interface VisionWord {
  id: string;
  text: string;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// 方向 — year and month
// ---------------------------------------------------------------------------

/** The five アンテナ. Frozen ids: rows point at these. */
export type AntennaId =
  | 'progress'
  | 'self_understanding'
  | 'spark'
  | 'sustainable'
  | 'values';

export const ANTENNA_IDS: readonly AntennaId[] = [
  'progress',
  'self_understanding',
  'spark',
  'sustainable',
  'values',
];

/**
 * Two at a time. Three makes every one of them look half-watched, and the
 * month's reading has to say something about each one it claims to follow.
 */
export const MAX_ANTENNAS = 2;

/** 年の方向 — one sentence, arrived at by answering or by writing it straight. */
export interface YearDirection {
  year: number;
  /** The sentence itself. Shown verbatim everywhere; AI never rephrases it. */
  direction: string;
  keywords: string[];
  /** The answers to the five questions, when that route was taken. */
  answers: string[];
  updatedAt: string;
}

/** A direction that was replaced. Kept so the change itself stays visible. */
export interface YearDirectionChange {
  id: string;
  year: number;
  direction: string;
  replacedAt: string;
}

/** 月の方向 — which アンテナ are up this month. Changeable mid-month. */
export interface MonthDirection {
  /** `YYYY-MM`. */
  periodKey: string;
  antennaIds: AntennaId[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 記録
// ---------------------------------------------------------------------------

export type InputMethod = 'typed' | 'voice';

/** Where a record came from. A record is a record however it arrived. */
export type LogSource = 'manual' | 'future_memo' | 'flow';

/**
 * ひとこと記録.
 *
 * `occurredOn` is nullable: a record entered for a past month carries the
 * month but not a day, and inventing one would put it on a day that did not
 * happen. Tags are optional — a record with no tag is still a record.
 */
export interface JournalLog {
  id: string;
  userId: string;
  /** ISO date, or null when only the month is known. */
  occurredOn: string | null;
  /** `YYYY-MM`. Always present, including for day-less records. */
  periodKey: string;
  body: string;
  /** The category tapped, when one was. Belongs to an アンテナ. */
  categoryId: string | null;
  /** The narrowing under that category, when one was tapped. */
  detailId: string | null;
  inputMethod: InputMethod;
  source: LogSource;
  /** The 未来メモ or 感情クエスト session this came from, when it did. */
  sourceId: string | null;
  createdAt: string;
}

/** A category belongs to an アンテナ and narrows into details. */
export interface Category {
  id: string;
  antennaId: AntennaId;
  label: string;
  /** The question shown once this category is tapped. */
  detailQuestion: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryDetail {
  id: string;
  categoryId: string;
  label: string;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// 未来メモ
// ---------------------------------------------------------------------------

export type FutureType = 'interest' | 'place' | 'movie' | 'book' | 'other';

/** How firm the date is. `none` carries no date at all. */
export type DateKind = 'none' | 'by' | 'after';

export type FutureStatus = 'future' | 'completed' | 'trashed';

export interface FutureMemo {
  id: string;
  type: FutureType;
  title: string;
  memo: string;
  /** Null whenever `dateKind` is `none`. */
  targetDate: string | null;
  dateKind: DateKind;
  /** ★ — starred memos are the ones the map shows. At most three are drawn. */
  favorite: boolean;
  status: FutureStatus;
  completedAt: string | null;
  /** What stayed with them, once it is done. Vocabulary varies by type. */
  heartTags: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 感情クエスト
// ---------------------------------------------------------------------------

export type FlowStage = 'rain' | 'river' | 'ocean' | 'cloud';

export const FLOW_STAGES: readonly FlowStage[] = ['rain', 'river', 'ocean', 'cloud'];

/**
 * One run through the four stages.
 *
 * Nothing here is written until the person presses 記録する at the end. A
 * half-finished session that was abandoned was not a record they chose to
 * keep.
 */
export interface FlowSession {
  id: string;
  /** Keyed by stage; a stage left blank is simply absent. */
  entries: Partial<Record<FlowStage, string>>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 見えてきたこと — what the records suggest
// ---------------------------------------------------------------------------

/**
 * The kinds of 見立て. These are the labels the reading may use; it does not
 * have to use all of them, and an empty one is left out rather than filled.
 */
export type InsightLabel =
  | '積み上がったこと'
  | '力が出る条件'
  | '大切にしたいもの'
  | '自分に合う進み方'
  | '続けやすい方法'
  | '心が向く方向'
  | '思っていたこととの違い'
  | '手がかり';

/**
 * One 見立てカード.
 *
 * `evidence` is not decoration: a card with one record behind it stays a
 * 手がかり and says so, and a card with none is never produced at all.
 */
export interface MonthInsight {
  id: string;
  periodKey: string;
  antennaId: AntennaId;
  label: InsightLabel;
  text: string;
  /** What this changes about the next decision. */
  why: string;
  /** What has not been confirmed yet. Not a task, and never a shortfall. */
  note: string;
  evidenceLogIds: string[];
}

/**
 * 先月からの変化 / 去年との違い.
 *
 * Written only when both periods hold enough to be compared, and carrying the
 * records from both sides so the comparison can be checked by the person it is
 * about rather than taken on trust.
 */
export type ChangeKind = 'progression' | 'clarification' | 'continuity';

export interface PeriodChange {
  id: string;
  periodType: PeriodType;
  periodKey: string;
  /** The period this one is held up against. */
  compareKey: string;
  kind: ChangeKind;
  title: string;
  summary: string;
  previousLogIds: string[];
  currentLogIds: string[];
  /** What this comparison cannot see. Shown, not hidden. */
  note: string;
}

/**
 * 今の仮説 — only when at least two cards each have two or more records
 * behind them. Always hedged; never stated as fact.
 */
export interface MonthHypothesis {
  periodKey: string;
  text: string;
  updatedAt: string;
}

/**
 * 要約 — three words and two sentences, for a month or a year.
 *
 * Two bodies. `body` is what the reading produced; `bodyUser` is what the
 * person wrote over it. They are kept apart so a summary can be regenerated
 * without discarding someone's own words, and so it stays possible to tell
 * which of the two you are reading.
 */
export interface PeriodSummary {
  periodType: PeriodType;
  periodKey: string;
  keywords: string[];
  body: string;
  bodyUser: string | null;
  updatedAt: string;
}

/** What the screen shows: the person's words when they wrote any. */
export function summaryText(summary: PeriodSummary): string {
  return summary.bodyUser?.trim() || summary.body;
}

// ---------------------------------------------------------------------------
// 足跡タイトル
// ---------------------------------------------------------------------------

export type PeriodType = 'month' | 'year';
export type TitleSource = 'manual' | 'ai';

/**
 * The name given to a period after living it.
 *
 * Periods that predate the app can be titled by hand, which is why this is not
 * gated on there being records.
 */
export interface PeriodTitle {
  periodType: PeriodType;
  /** `YYYY-MM` or `YYYY`. */
  periodKey: string;
  title: string;
  source: TitleSource;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Input payloads
// ---------------------------------------------------------------------------

export interface NewLogInput {
  body: string;
  occurredOn: string | null;
  periodKey: string;
  categoryId?: string | null;
  detailId?: string | null;
  inputMethod?: InputMethod;
  source?: LogSource;
  sourceId?: string | null;
}

export interface NewFutureMemoInput {
  type: FutureType;
  title: string;
  memo?: string;
  targetDate?: string | null;
  dateKind?: DateKind;
  favorite?: boolean;
}
