import { create } from 'zustand';
import { monthKeyOf } from '@/utils/period';

interface UiState {
  /** MAP: the single month on screen. Months are never merged (§18). */
  mapMonthKey: string;
  /** LIST: the year being read. */
  listYear: number;
  /** Months whose end screen has already been shown, so it appears once. */
  seenMonthEnds: string[];

  setMapMonthKey: (key: string) => void;
  setListYear: (year: number) => void;
  markMonthEndSeen: (key: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mapMonthKey: monthKeyOf(new Date()),
  listYear: new Date().getFullYear(),
  seenMonthEnds: [],

  setMapMonthKey: (mapMonthKey) => set({ mapMonthKey }),
  setListYear: (listYear) => set({ listYear }),
  markMonthEndSeen: (key) =>
    set((state) =>
      state.seenMonthEnds.includes(key)
        ? state
        : { seenMonthEnds: [...state.seenMonthEnds, key].slice(-24) }
    ),
}));
