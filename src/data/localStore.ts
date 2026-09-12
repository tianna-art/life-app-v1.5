import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  FlowSession,
  FutureMemo,
  JournalLog,
  MonthDirection,
  MonthHypothesis,
  MonthInsight,
  MonthSummary,
  PeriodTitle,
  VisionItem,
  VisionWord,
  YearDirection,
  YearDirectionChange,
} from '@/types';

/** Bumped because the shape changed completely; v2 data cannot be read. */
export const LOCAL_STORE_KEY = 'crincran:store:v3';

export interface LocalStoreShape {
  visionItems: VisionItem[];
  visionWords: VisionWord[];
  yearDirections: YearDirection[];
  yearDirectionHistory: YearDirectionChange[];
  monthDirections: MonthDirection[];
  logs: JournalLog[];
  futureMemos: FutureMemo[];
  flowSessions: FlowSession[];
  monthSummaries: MonthSummary[];
  monthInsights: MonthInsight[];
  monthHypotheses: MonthHypothesis[];
  periodTitles: PeriodTitle[];
}

export const EMPTY_STORE: LocalStoreShape = {
  visionItems: [],
  visionWords: [],
  yearDirections: [],
  yearDirectionHistory: [],
  monthDirections: [],
  logs: [],
  futureMemos: [],
  flowSessions: [],
  monthSummaries: [],
  monthInsights: [],
  monthHypotheses: [],
  periodTitles: [],
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
