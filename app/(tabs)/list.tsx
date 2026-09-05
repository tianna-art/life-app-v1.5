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
import { signOutEverywhere } from '@/lib/session';
import { useLocalStore } from '@/lib/env';
import type { MenuItem } from '@components/log/LogMenu';
import type { LogType } from '@/types';

/**
 * LIST (§20).
 *
 * The archive, and nothing more artistic than that. Months that hold nothing
 * are not printed — an empty row would only be the app telling the person what
 * they did not do.
 */
export default function ListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const year = useUiStore((s) => s.listYear);
  const setYear = useUiStore((s) => s.setListYear);
  const [menuOpen, setMenuOpen] = useState(false);
  // null is every door, and that is where the archive opens (§28).
  const [logType, setLogType] = useState<LogType | null>(null);

  const yearKeyValue = String(year);
  const { data: entries } = useYearLogs(yearKeyValue);
  const { data: reviews } = useMonthReviews(yearKeyValue);

  const years = useMemo(() => selectableYears(year, 5), [year]);
  const reviewByMonth = useMemo(
    () => new Map((reviews ?? []).map((r) => [r.periodKey, r])),
    [reviews]
  );

  // Newest month first: what the person is looking for is nearly always
  // recent. A month left empty by the filter is dropped rather than printed
  // as a bare heading, the same as a month with nothing in it.
  const months = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const entry of entries ?? []) {
      if (logType && entry.logType !== logType) continue;
      const key = monthKeyOfDate(entry.occurredOn);
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries, logType]);

  const handleSignOut = useCallback(() => {
    void signOutEverywhere().finally(() => queryClient.clear());
  }, [queryClient]);

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: 'この月をマップで見る', onPress: () => router.push('/map') },
      // For records that arrived some way other than being written here.
      { label: '読まれていない記録を読む', onPress: () => router.push('/backfill') },
    ];
    if (!useLocalStore) {
      items.push({
        label: 'ログアウト',
        onPress: handleSignOut,
        separated: true,
        confirmLabel: 'もう一度押すとログアウト',
      });
    }
    return items;
  }, [router, handleSignOut]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TopBar right={<LogMenuButton onPress={() => setMenuOpen(true)} />}>
          <YearSelector year={year} years={years} onChange={setYear} />
        </TopBar>

        <CategoryFilter value={logType} onChange={setLogType} />

        <HairlineRule />

        {months.length === 0 ? (
          <EmptyState message={EMPTY_STATE.list} />
        ) : (
          months.map(([monthKey, monthEntries]) => (
            <View key={monthKey}>
              <MonthSection
                monthKey={monthKey}
                entries={monthEntries ?? []}
                review={reviewByMonth.get(monthKey) ?? null}
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
