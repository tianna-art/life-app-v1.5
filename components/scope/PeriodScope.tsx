import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { ScopeTabs, type ScopeTab } from './ScopeTabs';
import { PeriodMap } from './PeriodMap';
import { RecordRow } from '@components/list/RecordRow';
import { useMonthDirection, useYearDirection } from '@/hooks/useDirection';
import { useMonthInsights } from '@/hooks/useReading';
import { useSummary } from '@/hooks/useReading';
import { useMonthLogs, useYearLogs } from '@/hooks/useLogs';
import { daysUntilNameable, footprintState } from '@/utils/footprint';
import { summaryText, type JournalLog, type MonthInsight, type PeriodType } from '@/types';

/**
 * 月次 / 年次 — one finished period, three ways of looking at it.
 *
 * マップ, 要約 and 出来事 are all offered whether or not there is anything in
 * them. A period with no records says so plainly and offers no explanation:
 * an empty month is an early month, not a failure, and nothing here fills it
 * with something that reads like content.
 */
export function PeriodScope({
  periodType,
  periodKey,
  today,
  onOpenInsight,
  onOpenMonth,
}: {
  periodType: PeriodType;
  /** `YYYY-MM` or `YYYY`. */
  periodKey: string;
  today: Date;
  onOpenInsight: (insight: MonthInsight) => void;
  /** Only meaningful for a year: jump to one of its months. */
  onOpenMonth?: ((periodKey: string) => void) | undefined;
}) {
  const [tab, setTab] = useState<ScopeTab>('map');
  const monthly = periodType === 'month';

  const monthLogs = useMonthLogs(monthly ? periodKey : '');
  const yearLogs = useYearLogs(monthly ? 0 : Number(periodKey));
  const logs = (monthly ? monthLogs.data : yearLogs.data) ?? [];

  const { data: monthDirection } = useMonthDirection(monthly ? periodKey : '');
  const { data: yearDirection } = useYearDirection(monthly ? 0 : Number(periodKey));
  const { data: insights } = useMonthInsights(monthly ? periodKey : '');
  const { data: summary } = useSummary(periodType, periodKey);

  // The map is a look back at a period, so it opens when the period does —
  // the same moment its 足跡タイトル can be made.
  const state = footprintState({ periodKey, today, hasTitle: false });
  const open = state !== 'waiting' && state !== 'future';
  const daysLeft = daysUntilNameable(periodKey, today);

  const month = useMemo(
    () => (monthly ? Number(periodKey.slice(5, 7)) : null),
    [monthly, periodKey]
  );

  return (
    <View style={styles.wrap} testID={`scope-${periodType}`}>
      <ScopeTabs value={tab} onChange={setTab} />

      {tab === 'map' ? (
        open ? (
          <PeriodMap
            month={month}
            antennaIds={monthDirection?.antennaIds ?? []}
            insights={insights ?? []}
            onOpen={onOpenInsight}
          />
        ) : (
          <View style={styles.waiting} testID="scope-map-waiting">
            <Text style={styles.waitingText}>
              {monthly ? COPY.mapPending : COPY.yearMapPending}
            </Text>
            <Text style={styles.days}>{`${daysLeft}日`}</Text>
          </View>
        )
      ) : null}

      {tab === 'summary' ? (
        <View style={styles.block} testID="scope-summary">
          <Text style={styles.eyebrow}>{COPY.setDirection}</Text>
          <Text style={styles.direction}>
            {monthly
              ? (monthDirection?.antennaIds ?? []).length > 0
                ? (monthDirection?.antennaIds ?? []).join(' / ')
                : COPY.dirMissing
              : (yearDirection?.direction ?? COPY.yearDirNone)}
          </Text>

          {summary && summaryText(summary).length > 0 ? (
            <>
              {summary.keywords.length > 0 ? (
                <View style={styles.keywords}>
                  {summary.keywords.map((word) => (
                    <Text key={word} style={styles.keyword}>
                      {word}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Text style={styles.summaryBody}>{summaryText(summary)}</Text>
            </>
          ) : (
            <Text style={styles.none}>
              {monthly ? COPY.digestPending : COPY.yearDigestPending}
            </Text>
          )}
        </View>
      ) : null}

      {tab === 'records' ? (
        <View style={styles.block} testID="scope-records">
          {logs.length === 0 ? (
            <Text style={styles.none}>{COPY.pastNone}</Text>
          ) : monthly ? (
            logs.map((log) => <RecordRow key={log.id} log={log} />)
          ) : (
            // A year's records are too many to read end to end, so they arrive
            // grouped by the month they belong to — which is also how someone
            // remembers them.
            byMonth(logs).map(([key, monthsLogs]) => (
              <View key={key} style={styles.monthGroup} testID={`scope-month-${key}`}>
                <Pressable
                  onPress={() => onOpenMonth?.(key)}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={`${Number(key.slice(5, 7))}月`}
                  disabled={!onOpenMonth}
                >
                  <Text style={styles.monthLabel}>{`${Number(key.slice(5, 7))}月`}</Text>
                </Pressable>
                {monthsLogs.map((log) => (
                  <RecordRow key={log.id} log={log} />
                ))}
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Newest month first, and each month's own records in the order they came. */
function byMonth(logs: JournalLog[]): [string, JournalLog[]][] {
  const groups = new Map<string, JournalLog[]>();
  for (const log of logs) {
    const list = groups.get(log.periodKey);
    if (list) list.push(log);
    else groups.set(log.periodKey, [log]);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  block: { gap: spacing.sm },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  direction: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 25, color: colors.brown },
  keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm },
  keyword: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.brown,
    backgroundColor: colors.butter,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 25, color: colors.brown },
  none: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.brownFaint },
  monthGroup: { paddingTop: spacing.md, gap: spacing.xs },
  monthLabel: { fontFamily: fonts.serif, fontSize: 15, color: colors.orange },
  waiting: {
    backgroundColor: colors.butter,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  waitingText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 22,
    color: colors.brownDim,
    textAlign: 'center',
  },
  days: { fontFamily: fonts.serif, fontSize: 18, color: colors.brown },
});
