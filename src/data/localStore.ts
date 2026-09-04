import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Category,
  CategoryInsight,
  JournalLog,
  LogAIAnalysis,
  MonthlyIntention,
  PeriodTitle,
} from '@/types';

export const LOCAL_STORE_KEY = 'crincran:store:v1';

export interface LocalStoreShape {
  categories: Category[];
  logs: JournalLog[];
  analyses: Record<string, LogAIAnalysis>;
  titles: PeriodTitle[];
  intentions: MonthlyIntention[];
  insights: CategoryInsight[];
}

export const EMPTY_STORE: LocalStoreShape = {
  categories: [],
  logs: [],
  analyses: {},
  titles: [],
  intentions: [],
  insights: [],
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
