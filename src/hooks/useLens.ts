import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { generateLenses, generateMonthThemes, generateYearThemes } from '@/ai/client';
import { watchedPatterns } from '@/constants/desiredSelf';
import type { MonthTheme, MonthThemeCandidate, YearDirection } from '@/types';

/**
 * The year's lens (§2-§5).
 *
 * Absent until the person has been through the opening screens, and absent is
 * a working state: the reading runs without one, it simply has no priority to
 * apply.
 */
export function useYearDirection(year: number) {
  return useQuery<YearDirection | null>({
    queryKey: queryKeys.yearDirection(year),
    queryFn: () => getRepository().getYearDirection(year),
  });
}

export function useSaveYearDirection() {
  const client = useQueryClient();
  return useMutation<
    YearDirection,
    Error,
    {
      year: number;
      selectedAreas: string[];
      desiredSelfCards: string[];
      progressionLenses?: string[];
      initialTheme?: string;
      finalTheme?: string;
    }
  >({
    mutationFn: (input) =>
      getRepository().saveYearDirection({
        ...input,
        progressionLenses: input.progressionLenses ?? [],
      }),
    onSuccess: (direction) => {
      void client.invalidateQueries({ queryKey: queryKeys.yearDirection(direction.year) });
    },
  });
}

/**
 * The lenses themselves.
 *
 * The model turns the picked areas and cards into three to six phrases in the
 * person's own register. When it cannot be reached, the cards' own labels are
 * the fallback — less graceful, but they are still the person's choices, and
 * the reading needs something to prioritise by.
 */
export function useGenerateLenses() {
  return useMutation<string[], Error, { selectedAreas: string[]; desiredSelfCards: string[] }>({
    mutationFn: async (input) => {
      const generated = await generateLenses(input);
      if (generated.length > 0) return generated;
      // Fallback: the patterns the cards already point at, named plainly.
      return watchedPatterns(input.desiredSelfCards).slice(0, 6).map(patternPhrase);
    },
  });
}

const PATTERN_PHRASE: Record<string, string> = {
  naming: '自分のことが分かってくる',
  first_act: '試してみる',
  repeat: '繰り返してみる',
  solo: '自分でもできるようになる',
  pivot: 'やり方を変える',
  expose: '外に出す',
  own_call: '自分で決める',
  transfer: '別の場面でも使う',
  reframe: '捉え方が変わる',
  boundary: '線を引く',
};

function patternPhrase(pattern: string): string {
  return PATTERN_PHRASE[pattern] ?? pattern;
}

/** The three year themes offered at the end of the opening screens (§5). */
export function useYearThemeCandidates() {
  return useMutation<string[], Error, { selectedAreas: string[]; lenses: string[] }>({
    mutationFn: (input) => generateYearThemes(input),
  });
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

export function useMonthTheme(year: number, month: number) {
  return useQuery<MonthTheme | null>({
    queryKey: queryKeys.monthTheme(year, month),
    queryFn: () => getRepository().getMonthTheme(year, month),
  });
}

export function useSaveMonthTheme() {
  const client = useQueryClient();
  return useMutation<
    MonthTheme,
    Error,
    {
      year: number;
      month: number;
      initialTheme?: string;
      finalTheme?: string;
      source: MonthTheme['source'];
      candidates?: MonthThemeCandidate[];
    }
  >({
    mutationFn: (input) => getRepository().saveMonthTheme(input),
    onSuccess: (theme) => {
      void client.invalidateQueries({ queryKey: queryKeys.monthTheme(theme.year, theme.month) });
    },
  });
}

/** Continue / Deepen / Follow the Spark (§6). */
export function useMonthThemeCandidates() {
  return useMutation<MonthThemeCandidate[], Error, { year: number; month: number }>({
    mutationFn: (input) => generateMonthThemes(input),
  });
}
