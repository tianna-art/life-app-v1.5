import type {
  EntryWithAnalysis,
  Gain,
  GainDetail,
  GainVerdict,
  JournalEntry,
  MonthReview,
  NewEntryInput,
} from '@/types';

/** One gain as it appears in a single month's sky (§18). */
export interface MonthGain {
  gain: Gain;
  /** Ids of this month's entries that stand behind it. */
  evidenceLogIds: string[];
  /** NEW when the gain first appeared this month; CONTINUING otherwise. */
  isNew: boolean;
}

/**
 * Storage contract. Implemented twice: against Supabase (shipped) and against
 * on-device AsyncStorage (development fallback / offline mirror).
 *
 * Gains, evidence and links are produced by the Edge Function and are read-only
 * here, with one exception: the person's verdict on a gain (§27).
 */
export interface Repository {
  readonly name: 'supabase' | 'local';

  ensureBootstrapped(): Promise<void>;

  listEntriesByMonth(monthKey: string): Promise<EntryWithAnalysis[]>;
  listEntriesByYear(yearKey: string): Promise<EntryWithAnalysis[]>;
  getEntry(id: string): Promise<EntryWithAnalysis | null>;
  createEntry(input: NewEntryInput): Promise<JournalEntry>;
  deleteEntry(id: string): Promise<void>;

  /** Every gain still standing on its own (merged ones resolve to their target). */
  listGains(): Promise<Gain[]>;
  /** The month's sky: which gains this month's records stand behind. */
  listMonthGains(monthKey: string): Promise<MonthGain[]>;
  /** Gain plus the path that formed it, oldest first (§17). */
  getGainDetail(gainId: string): Promise<GainDetail | null>;
  /** 納得した / 少し違う — and, for 少し違う, the person's own wording. */
  setGainVerdict(input: {
    gainId: string;
    verdict: GainVerdict;
    label?: string;
  }): Promise<Gain>;

  getMonthReview(periodKey: string): Promise<MonthReview | null>;
  listMonthReviews(yearKey: string): Promise<MonthReview[]>;
  saveMonthReview(review: MonthReview): Promise<MonthReview>;
}
