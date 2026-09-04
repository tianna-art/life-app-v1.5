/** Domain types. Mirrors crincran_implementation_spec.md §14 and the SQL schema. */

export type LogType = 'event' | 'thought';
export type PeriodType = 'month' | 'year';
export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'skipped';
export type TitleSource = 'manual' | 'ai';

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  /** Light guidance questions shown, one at random, when the category is picked. */
  promptExamples: string[];
}

export interface JournalLog {
  id: string;
  userId: string;
  /** ISO date, YYYY-MM-DD. */
  occurredOn: string;
  type: LogType;
  categoryId: string;
  body: string;
  createdAt: string;
}

export interface LogAIAnalysis {
  logId: string;
  keywords: string[];
  semanticTags: string[];
  tone?: string | undefined;
  confidence?: number | undefined;
}

/** A log joined with whatever AI analysis exists for it (analysis may be absent). */
export interface LogWithAnalysis extends JournalLog {
  analysis?: LogAIAnalysis | undefined;
}

export interface KeywordCandidate {
  label: string;
  confidence: number;
  evidenceLogIds: string[];
}

export interface CategoryInsight {
  id: string;
  periodType: PeriodType;
  periodKey: string;
  categoryId: string;
  insight: string;
  keywords: KeywordCandidate[];
  status: ReviewStatus;
}

export interface PeriodTitle {
  periodType: PeriodType;
  periodKey: string;
  title: string;
  source: TitleSource;
  isConfirmed: boolean;
}

export interface MonthlyIntention {
  periodKey: string;
  body: string;
}

export interface TitleCandidate {
  title: string;
  reason: string;
}

/** Payload accepted by the repository when creating a log. */
export interface NewLogInput {
  type: LogType;
  categoryId: string;
  body: string;
  occurredOn?: string;
}

export interface CategoryInput {
  name: string;
  promptExamples?: string[];
}
