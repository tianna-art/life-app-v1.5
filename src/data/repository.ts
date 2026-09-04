import type {
  Category,
  CategoryInsight,
  JournalLog,
  KeywordCandidate,
  LogWithAnalysis,
  MonthlyIntention,
  NewLogInput,
  PeriodTitle,
  PeriodType,
  ReviewStatus,
} from '@/types';
import type { CategoryIcon } from '@/constants/icons';

/**
 * Storage contract. Implemented twice: against Supabase (shipped) and against
 * on-device AsyncStorage (development fallback / offline mirror).
 */
export interface Repository {
  readonly name: 'supabase' | 'local';

  ensureBootstrapped(): Promise<void>;

  listCategories(includeInactive?: boolean): Promise<Category[]>;
  createCategory(input: {
    name: string;
    promptExamples?: string[];
    icon?: CategoryIcon;
  }): Promise<Category>;
  renameCategory(id: string, name: string): Promise<Category>;
  setCategoryIcon(id: string, icon: CategoryIcon): Promise<Category>;
  /** Soft delete: is_active=false. Historic logs keep pointing at the row. */
  setCategoryActive(id: string, isActive: boolean): Promise<Category>;
  reorderCategories(orderedIds: string[]): Promise<Category[]>;

  listLogsByMonth(monthKey: string): Promise<LogWithAnalysis[]>;
  listLogsByYear(yearKey: string): Promise<LogWithAnalysis[]>;
  getLog(id: string): Promise<LogWithAnalysis | null>;
  createLog(input: NewLogInput): Promise<JournalLog>;
  deleteLog(id: string): Promise<void>;

  getTitle(periodType: PeriodType, periodKey: string): Promise<PeriodTitle | null>;
  listTitles(periodType: PeriodType, yearKey: string): Promise<PeriodTitle[]>;
  upsertTitle(title: PeriodTitle): Promise<PeriodTitle>;

  getIntention(periodKey: string): Promise<MonthlyIntention | null>;
  listIntentions(yearKey: string): Promise<MonthlyIntention[]>;
  upsertIntention(intention: MonthlyIntention): Promise<MonthlyIntention>;

  getInsight(
    periodType: PeriodType,
    periodKey: string,
    categoryId: string
  ): Promise<CategoryInsight | null>;
  saveKeywordReview(input: {
    insightId: string;
    status: Exclude<ReviewStatus, 'pending'>;
    finalKeywords: KeywordCandidate[];
  }): Promise<CategoryInsight>;
}
