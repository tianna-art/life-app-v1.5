import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DailyLog,
  Gain,
  LogAnalysis,
  MonthReview,
  MonthTheme,
  Progression,
  ProgressionEvidence,
  YearDirection,
  YearReview,
} from '@/types';

/**
 * v4 key: the daily record changed shape (a body became optional, tags became
 * required), so a half-read v3 store would be worse than an empty one. The
 * older keys are left in place — nothing on a device is destroyed by this.
 */
export const LOCAL_STORE_KEY = 'crincran:store:v4';

export interface LocalStoreShape {
  logs: DailyLog[];
  analyses: Record<string, LogAnalysis>;
  progressions: Progression[];
  evidence: ProgressionEvidence[];
  gains: Gain[];
  yearDirections: YearDirection[];
  monthThemes: MonthTheme[];
  reviews: MonthReview[];
  yearReviews: YearReview[];
}

export const EMPTY_STORE: LocalStoreShape = {
  logs: [],
  analyses: {},
  progressions: [],
  evidence: [],
  gains: [],
  yearDirections: [],
  monthThemes: [],
  reviews: [],
  yearReviews: [],
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
