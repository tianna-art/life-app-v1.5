import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { spacing } from '@/theme';
import { EMPTY_STATE } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { EmptyState } from '@components/ui/EmptyState';
import { HairlineRule } from '@components/ui/HairlineRule';
import { YearSelector } from '@components/list/YearSelector';
import { MonthSection } from '@components/list/MonthSection';
import { LogMenu, LogMenuButton } from '@components/log/LogMenu';
import { useYearEntries } from '@/hooks/useEntries';
import { useMonthReviews } from '@/hooks/useMonthReview';
import { useUiStore } from '@/state/uiStore';
import { monthKeyOfDate, selectableYears } from '@/utils/period';
import { signOutEverywhere } from '@/lib/session';
import { useLocalStore } from '@/lib/env';
import type { MenuItem } from '@components/log/LogMenu';

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

  const yearKeyValue = String(year);
  const { data: entries } = useYearEntries(yearKeyValue);
  const { data: reviews } = useMonthReviews(yearKeyValue);

  const years = useMemo(() => selectableYears(year, 5), [year]);
  const reviewByMonth = useMemo(
    () => new Map((reviews ?? []).map((r) => [r.periodKey, r])),
    [reviews]
  );

  // Newest month first: what the person is looking for is nearly always recent.
  const months = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const entry of entries ?? []) {
      const key = monthKeyOfDate(entry.occurredOn);
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const handleSignOut = useCallback(() => {
    void signOutEverywhere().finally(() => queryClient.clear());
  }, [queryClient]);

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: 'この月をマップで見る', onPress: () => router.push('/map') },
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
        <View style={styles.header}>
          <YearSelector year={year} years={years} onChange={setYear} />
          <LogMenuButton onPress={() => setMenuOpen(true)} />
        </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
});
