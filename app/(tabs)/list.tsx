import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { YearSelector } from '@components/list/YearSelector';
import { LogFilterTabs } from '@components/list/LogFilterTabs';
import { MonthSection } from '@components/list/MonthSection';
import { YearlyTitleCard } from '@components/titles/YearlyTitleCard';
import { useYearLogs } from '@/hooks/useLogs';
import { useYearIntentions } from '@/hooks/useIntention';
import { useUiStore } from '@/state/uiStore';
import { monthKeyOfDate, monthsOfYear, selectableYears } from '@/utils/period';

/** The year, read as a story: January to December, filtered by type. */
export default function ListScreen() {
  const router = useRouter();
  const year = useUiStore((s) => s.listYear);
  const filter = useUiStore((s) => s.listFilter);
  const setYear = useUiStore((s) => s.setListYear);
  const setFilter = useUiStore((s) => s.setListFilter);

  const yearKeyValue = String(year);
  const { data: logs } = useYearLogs(yearKeyValue);
  const { data: intentions } = useYearIntentions(yearKeyValue);

  const years = useMemo(() => selectableYears(year, 5), [year]);

  const intentionByMonth = useMemo(
    () => new Map((intentions ?? []).map((i) => [i.periodKey, i])),
    [intentions]
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, { all: typeof logs; filtered: typeof logs }>();
    for (const key of monthsOfYear(year)) map.set(key, { all: [], filtered: [] });
    for (const log of logs ?? []) {
      const bucket = map.get(monthKeyOfDate(log.occurredOn));
      if (!bucket) continue;
      bucket.all?.push(log);
      if (filter === 'all' || log.type === filter) bucket.filtered?.push(log);
    }
    return map;
  }, [logs, year, filter]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <YearSelector year={year} years={years} onChange={setYear} />
          <YearlyTitleCard yearKey={yearKeyValue} logCount={logs?.length ?? 0} />
        </View>

        <LogFilterTabs value={filter} onChange={setFilter} />
        <HairlineRule />

        {monthsOfYear(year).map((key) => {
          const bucket = byMonth.get(key);
          return (
            <View key={key}>
              <MonthSection
                monthKey={key}
                logs={bucket?.filtered ?? []}
                unfilteredCount={bucket?.all?.length ?? 0}
                intention={intentionByMonth.get(key) ?? null}
                onLogPress={(id) => router.push(`/log/${id}`)}
              />
              <HairlineRule />
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  header: { paddingTop: spacing.lg, gap: spacing.sm },
});
