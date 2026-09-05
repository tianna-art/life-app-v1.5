import { uuid } from '@/utils/id';
import { monthKeyOfDate, yearKeyOfDate } from '@/utils/period';
import { maturityCeiling, minMaturity, summariseEvidencePath } from '@/ai/progressionRules';
import { mutateStore, readStore } from './localStore';
import type { Repository } from './repository';
import type {
  Clarification,
  EntryAnalysis,
  EntryWithAnalysis,
  Gain,
  JournalEntry,
  MonthProgression,
  MonthReview,
  NewEntryInput,
  Progression,
  ProgressionDetail,
  ProgressionEvidence,
  ProgressionMaturity,
  ProgressionRef,
  ProgressionStep,
  ProgressionVerdict,
} from '@/types';

const LOCAL_USER = 'local';

function byNewestFirst(a: JournalEntry, b: JournalEntry): number {
  return b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt);
}

/** Merged progressions resolve to whatever now stands for them (§30). */
function resolveMerged(
  progression: Progression,
  byId: Map<string, Progression>
): Progression {
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

  async listEntriesByMonth(monthKey: string): Promise<EntryWithAnalysis[]> {
    const store = await readStore();
    return store.entries
      .filter((e) => monthKeyOfDate(e.occurredOn) === monthKey)
      .sort(byNewestFirst)
      .map((e) => ({ ...e, analysis: store.analyses[e.id] }));
  }

  async listEntriesByYear(yearKey: string): Promise<EntryWithAnalysis[]> {
    const store = await readStore();
    return store.entries
      .filter((e) => yearKeyOfDate(e.occurredOn) === yearKey)
      .sort(byNewestFirst)
      .map((e) => ({ ...e, analysis: store.analyses[e.id] }));
  }

  async getEntry(id: string): Promise<EntryWithAnalysis | null> {
    const store = await readStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return null;

    const byId = new Map(store.progressions.map((p) => [p.id, p]));
    const refs: ProgressionRef[] = [];
    for (const row of store.evidence.filter((e) => e.logId === id)) {
      const progression = byId.get(row.progressionId);
      if (!progression) continue;
      const resolved = resolveMerged(progression, byId);
      if (refs.some((r) => r.id === resolved.id)) continue;
      refs.push({ id: resolved.id, title: resolved.title, role: row.role });
    }

    return { ...entry, analysis: store.analyses[id], progressions: refs };
  }

  async createEntry(input: NewEntryInput): Promise<JournalEntry> {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const entry: JournalEntry = {
      id: uuid(),
      userId: LOCAL_USER,
      occurredAt,
      occurredOn: occurredAt.slice(0, 10),
      type: input.type,
      body: input.body,
      subjectiveSignal: input.subjectiveSignal,
      createdAt: new Date().toISOString(),
    };
    await mutateStore((store) => ({ ...store, entries: [entry, ...store.entries] }));
    return entry;
  }

  async deleteEntry(id: string): Promise<void> {
    await mutateStore((store) => {
      const { [id]: _removed, ...analyses } = store.analyses;
      return {
        ...store,
        entries: store.entries.filter((e) => e.id !== id),
        analyses,
        evidence: store.evidence.filter((e) => e.logId !== id),
        clarifications: store.clarifications.filter((c) => c.logId !== id),
      };
    });
  }

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
      store.entries.filter((e) => monthKeyOfDate(e.occurredOn) === monthKey).map((e) => e.id)
    );
    const monthEnd = `${monthKey}-32`; // string-compares after every day in the month

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
        // §24: show where it had got to by the end of that month, not today.
        const pathSoFar = store.evidence
          .filter((e) => e.progressionId === progression.id && e.occurredAt.slice(0, 10) < monthEnd)
          .map((e) => ({ logId: e.logId, role: e.role, occurredAt: e.occurredAt }));
        const maturityThen: ProgressionMaturity = minMaturity(
          progression.maturity,
          maturityCeiling(summariseEvidencePath(pathSoFar))
        );

        const firstMonth = monthKeyOfDate(progression.firstDetectedAt.slice(0, 10));
        return {
          progression,
          evidenceLogIds,
          isNew: firstMonth === monthKey,
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

    // Evidence from absorbed progressions belongs to the survivor.
    const absorbed = new Set(
      store.progressions
        .filter((p) => resolveMerged(p, byId).id === progression.id)
        .map((p) => p.id)
    );

    const entriesById = new Map(store.entries.map((e) => [e.id, e]));
    const steps: ProgressionStep[] = store.evidence
      .filter((e) => absorbed.has(e.progressionId))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .flatMap((row) => {
        const entry = entriesById.get(row.logId);
        if (!entry) return [];
        return [
          {
            logId: entry.id,
            occurredOn: entry.occurredOn,
            role: row.role,
            eventSummary: store.analyses[entry.id]?.eventSummary ?? entry.body.slice(0, 80),
            entryType: entry.type,
            subjectiveSignal: entry.subjectiveSignal,
          },
        ];
      });

    const gains = store.gains.filter((g) => absorbed.has(g.progressionId));

    return { progression, steps, gains };
  }

  async setProgressionVerdict(input: {
    progressionId: string;
    verdict: ProgressionVerdict;
    title?: string;
    summary?: string;
  }): Promise<Progression> {
    const edited = input.verdict === 'adjusted' && (input.title || input.summary);
    const store = await mutateStore((current) => ({
      ...current,
      progressions: current.progressions.map((p) =>
        p.id === input.progressionId
          ? {
              ...p,
              verdict: input.verdict,
              ...(input.title ? { title: input.title } : {}),
              ...(input.summary ? { summary: input.summary } : {}),
              userEdited: p.userEdited || Boolean(edited),
              lastUpdatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
    const updated = store.progressions.find((p) => p.id === input.progressionId);
    if (!updated) throw new Error('progression not found');
    return updated;
  }

  async getPendingClarification(): Promise<Clarification | null> {
    const store = await readStore();
    return store.clarifications.find((c) => c.answer === undefined) ?? null;
  }

  async answerClarification(input: { id: string; answer: string | null }): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      // A skip is stored as an empty answer, so the question is not asked twice.
      clarifications: store.clarifications.map((c) =>
        c.id === input.id ? { ...c, answer: input.answer ?? '' } : c
      ),
    }));
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

  // -------------------------------------------------------------------------
  // Written by the offline reading only (src/ai/localAnalysis.ts).
  // -------------------------------------------------------------------------

  async saveAnalysis(analysis: EntryAnalysis): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      analyses: { ...store.analyses, [analysis.logId]: analysis },
    }));
  }

  /** Creates or refreshes a progression, keyed on (type, title) as in SQL. */
  async upsertProgression(draft: {
    type: Progression['type'];
    title: string;
    fromState?: string | undefined;
    currentState?: string | undefined;
    summary: string;
    maturity: ProgressionMaturity;
    confidence: number;
    occurredAt: string;
  }): Promise<Progression> {
    const store = await readStore();
    const existing = store.progressions.find(
      (p) => p.type === draft.type && p.title === draft.title && !p.mergedIntoId
    );

    if (existing) {
      const next: Progression = {
        ...existing,
        // The person's wording outranks the model's once they have edited it.
        ...(existing.userEdited
          ? {}
          : {
              summary: draft.summary || existing.summary,
              ...(draft.currentState ? { currentState: draft.currentState } : {}),
            }),
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
      title: draft.title,
      ...(draft.fromState ? { fromState: draft.fromState } : {}),
      ...(draft.currentState ? { currentState: draft.currentState } : {}),
      summary: draft.summary,
      maturity: draft.maturity,
      confidence: draft.confidence,
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
   * Recomputes evidenceCount and re-clamps maturity from what is actually
   * stored. The ceiling is the same function the Edge Function uses, so the
   * offline path can never make a louder claim than the online one.
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

  async addGain(gain: Omit<Gain, 'id'>): Promise<Gain> {
    const created: Gain = { id: uuid(), ...gain };
    await mutateStore((store) => {
      const existing = store.gains.find(
        (g) => g.progressionId === gain.progressionId && g.label === gain.label
      );
      if (existing) {
        return {
          ...store,
          gains: store.gains.map((g) =>
            g.id === existing.id ? { ...g, lastDetectedAt: gain.lastDetectedAt } : g
          ),
        };
      }
      return { ...store, gains: [...store.gains, created] };
    });
    return created;
  }

  async addClarification(clarification: Omit<Clarification, 'id'>): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      clarifications: store.clarifications.some((c) => c.logId === clarification.logId)
        ? store.clarifications
        : [...store.clarifications, { id: uuid(), ...clarification }],
    }));
  }

  async mergeProgressions(sourceId: string, targetId: string): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      progressions: store.progressions.map((p) =>
        p.id === sourceId ? { ...p, mergedIntoId: targetId } : p
      ),
    }));
    await this.recountEvidence();
  }
}
