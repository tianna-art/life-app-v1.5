import type {
  Category,
  CategoryDetail,
  FlowSession,
  FlowStage,
  FutureMemo,
  JournalLog,
  MonthDirection,
  MonthHypothesis,
  MonthInsight,
  PeriodSummary,
  NewFutureMemoInput,
  NewLogInput,
  PeriodTitle,
  PeriodType,
  VisionItem,
  VisionWord,
  YearDirection,
  YearDirectionChange,
} from '@/types';

/**
 * Everything the app can ask of storage.
 *
 * Two implementations stand behind it: Supabase, and a local store used when
 * no Supabase credentials are configured. The screens never learn which one
 * they are talking to.
 */
export interface Repository {
  ensureBootstrapped(): Promise<void>;

  // ビジョンボード
  listVisionItems(): Promise<VisionItem[]>;
  listVisionWords(): Promise<VisionWord[]>;
  addVisionItem(text: string): Promise<VisionItem>;
  addVisionWord(text: string): Promise<VisionWord>;
  removeVisionItem(id: string): Promise<void>;
  removeVisionWord(id: string): Promise<void>;

  // 方向
  getYearDirection(year: number): Promise<YearDirection | null>;
  saveYearDirection(input: {
    year: number;
    direction: string;
    keywords?: string[];
    answers?: string[];
  }): Promise<YearDirection>;
  listYearDirectionHistory(year: number): Promise<YearDirectionChange[]>;
  getMonthDirection(periodKey: string): Promise<MonthDirection | null>;
  saveMonthDirection(periodKey: string, antennaIds: string[]): Promise<MonthDirection>;

  // カテゴリー（アンテナの下）
  listCategories(): Promise<Category[]>;
  listCategoryDetails(categoryId: string): Promise<CategoryDetail[]>;

  // 記録
  /**
   * The earliest month anything was ever recorded in, or null. Months before
   * it ended without the app, so their names can only be typed by hand.
   */
  firstRecordedPeriod(): Promise<string | null>;
  listLogs(periodKey: string): Promise<JournalLog[]>;
  listLogsInYear(year: number): Promise<JournalLog[]>;
  getLogs(ids: string[]): Promise<JournalLog[]>;
  createLog(input: NewLogInput): Promise<JournalLog>;
  deleteLog(id: string): Promise<void>;

  // 未来メモ
  listFutureMemos(): Promise<FutureMemo[]>;
  createFutureMemo(input: NewFutureMemoInput): Promise<FutureMemo>;
  updateFutureMemo(id: string, patch: Partial<FutureMemo>): Promise<FutureMemo>;

  // 感情クエスト
  lastFlowSession(): Promise<FlowSession | null>;
  saveFlowSession(entries: Partial<Record<FlowStage, string>>): Promise<FlowSession>;

  // 読み取り
  getSummary(periodType: PeriodType, periodKey: string): Promise<PeriodSummary | null>;
  /**
   * Rewrite the summary in the person's own words. Only their half of it: the
   * reading's body and keywords are not writable from here.
   */
  saveOwnSummary(input: {
    periodType: PeriodType;
    periodKey: string;
    bodyUser: string;
  }): Promise<PeriodSummary>;
  listMonthInsights(periodKey: string): Promise<MonthInsight[]>;
  getMonthHypothesis(periodKey: string): Promise<MonthHypothesis | null>;

  // 足跡タイトル
  listPeriodTitles(periodType: PeriodType): Promise<PeriodTitle[]>;
  savePeriodTitle(input: {
    periodType: PeriodType;
    periodKey: string;
    title: string;
    source?: 'manual' | 'ai';
  }): Promise<PeriodTitle>;
}
