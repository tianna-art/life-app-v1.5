import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Clarification,
  EntryAnalysis,
  Gain,
  JournalEntry,
  MonthReview,
  Progression,
  ProgressionEvidence,
} from '@/types';

/**
 * v3 key: the centre of the model moved from Gain to Progression, so a
 * half-read v2 store would be worse than an empty one. The older keys are left
 * in place — nothing on a device is destroyed by this release.
 */
export const LOCAL_STORE_KEY = 'crincran:store:v3';

export interface LocalStoreShape {
  entries: JournalEntry[];
  analyses: Record<string, EntryAnalysis>;
  progressions: Progression[];
  evidence: ProgressionEvidence[];
  gains: Gain[];
  clarifications: Clarification[];
  reviews: MonthReview[];
}

export const EMPTY_STORE: LocalStoreShape = {
  entries: [],
  analyses: {},
  progressions: [],
  evidence: [],
  gains: [],
  clarifications: [],
  reviews: [],
};

export async function readStore(): Promise<LocalStoreShape> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    const parsed = JSON.parse(raw) as Partial<LocalStoreShape>;
    return { ...EMPTY_STORE, ...parsed };
  } catch {
    return { ...EMPTY_STORE };
  }
}

export async function writeStore(store: LocalStoreShape): Promise<void> {
  await AsyncStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
}

export async function mutateStore(
  mutator: (store: LocalStoreShape) => LocalStoreShape
): Promise<LocalStoreShape> {
  const next = mutator(await readStore());
  await writeStore(next);
  return next;
}
