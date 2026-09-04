import { create } from 'zustand';
import { monthKeyOf, yearKeyOf } from '@/utils/period';
import type { LogType } from '@/types';

export type ListFilter = 'all' | LogType;
export type MapMode = 'month' | 'year';

interface UiState {
  /** MAP: the single period on screen. Months are never merged. */
  mapMode: MapMode;
  mapMonthKey: string;
  mapYearKey: string;
  /** LIST */
  listYear: number;
  listFilter: ListFilter;
  /** Logs the user has opened — feeds representative-log ranking in the year map. */
  openedLogIds: string[];

  setMapMode: (mode: MapMode) => void;
  setMapMonthKey: (key: string) => void;
  setMapYearKey: (key: string) => void;
  setListYear: (year: number) => void;
  setListFilter: (filter: ListFilter) => void;
  markLogOpened: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mapMode: 'month',
  mapMonthKey: monthKeyOf(new Date()),
  mapYearKey: yearKeyOf(new Date()),
  listYear: new Date().getFullYear(),
  listFilter: 'all',
  openedLogIds: [],

  setMapMode: (mapMode) => set({ mapMode }),
  setMapMonthKey: (mapMonthKey) => set({ mapMonthKey }),
  setMapYearKey: (mapYearKey) => set({ mapYearKey }),
  setListYear: (listYear) => set({ listYear }),
  setListFilter: (listFilter) => set({ listFilter }),
  markLogOpened: (id) =>
    set((state) =>
      state.openedLogIds.includes(id)
        ? state
        : { openedLogIds: [...state.openedLogIds, id].slice(-200) }
    ),
}));
