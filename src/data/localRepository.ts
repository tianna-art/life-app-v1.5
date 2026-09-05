import type {
  EntryAnalysis,
  EntryWithAnalysis,
  Gain,
  GainDetail,
  GainEvidence,
  GainFormationStep,
  GainVerdict,
  JournalEntry,
  JourneyLink,
  MonthReview,
  NewEntryInput,
} from '@/types';
import { uuid } from '@/utils/id';
import { monthKeyOfDate, yearKeyOfDate } from '@/utils/period';
import type { LocalStoreShape } from './localStore';
import { mutateStore, readStore } from './localStore';
import type { MonthGain, Repository } from './repository';

export const LOCAL_USER_ID = 'local-user';

function withAnalysis(store: LocalStoreShape, entry: JournalEntry): EntryWithAnalysis {
  const analysis = store.analyses[entry.id];
  return analysis ? { ...entry, analysis } : { ...entry };
}

function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
  );
}

function resolveMerged(gain: Gain, byId: Map<string, Gain>): Gain {
  let current = gain;
  const seen = new Set<string>([current.id]);
  while (current.mergedIntoId) {
    const next = byId.get(current.mergedIntoId);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    current = next;
  }
  return current;
}

/**
 * On-device repository. Used when Supabase is not configured, and as the
 * durable mirror behind the offline queue. It stores exactly what the Edge
 * Function would have stored, so the screens cannot tell the two apart.
 */
export class LocalRepository implements Repository {
  readonly name = 'local' as const;

  async ensureBootstrapped(): Promise<void> {
    // Nothing to seed: the person configures nothing before writing.
  }

  async listEntriesByMonth(monthKey: string): Promise<EntryWithAnalysis[]> {
    const store = await readStore();
    return sortEntries(store.entries.filter((e) => monthKeyOfDate(e.occurredOn) === monthKey)).map(
      (e) => withAnalysis(store, e)
    );
  }

  async listEntriesByYear(yearKey: string): Promise<EntryWithAnalysis[]> {
    const store = await readStore();
    return sortEntries(store.entries.filter((e) => yearKeyOfDate(e.occurredOn) === yearKey)).map(
      (e) => withAnalysis(store, e)
    );
  }

  async getEntry(id: string): Promise<EntryWithAnalysis | null> {
    const store = await readStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return null;
    const byId = new Map(store.gains.map((g) => [g.id, g]));
    const gains = store.evidence
      .filter((e) => e.logId === id)
      .map((e) => byId.get(e.gainId))
      .filter((g): g is Gain => Boolean(g))
      .map((g) => resolveMerged(g, byId));
    const unique = new Map(gains.map((g) => [g.id, g]));
    return { ...withAnalysis(store, entry), gains: [...unique.values()] };
  }

  async createEntry(input: NewEntryInput): Promise<JournalEntry> {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const entry: JournalEntry = {
      id: uuid(),
      userId: LOCAL_USER_ID,
      occurredAt,
      occurredOn: occurredAt.slice(0, 10),
      inputCategory: input.inputCategory,
      body: input.body.trim(),
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
        links: store.links.filter((l) => l.fromLogId !== id && l.toLogId !== id),
      };
    });
  }

  async listGains(): Promise<Gain[]> {
    const store = await readStore();
    return store.gains
      .filter((g) => !g.mergedIntoId)
      .sort((a, b) => b.lastDetectedAt.localeCompare(a.lastDetectedAt));
  }

  async listMonthGains(monthKey: string): Promise<MonthGain[]> {
    const store = await readStore();
    const monthLogIds = new Set(
      store.entries.filter((e) => monthKeyOfDate(e.occurredOn) === monthKey).map((e) => e.id)
    );
    if (monthLogIds.size === 0) return [];

    const byId = new Map(store.gains.map((g) => [g.id, g]));
    const grouped = new Map<string, Set<string>>();
    for (const evidence of store.evidence) {
      if (!monthLogIds.has(evidence.logId)) continue;
      const source = byId.get(evidence.gainId);
      if (!source) continue;
      const target = resolveMerged(source, byId);
      const set = grouped.get(target.id) ?? new Set<string>();
      set.add(evidence.logId);
      grouped.set(target.id, set);
    }

    return [...grouped.entries()]
      .map(([gainId, ids]) => {
        const gain = byId.get(gainId);
        if (!gain) return null;
        return {
          gain,
          evidenceLogIds: [...ids],
          isNew: gain.firstDetectedAt.slice(0, 7) === monthKey,
        } satisfies MonthGain;
      })
      .filter((g): g is MonthGain => g !== null);
  }

  async getGainDetail(gainId: string): Promise<GainDetail | null> {
    const store = await readStore();
    const gain = store.gains.find((g) => g.id === gainId);
    if (!gain) return null;
    const entryById = new Map(store.entries.map((e) => [e.id, e]));

    const formation: GainFormationStep[] = store.evidence
      .filter((e) => e.gainId === gainId)
      .map((evidence) => {
        const entry = entryById.get(evidence.logId);
        if (!entry) return null;
        const analysis = store.analyses[evidence.logId];
        return {
          logId: evidence.logId,
          occurredOn: entry.occurredOn,
          journeyRole: analysis?.journeyRole ?? 'neutral',
          eventSummary: analysis?.eventSummary || entry.body,
          relation: evidence.relation,
        } satisfies GainFormationStep;
      })
      .filter((s): s is GainFormationStep => s !== null)
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

    return { gain, formation };
  }

  async setGainVerdict(input: {
    gainId: string;
    verdict: GainVerdict;
    label?: string;
  }): Promise<Gain> {
    let updated: Gain | undefined;
    const label = input.label?.trim();
    await mutateStore((store) => ({
      ...store,
      gains: store.gains.map((g) => {
        if (g.id !== input.gainId) return g;
        updated = { ...g, verdict: input.verdict, ...(label ? { label } : {}) };
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Gain not found: ${input.gainId}`);
    return updated;
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

  // -- Writes the Edge Function owns in the shipped path ---------------------

  async saveAnalysis(analysis: EntryAnalysis): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      analyses: { ...store.analyses, [analysis.logId]: analysis },
    }));
  }

  /** Upsert by (type, label), which is the same key the database enforces. */
  async upsertGain(
    gain: Omit<Gain, 'id' | 'userId'> & { id?: string }
  ): Promise<Gain> {
    let result: Gain | undefined;
    await mutateStore((store) => {
      const existing = store.gains.find(
        (g) => g.type === gain.type && g.label === gain.label && !g.mergedIntoId
      );
      if (existing) {
        result = {
          ...existing,
          maturity: gain.maturity,
          confidence: Math.max(existing.confidence, gain.confidence),
          lastDetectedAt: gain.lastDetectedAt,
        };
        return {
          ...store,
          gains: store.gains.map((g) => (g.id === existing.id ? (result as Gain) : g)),
        };
      }
      result = {
        id: gain.id ?? uuid(),
        userId: LOCAL_USER_ID,
        type: gain.type,
        label: gain.label,
        maturity: gain.maturity,
        confidence: gain.confidence,
        firstDetectedAt: gain.firstDetectedAt,
        lastDetectedAt: gain.lastDetectedAt,
      };
      return { ...store, gains: [...store.gains, result] };
    });
    if (!result) throw new Error('Gain upsert failed.');
    return result;
  }

  async addEvidence(evidence: GainEvidence): Promise<void> {
    await mutateStore((store) => ({
      ...store,
      evidence: [
        ...store.evidence.filter(
          (e) => !(e.gainId === evidence.gainId && e.logId === evidence.logId)
        ),
        evidence,
      ],
    }));
  }

  async addLinks(links: JourneyLink[]): Promise<void> {
    if (links.length === 0) return;
    await mutateStore((store) => {
      const key = (l: JourneyLink) => `${l.fromLogId}:${l.toLogId}`;
      const incoming = new Set(links.map(key));
      return { ...store, links: [...store.links.filter((l) => !incoming.has(key(l))), ...links] };
    });
  }

  async listLinksFrom(logId: string): Promise<JourneyLink[]> {
    const store = await readStore();
    return store.links.filter((l) => l.fromLogId === logId);
  }

  /** Merge one gain into another, keeping the source row for its evidence. */
  async mergeGains(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) return;
    await mutateStore((store) => ({
      ...store,
      gains: store.gains.map((g) => (g.id === sourceId ? { ...g, mergedIntoId: targetId } : g)),
      evidence: store.evidence.map((e) =>
        e.gainId === sourceId ? { ...e, gainId: targetId } : e
      ),
    }));
  }
}
