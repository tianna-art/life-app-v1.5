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

/**
 * The opening screens' working state (§2-§5).
 *
 * Kept in memory rather than the database because it is not an answer until
 * the last screen: someone who backs out halfway has not told us anything, and
 * a half-written lens would start steering the reading.
 */
interface OnboardingDraft {
  selectedAreas: string[];
  desiredSelfCards: string[];
  lenses: string[];
  setSelectedAreas: (value: string[]) => void;
  setDesiredSelfCards: (value: string[]) => void;
  setLenses: (value: string[]) => void;
  clear: () => void;
}

export const useOnboardingDraft = create<OnboardingDraft>((set) => ({
  selectedAreas: [],
  desiredSelfCards: [],
  lenses: [],
  setSelectedAreas: (value) => set({ selectedAreas: value }),
  setDesiredSelfCards: (value) => set({ desiredSelfCards: value }),
  setLenses: (value) => set({ lenses: value }),
  clear: () => set({ selectedAreas: [], desiredSelfCards: [], lenses: [] }),
}));
