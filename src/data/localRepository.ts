import { DEFAULT_CATEGORIES } from '@/constants/categories';
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
import { slugify, uuid } from '@/utils/id';
import { monthKeyOfDate, todayIso, yearKeyOfDate } from '@/utils/period';
import type { Repository } from './repository';
import { mutateStore, readStore, type LocalStoreShape } from './localStore';
import { fallbackIcon, type CategoryIcon } from '@/constants/icons';

export const LOCAL_USER_ID = 'local-user';

function toLogWithAnalysis(store: LocalStoreShape, log: JournalLog): LogWithAnalysis {
  const analysis = store.analyses[log.id];
  return analysis ? { ...log, analysis } : { ...log };
}

function sortLogs(logs: JournalLog[]): JournalLog[] {
  return [...logs].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * On-device repository. Used when Supabase is not configured, and as the
 * durable mirror behind the offline queue.
 */
export class LocalRepository implements Repository {
  readonly name = 'local' as const;

  async ensureBootstrapped(): Promise<void> {
    await mutateStore((store) => {
      if (store.categories.length > 0) return store;
      const now = new Date().toISOString();
      return {
        ...store,
        categories: DEFAULT_CATEGORIES.map((seed, index) => ({
          id: uuid(),
          name: seed.name,
          slug: seed.slug,
          sortOrder: index,
          isActive: true,
          isDefault: true,
          icon: seed.icon,
          promptExamples: seed.promptExamples,
          createdAt: now,
        })) as Category[],
      };
    });
  }

  async listCategories(includeInactive = false): Promise<Category[]> {
    const store = await readStore();
    return store.categories
      .filter((c) => includeInactive || c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createCategory(input: {
    name: string;
    promptExamples?: string[];
    icon?: CategoryIcon;
  }): Promise<Category> {
    const slug = slugify(input.name);
    const created: Category = {
      id: uuid(),
      name: input.name.trim(),
      slug,
      sortOrder: 0,
      isActive: true,
      isDefault: false,
      icon: input.icon ?? fallbackIcon(slug),
      promptExamples: input.promptExamples ?? [],
    };
    await mutateStore((store) => {
      created.sortOrder = store.categories.length;
      return { ...store, categories: [...store.categories, created] };
    });
    return created;
  }

  async renameCategory(id: string, name: string): Promise<Category> {
    let updated: Category | undefined;
    await mutateStore((store) => ({
      ...store,
      categories: store.categories.map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, name: name.trim() };
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Category not found: ${id}`);
    return updated;
  }

  async setCategoryIcon(id: string, icon: CategoryIcon): Promise<Category> {
    let updated: Category | undefined;
    await mutateStore((store) => ({
      ...store,
      categories: store.categories.map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, icon };
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Category not found: ${id}`);
    return updated;
  }

  /** Soft delete only — the row and every log pointing at it survive. */
  async setCategoryActive(id: string, isActive: boolean): Promise<Category> {
    let updated: Category | undefined;
    await mutateStore((store) => ({
      ...store,
      categories: store.categories.map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, isActive };
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Category not found: ${id}`);
    return updated;
  }

  async reorderCategories(orderedIds: string[]): Promise<Category[]> {
    const store = await mutateStore((current) => ({
      ...current,
      categories: current.categories.map((c) => {
        const index = orderedIds.indexOf(c.id);
        return index === -1 ? c : { ...c, sortOrder: index };
      }),
    }));
    return store.categories.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listLogsByMonth(key: string): Promise<LogWithAnalysis[]> {
    const store = await readStore();
    return sortLogs(store.logs.filter((l) => monthKeyOfDate(l.occurredOn) === key)).map((l) =>
      toLogWithAnalysis(store, l)
    );
  }

  async listLogsByYear(key: string): Promise<LogWithAnalysis[]> {
    const store = await readStore();
    return sortLogs(store.logs.filter((l) => yearKeyOfDate(l.occurredOn) === key)).map((l) =>
      toLogWithAnalysis(store, l)
    );
  }

  async getLog(id: string): Promise<LogWithAnalysis | null> {
    const store = await readStore();
    const log = store.logs.find((l) => l.id === id);
    return log ? toLogWithAnalysis(store, log) : null;
  }

  async createLog(input: NewLogInput): Promise<JournalLog> {
    const log: JournalLog = {
      id: uuid(),
      userId: LOCAL_USER_ID,
      occurredOn: input.occurredOn ?? todayIso(),
      type: input.type,
      categoryId: input.categoryId,
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({ ...store, logs: [log, ...store.logs] }));
    return log;
  }

  async deleteLog(id: string): Promise<void> {
    await mutateStore((store) => {
      const { [id]: _removed, ...analyses } = store.analyses;
      return { ...store, logs: store.logs.filter((l) => l.id !== id), analyses };
    });
  }

  async getTitle(periodType: PeriodType, periodKey: string): Promise<PeriodTitle | null> {
    const store = await readStore();
    return (
      store.titles.find((t) => t.periodType === periodType && t.periodKey === periodKey) ?? null
    );
  }

  async listTitles(periodType: PeriodType, yearKeyValue: string): Promise<PeriodTitle[]> {
    const store = await readStore();
    return store.titles.filter(
      (t) => t.periodType === periodType && t.periodKey.startsWith(yearKeyValue)
    );
  }

  async upsertTitle(title: PeriodTitle): Promise<PeriodTitle> {
    await mutateStore((store) => {
      const rest = store.titles.filter(
        (t) => !(t.periodType === title.periodType && t.periodKey === title.periodKey)
      );
      return { ...store, titles: [...rest, title] };
    });
    return title;
  }

  async getIntention(periodKey: string): Promise<MonthlyIntention | null> {
    const store = await readStore();
    return store.intentions.find((i) => i.periodKey === periodKey) ?? null;
  }

  async listIntentions(yearKeyValue: string): Promise<MonthlyIntention[]> {
    const store = await readStore();
    return store.intentions.filter((i) => i.periodKey.startsWith(`${yearKeyValue}-`));
  }

  async upsertIntention(intention: MonthlyIntention): Promise<MonthlyIntention> {
    await mutateStore((store) => ({
      ...store,
      intentions: [
        ...store.intentions.filter((i) => i.periodKey !== intention.periodKey),
        intention,
      ],
    }));
    return intention;
  }

  async getInsight(
    periodType: PeriodType,
    periodKey: string,
    categoryId: string
  ): Promise<CategoryInsight | null> {
    const store = await readStore();
    return (
      store.insights.find(
        (i) =>
          i.periodType === periodType && i.periodKey === periodKey && i.categoryId === categoryId
      ) ?? null
    );
  }

  async saveInsight(insight: CategoryInsight): Promise<CategoryInsight> {
    await mutateStore((store) => ({
      ...store,
      insights: [
        ...store.insights.filter(
          (i) =>
            !(
              i.periodType === insight.periodType &&
              i.periodKey === insight.periodKey &&
              i.categoryId === insight.categoryId
            )
        ),
        insight,
      ],
    }));
    return insight;
  }

  async saveAnalysis(logId: string, analysis: LogWithAnalysis['analysis']): Promise<void> {
    if (!analysis) return;
    await mutateStore((store) => ({
      ...store,
      analyses: { ...store.analyses, [logId]: analysis },
    }));
  }

  async saveKeywordReview(input: {
    insightId: string;
    status: Exclude<ReviewStatus, 'pending'>;
    finalKeywords: KeywordCandidate[];
  }): Promise<CategoryInsight> {
    let updated: CategoryInsight | undefined;
    await mutateStore((store) => ({
      ...store,
      insights: store.insights.map((i) => {
        if (i.id !== input.insightId) return i;
        // The AI's original proposal is kept alongside the user's version.
        updated = {
          ...i,
          status: input.status,
          keywords: input.status === 'skipped' ? i.keywords : input.finalKeywords,
        };
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Insight not found: ${input.insightId}`);
    return updated;
  }
}
