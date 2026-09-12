import { getSupabase } from '@/lib/supabase';

/**
 * Calling the readers.
 *
 * The app never asks a model anything directly: there is no key in this
 * bundle, and there is no path from here to one. It asks an Edge Function,
 * which holds the key and — more importantly — holds the rules about what may
 * come back.
 *
 * Every one of these can come back with nothing. That is a normal answer, not
 * a failure: a month that has nothing to say is left saying nothing.
 */
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) return null;
  return data ?? null;
}

export function readMonthSummary(periodKey: string) {
  return invoke<{ written: boolean; problems?: string[] }>('month-summary', { periodKey });
}

export function readMonthInsights(periodKey: string) {
  return invoke<{ insights: number; hypothesis: boolean; rejected?: string[] }>(
    'month-insights',
    { periodKey }
  );
}

/**
 * The comparison with the period before. `written: false` is the ordinary
 * answer — most often because one of the two periods is too thin to hold a
 * comparison, which the function decides before asking a model anything.
 */
export function readPeriodChange(periodType: 'month' | 'year', periodKey: string) {
  return invoke<{ written: boolean; reason?: string; problems?: string[] }>('period-change', {
    periodType,
    periodKey,
  });
}

export function proposeTitles(periodType: 'month' | 'year', periodKey: string) {
  return invoke<{ titles: string[]; problems?: string[] }>('period-title', {
    periodType,
    periodKey,
  });
}
