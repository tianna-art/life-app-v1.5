import { ANTENNAS, ANTENNA_ORDER } from '@/constants/generated/preview';
import { uuid } from '@/utils/id';
import { monthKeyOf } from '@/utils/period';
import type {
  AntennaId,
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
import type { Repository } from './repository';
import { mutateStore, readStore } from './localStore';

/**
 * The local store. Used when no Supabase configuration is present, so the app
 * can be opened and written in before anything is connected.
 *
 * The アンテナ tree is not stored: it is the same for everyone and comes from
 * the preview, so it is read straight out of the generated module rather than
 * seeded into rows that could drift from it.
 */
export class LocalRepository implements Repository {
  async ensureBootstrapped(): Promise<void> {
    await readStore();
  }

  // -- ビジョンボード -------------------------------------------------------

  async listVisionItems(): Promise<VisionItem[]> {
    const store = await readStore();
    return [...store.visionItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listVisionWords(): Promise<VisionWord[]> {
    const store = await readStore();
    return [...store.visionWords].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addVisionItem(text: string): Promise<VisionItem> {
    const item: VisionItem = { id: uuid(), text: text.trim(), sortOrder: 0 };
    await mutateStore((store) => {
      item.sortOrder = store.visionItems.length;
      return { ...store, visionItems: [...store.visionItems, item] };
    });
    return item;
  }

  async addVisionWord(text: string): Promise<VisionWord> {
    const word: VisionWord = { id: uuid(), text: text.trim(), sortOrder: 0 };
    await mutateStore((store) => {
      word.sortOrder = store.visionWords.length;
      return { ...store, visionWords: [...store.visionWords, word] };
    });
    return word;
  }

  async removeVisionItem(id: string): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      visionItems: store.visionItems.filter((v) => v.id !== id),
    }));
  }

  async removeVisionWord(id: string): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      visionWords: store.visionWords.filter((v) => v.id !== id),
    }));
  }

  // -- 方向 -----------------------------------------------------------------

  async getYearDirection(year: number): Promise<YearDirection | null> {
    const store = await readStore();
    return store.yearDirections.find((d) => d.year === year) ?? null;
  }

  /**
   * Replacing a direction keeps the old one. Changing your mind mid-year is
   * part of the year, and a history that quietly overwrites itself cannot show
   * that it happened.
   */
  async saveYearDirection(input: {
    year: number;
    direction: string;
    keywords?: string[];
    answers?: string[];
  }): Promise<YearDirection> {
    const next: YearDirection = {
      year: input.year,
      direction: input.direction.trim(),
      keywords: input.keywords ?? [],
      answers: input.answers ?? [],
      updatedAt: new Date().toISOString(),
    };
    await mutateStore((store) => {
      const previous = store.yearDirections.find((d) => d.year === input.year);
      const history =
        previous && previous.direction !== next.direction
          ? [
              ...store.yearDirectionHistory,
              {
                id: uuid(),
                year: previous.year,
                direction: previous.direction,
                replacedAt: next.updatedAt,
              },
            ]
          : store.yearDirectionHistory;
      return {
        ...store,
        yearDirectionHistory: history,
        yearDirections: [...store.yearDirections.filter((d) => d.year !== input.year), next],
      };
    });
    return next;
  }

  async listYearDirectionHistory(year: number): Promise<YearDirectionChange[]> {
    const store = await readStore();
    return store.yearDirectionHistory
      .filter((h) => h.year === year)
      .sort((a, b) => b.replacedAt.localeCompare(a.replacedAt));
  }

  async getMonthDirection(periodKey: string): Promise<MonthDirection | null> {
    const store = await readStore();
    return store.monthDirections.find((d) => d.periodKey === periodKey) ?? null;
  }

  async saveMonthDirection(periodKey: string, antennaIds: string[]): Promise<MonthDirection> {
    const next: MonthDirection = {
      periodKey,
      antennaIds: antennaIds.filter(isAntennaId).slice(0, 2),
      updatedAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({
      ...store,
      monthDirections: [
        ...store.monthDirections.filter((d) => d.periodKey !== periodKey),
        next,
      ],
    }));
    return next;
  }

  // -- カテゴリー -----------------------------------------------------------

  async listCategories(): Promise<Category[]> {
    return CATEGORIES;
  }

  async listCategoryDetails(categoryId: string): Promise<CategoryDetail[]> {
    return DETAILS.filter((d) => d.categoryId === categoryId);
  }

  // -- 記録 -----------------------------------------------------------------

  async firstRecordedPeriod(): Promise<string | null> {
    const store = await readStore();
    if (store.logs.length === 0) return null;
    return store.logs.reduce((min, l) => (l.periodKey < min ? l.periodKey : min), store.logs[0]!.periodKey);
  }

  async listLogs(periodKey: string): Promise<JournalLog[]> {
    const store = await readStore();
    return store.logs.filter((l) => l.periodKey === periodKey).sort(byNewest);
  }

  async listLogsInYear(year: number): Promise<JournalLog[]> {
    const store = await readStore();
    const prefix = String(year);
    return store.logs.filter((l) => l.periodKey.startsWith(prefix)).sort(byNewest);
  }

  async getLogs(ids: string[]): Promise<JournalLog[]> {
    const store = await readStore();
    const wanted = new Set(ids);
    return store.logs.filter((l) => wanted.has(l.id)).sort(byNewest);
  }

  async createLog(input: NewLogInput): Promise<JournalLog> {
    const log: JournalLog = {
      id: uuid(),
      userId: 'local',
      occurredOn: input.occurredOn ?? null,
      periodKey: input.periodKey || monthKeyOf(new Date()),
      body: input.body.trim(),
      categoryId: input.categoryId ?? null,
      detailId: input.detailId ?? null,
      inputMethod: input.inputMethod ?? 'typed',
      source: input.source ?? 'manual',
      sourceId: input.sourceId ?? null,
      createdAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({ ...store, logs: [log, ...store.logs] }));
    return log;
  }

  async deleteLog(id: string): Promise<void> {
    await mutateStore((store) => ({ ...store, logs: store.logs.filter((l) => l.id !== id) }));
  }

  // -- 未来メモ -------------------------------------------------------------

  async listFutureMemos(): Promise<FutureMemo[]> {
    const store = await readStore();
    return [...store.futureMemos]
      .filter((m) => m.status !== 'trashed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createFutureMemo(input: NewFutureMemoInput): Promise<FutureMemo> {
    const dateKind = input.dateKind ?? 'none';
    const memo: FutureMemo = {
      id: uuid(),
      type: input.type,
      title: input.title.trim(),
      memo: input.memo?.trim() ?? '',
      // 'いつでも' carries no date; keeping one would show a deadline nobody set.
      targetDate: dateKind === 'none' ? null : (input.targetDate ?? null),
      dateKind,
      favorite: input.favorite ?? false,
      status: 'future',
      completedAt: null,
      heartTags: [],
      createdAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({ ...store, futureMemos: [memo, ...store.futureMemos] }));
    return memo;
  }

  async updateFutureMemo(id: string, patch: Partial<FutureMemo>): Promise<FutureMemo> {
    let updated: FutureMemo | undefined;
    await mutateStore((store) => ({
      ...store,
      futureMemos: store.futureMemos.map((m) => {
        if (m.id !== id) return m;
        updated = { ...m, ...patch, id: m.id };
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Future memo not found: ${id}`);
    return updated;
  }

  // -- 感情クエスト ---------------------------------------------------------

  async lastFlowSession(): Promise<FlowSession | null> {
    const store = await readStore();
    return (
      [...store.flowSessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  async saveFlowSession(entries: Partial<Record<FlowStage, string>>): Promise<FlowSession> {
    const session: FlowSession = { id: uuid(), entries, createdAt: new Date().toISOString() };
    await mutateStore((store) => ({ ...store, flowSessions: [session, ...store.flowSessions] }));
    return session;
  }

  // -- 読み取り -------------------------------------------------------------

  async getSummary(periodType: PeriodType, periodKey: string): Promise<PeriodSummary | null> {
    const store = await readStore();
    return (
      store.summaries.find((s) => s.periodType === periodType && s.periodKey === periodKey) ?? null
    );
  }

  async saveOwnSummary(input: {
    periodType: PeriodType;
    periodKey: string;
    bodyUser: string;
  }): Promise<PeriodSummary> {
    let saved: PeriodSummary | undefined;
    await mutateStore((store) => {
      const existing = store.summaries.find(
        (s) => s.periodType === input.periodType && s.periodKey === input.periodKey
      );
      // Only the person's half changes. Whatever the reading wrote stays put.
      saved = {
        periodType: input.periodType,
        periodKey: input.periodKey,
        keywords: existing?.keywords ?? [],
        body: existing?.body ?? '',
        bodyUser: input.bodyUser.trim(),
        updatedAt: new Date().toISOString(),
      };
      return {
        ...store,
        summaries: [
          ...store.summaries.filter(
            (s) => !(s.periodType === input.periodType && s.periodKey === input.periodKey)
          ),
          saved,
        ],
      };
    });
    return saved!;
  }

  async listMonthInsights(periodKey: string): Promise<MonthInsight[]> {
    const store = await readStore();
    return store.monthInsights.filter((i) => i.periodKey === periodKey);
  }

  async getMonthHypothesis(periodKey: string): Promise<MonthHypothesis | null> {
    const store = await readStore();
    return store.monthHypotheses.find((h) => h.periodKey === periodKey) ?? null;
  }

  // -- 足跡タイトル ---------------------------------------------------------

  async listPeriodTitles(periodType: PeriodType): Promise<PeriodTitle[]> {
    const store = await readStore();
    return store.periodTitles
      .filter((t) => t.periodType === periodType)
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  }

  async savePeriodTitle(input: {
    periodType: PeriodType;
    periodKey: string;
    title: string;
    source?: 'manual' | 'ai';
  }): Promise<PeriodTitle> {
    const next: PeriodTitle = {
      periodType: input.periodType,
      periodKey: input.periodKey,
      title: input.title.trim(),
      source: input.source ?? 'manual',
      updatedAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({
      ...store,
      periodTitles: [
        ...store.periodTitles.filter(
          (t) => !(t.periodType === next.periodType && t.periodKey === next.periodKey)
        ),
        next,
      ],
    }));
    return next;
  }
}

function byNewest(a: JournalLog, b: JournalLog): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function isAntennaId(value: string): value is AntennaId {
  return (ANTENNA_ORDER as readonly string[]).includes(value);
}

/** The アンテナ tree, flattened once at module load. */
const CATEGORIES: Category[] = ANTENNA_ORDER.flatMap((antennaId, antennaIndex) =>
  ANTENNAS[antennaId].categories.map((category, index) => ({
    id: category.id,
    antennaId,
    label: category.label,
    detailQuestion: category.detailQuestion,
    sortOrder: antennaIndex * 100 + index,
    isActive: true,
  }))
);

const DETAILS: CategoryDetail[] = ANTENNA_ORDER.flatMap((antennaId) =>
  ANTENNAS[antennaId].categories.flatMap((category) =>
    category.details.map((detail, index) => ({
      id: detail.id,
      categoryId: category.id,
      label: detail.label,
      sortOrder: index,
    }))
  )
);
