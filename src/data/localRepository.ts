import { uuid } from '@/utils/id';
import { monthKeyOfDate, yearKeyOfDate } from '@/utils/period';
import { maturityCeiling, minMaturity, summariseEvidencePath } from '@/ai/progressionRules';
import { mutateStore, readStore } from './localStore';
import type { Repository } from './repository';
import type {
  DailyLog,
  Gain,
  LogAnalysis,
  LogWithAnalysis,
  MonthProgression,
  MonthReview,
  MonthTheme,
  NewLogInput,
  Progression,
  ProgressionDetail,
  ProgressionEvidence,
  ProgressionMaturity,
  ProgressionRef,
  ProgressionStep,
  ProgressionVerdict,
  YearDirection,
  YearReview,
} from '@/types';

const LOCAL_USER = 'local';

function byNewestFirst(a: DailyLog, b: DailyLog): number {
  return b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt);
}

/** Merged progressions resolve to whatever now stands for them. */
function resolveMerged(progression: Progression, byId: Map<string, Progression>): Progression {
  const seen = new Set<string>();
  let current = progression;
  while (current.mergedIntoId && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.mergedIntoId);
    if (!next) break;
    current = next;
  }
  return current;
}

/**
 * On-device store.
 *
 * Used when the project has no Supabase configuration, and as the place the
 * offline reading writes to so the map keeps working with no backend at all.
 * Every method the Edge Functions would normally own is present here too, in a
 * model-free form.
 */
export class LocalRepository implements Repository {
  readonly name = 'local' as const;

  async ensureBootstrapped(): Promise<void> {
    await readStore();
  }

  // -------------------------------------------------------------------------
  // The lens
  // -------------------------------------------------------------------------

  async getYearDirection(year: number): Promise<YearDirection | null> {
    const store = await readStore();
    return store.yearDirections.find((d) => d.year === year) ?? null;
  }

  async saveYearDirection(input: {
    year: number;
    selectedAreas: string[];
    desiredSelfCards: string[];
    progressionLenses: string[];
    initialTheme?: string;
    finalTheme?: string;
  }): Promise<YearDirection> {
    const store = await readStore();
    const existing = store.yearDirections.find((d) => d.year === input.year);
    const next: YearDirection = {
      id: existing?.id ?? uuid(),
      userId: LOCAL_USER,
      year: input.year,
      selectedAreas: input.selectedAreas,
      desiredSelfCards: input.desiredSelfCards,
      progressionLenses: input.progressionLenses,
      // A year's opening theme is written once; a later save must not quietly
      // erase it, because the year-end reading compares against it (§26).
      initialTheme: input.initialTheme ?? existing?.initialTheme,
      finalTheme: input.finalTheme ?? existing?.finalTheme,
    };
    await mutateStore((current) => ({
      ...current,
      yearDirections: [...current.yearDirections.filter((d) => d.year !== input.year), next],
    }));
    return next;
  }

  async getMonthTheme(year: number, month: number): Promise<MonthTheme | null> {
    const store = await readStore();
    return store.monthThemes.find((t) => t.year === year && t.month === month) ?? null;
  }

  async listMonthThemes(year: number): Promise<MonthTheme[]> {
    const store = await readStore();
    return store.monthThemes.filter((t) => t.year === year).sort((a, b) => a.month - b.month);
  }

  async saveMonthTheme(input: {
    year: number;
    month: number;
    initialTheme?: string;
    finalTheme?: string;
    source: MonthTheme['source'];
    candidates?: MonthTheme['candidates'];
  }): Promise<MonthTheme> {
    const store = await readStore();
    const existing = store.monthThemes.find(
      (t) => t.year === input.year && t.month === input.month
    );
    const next: MonthTheme = {
      id: existing?.id ?? uuid(),
      userId: LOCAL_USER,
      year: input.year,
      month: input.month,
      initialTheme: input.initialTheme ?? existing?.initialTheme,
      finalTheme: input.finalTheme ?? existing?.finalTheme,
      source: input.source,
      candidates: input.candidates ?? existing?.candidates ?? [],
    };
    await mutateStore((current) => ({
      ...current,
      monthThemes: [
        ...current.monthThemes.filter((t) => !(t.year === input.year && t.month === input.month)),
        next,
      ],
    }));
    return next;
  }

  // -------------------------------------------------------------------------
  // Daily evidence
  // -------------------------------------------------------------------------

  async listLogsByMonth(monthKey: string): Promise<LogWithAnalysis[]> {
    const store = await readStore();
    return store.logs
      .filter((l) => monthKeyOfDate(l.occurredOn) === monthKey)
      .sort(byNewestFirst)
      .map((l) => ({ ...l, analysis: store.analyses[l.id] }));
  }

  async listLogsByYear(yearKey: string): Promise<LogWithAnalysis[]> {
    const store = await readStore();
    return store.logs
      .filter((l) => yearKeyOfDate(l.occurredOn) === yearKey)
      .sort(byNewestFirst)
      .map((l) => ({ ...l, analysis: store.analyses[l.id] }));
  }

  async getLog(id: string): Promise<LogWithAnalysis | null> {
    const store = await readStore();
    const log = store.logs.find((l) => l.id === id);
    if (!log) return null;

    const byId = new Map(store.progressions.map((p) => [p.id, p]));
    const refs: ProgressionRef[] = [];
    for (const row of store.evidence.filter((e) => e.logId === id)) {
      const progression = byId.get(row.progressionId);
      if (!progression) continue;
      const resolved = resolveMerged(progression, byId);
      if (refs.some((r) => r.id === resolved.id)) continue;
      refs.push({ id: resolved.id, title: resolved.title, role: row.role });
    }

    return { ...log, analysis: store.analyses[id], progressions: refs };
  }

  async createLog(input: NewLogInput): Promise<DailyLog> {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const log: DailyLog = {
      id: uuid(),
      userId: LOCAL_USER,
      occurredAt,
      occurredOn: occurredAt.slice(0, 10),
      logType: input.logType,
      momentTags: input.momentTags,
      aiQuestion: input.aiQuestion,
      optionalAnswer: input.optionalAnswer,
      createdAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({ ...store, logs: [log, ...store.logs] }));
    return log;
  }

  async deleteLog(id: string): Promise<void> {
    await mutateStore((store) => {
      const { [id]: _removed, ...analyses } = store.analyses;
      return {
        ...store,
        logs: store.logs.filter((l) => l.id !== id),
        analyses,
        evidence: store.evidence.filter((e) => e.logId !== id),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Progression
  // -------------------------------------------------------------------------

  async listProgressions(): Promise<Progression[]> {
    const store = await readStore();
    const byId = new Map(store.progressions.map((p) => [p.id, p]));
    const out = new Map<string, Progression>();
    for (const p of store.progressions) {
      const resolved = resolveMerged(p, byId);
      out.set(resolved.id, resolved);
    }
    return [...out.values()].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  }

  async listMonthProgressions(monthKey: string): Promise<MonthProgression[]> {
    const store = await readStore();
    const byId = new Map(store.progressions.map((p) => [p.id, p]));

    const monthLogIds = new Set(
      store.logs.filter((l) => monthKeyOfDate(l.occurredOn) === monthKey).map((l) => l.id)
    );
    const monthEnd = `${monthKey}-32`;

    const grouped = new Map<string, { evidenceLogIds: string[]; progression: Progression }>();
    for (const row of store.evidence) {
      if (!monthLogIds.has(row.logId)) continue;
      const raw = byId.get(row.progressionId);
      if (!raw) continue;
      const progression = resolveMerged(raw, byId);
      const bucket = grouped.get(progression.id) ?? { evidenceLogIds: [], progression };
      if (!bucket.evidenceLogIds.includes(row.logId)) bucket.evidenceLogIds.push(row.logId);
      grouped.set(progression.id, bucket);
    }

    return [...grouped.values()]
      .map(({ progression, evidenceLogIds }) => {
        // Where it had got to by the end of that month, not today.
        const pathSoFar = store.evidence
          .filter((e) => e.progressionId === progression.id && e.occurredAt.slice(0, 10) < monthEnd)
          .map((e) => ({ logId: e.logId, role: e.role, occurredAt: e.occurredAt }));
        const maturityThen: ProgressionMaturity = minMaturity(
          progression.maturity,
          maturityCeiling(summariseEvidencePath(pathSoFar))
        );

        return {
          progression,
          evidenceLogIds,
          isNew: monthKeyOfDate(progression.firstDetectedAt.slice(0, 10)) === monthKey,
          maturityThen,
        };
      })
      .sort((a, b) => b.progression.confidence - a.progression.confidence);
  }

  async getProgressionDetail(id: string): Promise<ProgressionDetail | null> {
    const store = await readStore();
    const byId = new Map(store.progressions.map((p) => [p.id, p]));
    const raw = byId.get(id);
    if (!raw) return null;
    const progression = resolveMerged(raw, byId);

    const absorbed = new Set(
      store.progressions.filter((p) => resolveMerged(p, byId).id === progression.id).map((p) => p.id)
    );

    const logsById = new Map(store.logs.map((l) => [l.id, l]));
    const steps: ProgressionStep[] = store.evidence
      .filter((e) => absorbed.has(e.progressionId))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .flatMap((row) => {
        const log = logsById.get(row.logId);
        if (!log) return [];
        return [
          {
            logId: log.id,
            occurredOn: log.occurredOn,
            role: row.role,
            eventSummary: store.analyses[log.id]?.eventSummary ?? fallbackSummary(log),
            logType: log.logType,
            momentTags: log.momentTags,
          },
        ];
      });

    return {
      progression,
      steps,
      gains: store.gains.filter((g) => g.progressionId != null && absorbed.has(g.progressionId)),
    };
  }

  async setProgressionVerdict(input: {
    progressionId: string;
    verdict: ProgressionVerdict;
    title?: string;
    summary?: string;
  }): Promise<Progression> {
    const rewrote = input.verdict === 'adjusted' && Boolean(input.title || input.summary);
    const store = await mutateStore((current) => ({
      ...current,
      progressions: current.progressions.map((p) =>
        p.id === input.progressionId
          ? {
              ...p,
              verdict: input.verdict,
              ...(input.title ? { title: input.title } : {}),
              ...(input.summary ? { summary: input.summary } : {}),
              userEdited: p.userEdited || rewrote,
              lastUpdatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
    const updated = store.progressions.find((p) => p.id === input.progressionId);
    if (!updated) throw new Error('progression not found');
    return updated;
  }

  async listGains(): Promise<Gain[]> {
    const store = await readStore();
    return store.gains;
  }

  // -------------------------------------------------------------------------
  // Month & year
  // -------------------------------------------------------------------------

  /** No model on this path, so a month has no brief and says so by absence. */
  /**
   * The local store never publishes changes.
   *
   * Reading a month into changes needs the whole archive and a model; the
   * offline path has neither. An empty month is the honest answer and is the
   * same one a month nothing has read yet gives — so the screen has one state
   * to handle rather than two.
   */
  async listMonthChanges(): Promise<never[]> {
    return [];
  }

  async setChangeVerdict(): Promise<never> {
    throw new Error('この端末では、変化に返事を書けません。');
  }

  async getMonthMap(): Promise<null> {
    return null;
  }

  async getMonthReview(periodKey: string): Promise<MonthReview | null> {
    const store = await readStore();
    return store.reviews.find((r) => r.periodKey === periodKey) ?? null;
  }

  async listMonthReviews(yearKey: string): Promise<MonthReview[]> {
    const store = await readStore();
    return store.reviews.filter((r) => r.periodKey.startsWith(`${yearKey}-`));
  }

  async saveMonthReview(review: MonthReview): Promise<MonthReview> {
    await mutateStore((store) => ({
      ...store,
      reviews: [...store.reviews.filter((r) => r.periodKey !== review.periodKey), review],
    }));
    return review;
  }

  async getYearReview(year: number): Promise<YearReview | null> {
    const store = await readStore();
    return store.yearReviews.find((r) => r.year === year) ?? null;
  }

  async saveYearReview(review: YearReview): Promise<YearReview> {
    await mutateStore((store) => ({
      ...store,
      yearReviews: [...store.yearReviews.filter((r) => r.year !== review.year), review],
    }));
    return review;
  }

  // -------------------------------------------------------------------------
  // Written by the offline reading only (src/ai/localAnalysis.ts).
  // -------------------------------------------------------------------------

  async saveAnalysis(analysis: LogAnalysis): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      analyses: { ...store.analyses, [analysis.logId]: analysis },
    }));
  }

  async upsertProgression(draft: {
    type: Progression['type'];
    pattern?: Progression['pattern'];
    title: string;
    summary: string;
    confidence: number;
    goalExternal: boolean;
    occurredAt: string;
  }): Promise<Progression> {
    const store = await readStore();
    const existing = store.progressions.find(
      (p) => p.type === draft.type && p.title === draft.title && !p.mergedIntoId
    );

    if (existing) {
      const next: Progression = {
        ...existing,
        ...(existing.userEdited ? {} : { summary: draft.summary || existing.summary }),
        pattern: existing.pattern ?? draft.pattern,
        confidence: Math.max(existing.confidence, draft.confidence),
        lastUpdatedAt: draft.occurredAt,
      };
      await mutateStore((current) => ({
        ...current,
        progressions: current.progressions.map((p) => (p.id === next.id ? next : p)),
      }));
      return next;
    }

    const created: Progression = {
      id: uuid(),
      userId: LOCAL_USER,
      type: draft.type,
      pattern: draft.pattern,
      title: draft.title,
      summary: draft.summary,
      maturity: 'signal',
      confidence: draft.confidence,
      goalExternal: draft.goalExternal,
      firstDetectedAt: draft.occurredAt,
      lastUpdatedAt: draft.occurredAt,
      userEdited: false,
      evidenceCount: 0,
    };
    await mutateStore((current) => ({
      ...current,
      progressions: [...current.progressions, created],
    }));
    return created;
  }

  async addEvidence(rows: readonly Omit<ProgressionEvidence, 'id'>[]): Promise<void> {
    if (rows.length === 0) return;
    await mutateStore((store) => {
      const evidence = [...store.evidence];
      for (const row of rows) {
        const already = evidence.some(
          (e) => e.progressionId === row.progressionId && e.logId === row.logId
        );
        if (already) continue;
        evidence.push({ id: uuid(), ...row });
      }
      return { ...store, evidence };
    });
    await this.recountEvidence();
  }

  /**
   * Recomputes evidenceCount and re-clamps maturity from what is stored. The
   * ceiling is the same function the Edge Function uses, so the offline path
   * can never make a louder claim than the online one.
   */
  async recountEvidence(): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      progressions: store.progressions.map((p) => {
        const path = store.evidence
          .filter((e) => e.progressionId === p.id)
          .map((e) => ({ logId: e.logId, role: e.role, occurredAt: e.occurredAt }));
        const summary = summariseEvidencePath(path);
        return {
          ...p,
          evidenceCount: summary.distinctLogCount,
          maturity: minMaturity(p.maturity, maturityCeiling(summary)),
        };
      }),
    }));
  }
}

/**
 * What to show for a record the reading never got to.
 *
 * A v4 record may have no free text at all, so the tags are the only thing
 * there is to name it by; the caller turns the ids into words.
 */
function fallbackSummary(log: DailyLog): string {
  return log.optionalAnswer?.slice(0, 80) ?? log.body?.slice(0, 80) ?? '';
}
