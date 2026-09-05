import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  EntryAnalysis,
  Gain,
  GainEvidence,
  JournalEntry,
  JourneyLink,
  MonthReview,
} from '@/types';

/**
 * v2 key: the shape changed completely with the gain model, and a half-read
 * v1 store would be worse than an empty one. The old key is left in place so
 * nothing is destroyed on a device that still has it.
 */
export const LOCAL_STORE_KEY = 'crincran:store:v2';

export interface LocalStoreShape {
  entries: JournalEntry[];
  analyses: Record<string, EntryAnalysis>;
  gains: Gain[];
  evidence: GainEvidence[];
  links: JourneyLink[];
  reviews: MonthReview[];
}

export const EMPTY_STORE: LocalStoreShape = {
  entries: [],
  analyses: {},
  gains: [],
  evidence: [],
  links: [],
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
