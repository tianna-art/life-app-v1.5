import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { spacing } from '@/theme';
import { EMPTY_STATE } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { EmptyState } from '@components/ui/EmptyState';
import { HairlineRule } from '@components/ui/HairlineRule';
import { YearSelector } from '@components/list/YearSelector';
import { MonthSection } from '@components/list/MonthSection';
import { CategoryFilter } from '@components/list/CategoryFilter';
import { LogMenu, LogMenuButton } from '@components/log/LogMenu';
import { useYearLogs } from '@/hooks/useLogs';
import { useMonthReviews } from '@/hooks/useMonthReview';
import { useUiStore } from '@/state/uiStore';
import { monthKeyOfDate, selectableYears } from '@/utils/period';
import { runBackfill } from '@/ai/backfill';
import { generateMonthMap } from '@/ai/client';
import { signOutEverywhere } from '@/lib/session';
import { useLocalStore } from '@/lib/env';
import type { MenuItem } from '@components/log/LogMenu';
import type { ListFilter } from '@components/list/CategoryFilter';
import type { MapState } from '@components/list/MonthAction';
import type { DailyLog, LogWithAnalysis } from '@/types';

const NO_FILTER: ListFilter = { logType: null, momentTag: null };

/**
 * LIST (§20).
 *
 * The archive, and nothing more artistic than that. Months that hold nothing
 * are not printed — an empty row would only be the app telling the person what
 * they did not do.
 *
 * Each month also carries the one thing there is to do with a month: read its
 * unread records, or open the map they produced. That used to live in the menu
 * as "read the records nobody read", which described the machinery rather than
 * the result. Beside the month's own name it can say what it gives you.
 */
export default function ListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const year = useUiStore((s) => s.listYear);
  const setYear = useUiStore((s) => s.setListYear);
  const setMapMonthKey = useUiStore((s) => s.setMapMonthKey);
  const [menuOpen, setMenuOpen] = useState(false);
  // The archive opens on everything (§28).
  const [filter, setFilter] = useState<ListFilter>(NO_FILTER);
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  // Why a run here read nothing, per month. Cleared when it is tried again.
  const [failures, setFailures] = useState<Record<string, string>>({});

  const yearKeyValue = String(year);
  const { data: entries } = useYearLogs(yearKeyValue);
  const { data: reviews } = useMonthReviews(yearKeyValue);

  const years = useMemo(() => selectableYears(year, 5), [year]);
  const reviewByMonth = useMemo(
    () => new Map((reviews ?? []).map((r) => [r.periodKey, r])),
    [reviews]
  );

  // What each month holds, filtered and unfiltered. The filter decides what is
  // shown; it must not decide what a run would read, or narrowing the view
  // would quietly change what the person is paying for.
  const byMonth = useMemo(() => {
    const map = new Map<string, { shown: LogWithAnalysis[]; all: LogWithAnalysis[] }>();
    for (const entry of entries ?? []) {
      const key = monthKeyOfDate(entry.occurredOn);
      const bucket = map.get(key) ?? { shown: [], all: [] };
      bucket.all.push(entry);
      const passes =
        (!filter.logType || entry.logType === filter.logType) &&
        (!filter.momentTag || entry.momentTags.includes(filter.momentTag));
      if (passes) bucket.shown.push(entry);
      map.set(key, bucket);
    }
    return map;
  }, [entries, filter]);

  // Newest month first: what the person is looking for is nearly always
  // recent. A month left empty by the filter is dropped rather than printed
  // as a bare heading, the same as a month with nothing in it.
  const months = useMemo(
    () =>
      [...byMonth.entries()]
        .filter(([, bucket]) => bucket.shown.length > 0)
        .sort((a, b) => b[0].localeCompare(a[0])),
    [byMonth]
  );

  /**
   * What a run for this month would have to read.
   *
   * Everything unread up to and including it, not just its own — STAGE 2
   * compares a record against what came before it, so reading August while
   * June is still unread would build the trail out of order and every
   * maturity downstream of it would be wrong. The count on the button is this
   * number, so nothing is hidden.
   */
  const pendingFor = useCallback(
    (monthKey: string): DailyLog[] => {
      const out: LogWithAnalysis[] = [];
      for (const [key, bucket] of byMonth) {
        if (key > monthKey) continue;
        for (const entry of bucket.all) if (!entry.analysis) out.push(entry);
      }
      return out
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
        .map(({ analysis: _a, progressions: _p, ...log }) => log);
    },
    [byMonth]
  );

  const stateFor = useCallback(
    (monthKey: string): MapState => {
      const bucket = byMonth.get(monthKey);
      if (!bucket) return 'none';
      const unread = bucket.all.filter((e) => !e.analysis).length;
      if (unread === 0) return 'ready';
      // Some read, some not: the map exists but no longer covers the month.
      return unread === bucket.all.length ? 'none' : 'stale';
    },
    [byMonth]
  );

  const generate = useCallback(
    async (monthKey: string) => {
      const pending = pendingFor(monthKey);
      if (pending.length === 0 || running) return;
      setRunning(monthKey);
      setDone(0);
      setFailures((current) => {
        const { [monthKey]: _gone, ...rest } = current;
        return rest;
      });
      try {
        const result = await runBackfill(pending, { onProgress: (p) => setDone(p.done) });
        // The brief reasons over the points the records just produced, so it
        // runs after them and only when something was actually read.
        if (result.read > 0) await generateMonthMap(monthKey);
        // A run that read nothing has to say so. Silence here is what makes a
        // working button and a broken one look the same.
        if (result.read === 0 && result.fellBack > 0) {
          setFailures((current) => ({
            ...current,
            [monthKey]: result.reason ?? '分析に届きませんでした。',
          }));
        }
      } catch (error) {
        setFailures((current) => ({
          ...current,
          [monthKey]: error instanceof Error ? error.message : '分析に届きませんでした。',
        }));
      } finally {
        setRunning(null);
        await queryClient.invalidateQueries();
      }
    },
    [pendingFor, running, queryClient]
  );

  const openMap = useCallback(
    (monthKey: string) => {
      setMapMonthKey(monthKey);
      router.push('/map');
    },
    [router, setMapMonthKey]
  );

  const handleSignOut = useCallback(() => {
    void signOutEverywhere().finally(() => queryClient.clear());
  }, [queryClient]);

  // Both of the old entries moved onto the months themselves, where they can
  // name what they give you rather than what they do.
  const menuItems = useMemo<MenuItem[]>(() => {
    if (useLocalStore) return [];
    return [
      {
        label: 'ログアウト',
        onPress: handleSignOut,
        confirmLabel: 'もう一度押すとログアウト',
      },
    ];
  }, [handleSignOut]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TopBar
          right={
            menuItems.length > 0 ? (
              <LogMenuButton onPress={() => setMenuOpen(true)} />
            ) : undefined
          }
        >
          <YearSelector year={year} years={years} onChange={setYear} />
        </TopBar>

        <CategoryFilter value={filter} onChange={setFilter} />

        <HairlineRule />

        {months.length === 0 ? (
          <EmptyState message={EMPTY_STATE.list} />
        ) : (
          months.map(([monthKey, bucket]) => (
            <View key={monthKey}>
              <MonthSection
                monthKey={monthKey}
                entries={bucket.shown}
                review={reviewByMonth.get(monthKey) ?? null}
                mapState={stateFor(monthKey)}
                pending={pendingFor(monthKey).length}
                running={running === monthKey}
                failure={failures[monthKey]}
                done={done}
                onGenerate={() => void generate(monthKey)}
                onOpenMap={() => openMap(monthKey)}
                onEntryPress={(id) => router.push(`/log/${id}`)}
                onReviewPress={(key) => router.push(`/month/${key}`)}
              />
              <HairlineRule />
            </View>
          ))
        )}
      </ScrollView>

      <LogMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
});
