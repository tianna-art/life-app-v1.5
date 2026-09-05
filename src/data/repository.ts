import type {
  Clarification,
  EntryWithAnalysis,
  JournalEntry,
  MonthProgression,
  MonthReview,
  NewEntryInput,
  Progression,
  ProgressionDetail,
  ProgressionVerdict,
} from '@/types';

/**
 * Storage contract. Implemented twice: against Supabase (shipped) and against
 * on-device AsyncStorage (development fallback / offline mirror).
 *
 * Progressions, evidence and gains are written by the Edge Functions and are
 * read-only here, with two exceptions the person owns: their verdict on a
 * progression (§28) and their answer to a clarification (§14).
 */
export interface Repository {
  readonly name: 'supabase' | 'local';

  ensureBootstrapped(): Promise<void>;

  listEntriesByMonth(monthKey: string): Promise<EntryWithAnalysis[]>;
  listEntriesByYear(yearKey: string): Promise<EntryWithAnalysis[]>;
  getEntry(id: string): Promise<EntryWithAnalysis | null>;
  createEntry(input: NewEntryInput): Promise<JournalEntry>;
  deleteEntry(id: string): Promise<void>;

  /** Every progression still standing on its own (merged ones resolve away). */
  listProgressions(): Promise<Progression[]>;
  /**
   * The month's sky: which progressions this month's records moved, and how
   * far along each one stood at the end of that month rather than today (§24).
   */
  listMonthProgressions(monthKey: string): Promise<MonthProgression[]>;
  /** Progression plus its path and whatever remains, oldest first (§21). */
  getProgressionDetail(id: string): Promise<ProgressionDetail | null>;
  /** 納得した / 少し違う — and, for 少し違う, the person's own wording (§28). */
  setProgressionVerdict(input: {
    progressionId: string;
    verdict: ProgressionVerdict;
    title?: string;
    summary?: string;
  }): Promise<Progression>;

  /** The single unanswered question, if the model asked one (§14). */
  getPendingClarification(): Promise<Clarification | null>;
  /** Answering and skipping are both answers; neither is asked twice. */
  answerClarification(input: { id: string; answer: string | null }): Promise<void>;

  getMonthReview(periodKey: string): Promise<MonthReview | null>;
  listMonthReviews(yearKey: string): Promise<MonthReview[]>;
  saveMonthReview(review: MonthReview): Promise<MonthReview>;
}
