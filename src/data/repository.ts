import type {
  DailyLog,
  Gain,
  LogWithAnalysis,
  MonthProgression,
  MonthMap,
  MonthReview,
  MonthTheme,
  NewLogInput,
  Progression,
  ProgressionDetail,
  ProgressionVerdict,
  YearDirection,
  YearReview,
} from '@/types';

/**
 * Storage contract. Implemented twice: against Supabase (shipped) and against
 * on-device AsyncStorage (development fallback / offline mirror).
 *
 * The split that matters: the lens is the person's — they pick the areas, the
 * cards and the themes, so those are written from here. Progressions, evidence
 * and gains are produced by the Edge Functions and are read-only, with one
 * exception the person owns: their verdict on a progression.
 */
export interface Repository {
  readonly name: 'supabase' | 'local';

  ensureBootstrapped(): Promise<void>;

  // -- The lens (§2-§7) ------------------------------------------------------

  getYearDirection(year: number): Promise<YearDirection | null>;
  saveYearDirection(input: {
    year: number;
    selectedAreas: string[];
    desiredSelfCards: string[];
    progressionLenses: string[];
    initialTheme?: string;
    finalTheme?: string;
  }): Promise<YearDirection>;

  getMonthTheme(year: number, month: number): Promise<MonthTheme | null>;
  listMonthThemes(year: number): Promise<MonthTheme[]>;
  saveMonthTheme(input: {
    year: number;
    month: number;
    initialTheme?: string;
    finalTheme?: string;
    source: MonthTheme['source'];
    candidates?: MonthTheme['candidates'];
  }): Promise<MonthTheme>;

  // -- Daily evidence (§8-§14) ----------------------------------------------

  listLogsByMonth(monthKey: string): Promise<LogWithAnalysis[]>;
  listLogsByYear(yearKey: string): Promise<LogWithAnalysis[]>;
  getLog(id: string): Promise<LogWithAnalysis | null>;
  createLog(input: NewLogInput): Promise<DailyLog>;
  deleteLog(id: string): Promise<void>;

  // -- Progression (§17-§23) ------------------------------------------------

  listProgressions(): Promise<Progression[]>;
  /** The month's sky: how far each progression stood at that month's end. */
  listMonthProgressions(monthKey: string): Promise<MonthProgression[]>;
  getProgressionDetail(id: string): Promise<ProgressionDetail | null>;
  setProgressionVerdict(input: {
    progressionId: string;
    verdict: ProgressionVerdict;
    title?: string;
    summary?: string;
  }): Promise<Progression>;

  /** Everything that has settled, for the year's reading. */
  listGains(): Promise<Gain[]>;

  // -- Month & year (§25, §26) ----------------------------------------------

  getMonthMap(periodKey: string): Promise<MonthMap | null>;
  getMonthReview(periodKey: string): Promise<MonthReview | null>;
  listMonthReviews(yearKey: string): Promise<MonthReview[]>;
  saveMonthReview(review: MonthReview): Promise<MonthReview>;

  getYearReview(year: number): Promise<YearReview | null>;
  saveYearReview(review: YearReview): Promise<YearReview>;
}
