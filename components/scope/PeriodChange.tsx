import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { RecordRow } from '@components/list/RecordRow';
import { usePeriodChange } from '@/hooks/useReading';
import { useLogsById } from '@/hooks/useLogs';
import type { PeriodType } from '@/types';

/**
 * 先月からの変化 / 去年との違い — the comparison, while a period is being named.
 *
 * Most of the time this is empty, and that is the design rather than a gap.
 * A comparison needs material on both sides: the reading refuses to write one
 * when either period is thin, or when one holds several times what the other
 * does. Put a month with one record beside a month with five and 「増えた」
 * writes itself — nothing about the person changed, one of the two months is
 * simply thinner on the page, and no sentence can tell those apart afterwards.
 *
 * When there is one, both sides are shown underneath it, whole. The records
 * are the argument; the sentence above them is only a reading of it, and the
 * person can disagree with it by looking down. 見えないこと is printed too,
 * in the same size — a limit that has to be hunted for is not stated.
 */
export function PeriodChange({
  periodType,
  periodKey,
}: {
  periodType: PeriodType;
  /** `YYYY-MM` or `YYYY`; empty while nothing is selected. */
  periodKey?: string;
}) {
  const { data: change } = usePeriodChange(periodType, periodKey ?? '');

  const ids = useMemo(
    () => [...(change?.previousLogIds ?? []), ...(change?.currentLogIds ?? [])],
    [change]
  );
  const { data: logs } = useLogsById(ids);
  const byId = useMemo(() => new Map((logs ?? []).map((log) => [log.id, log])), [logs]);
  const rows = (which: readonly string[]) =>
    which.map((id) => byId.get(id)).filter((log) => log !== undefined);

  if (!change) {
    return (
      <View style={styles.card} testID="period-change">
        <Text style={styles.empty}>
          {periodType === 'month' ? COPY.changeNone : COPY.vsPrevYearNone}
        </Text>
      </View>
    );
  }

  const sides: [string, ReturnType<typeof rows>][] = [
    [COPY.changeBefore, rows(change.previousLogIds)],
    [COPY.changeAfter, rows(change.currentLogIds)],
  ];

  return (
    <View style={styles.card} testID="period-change">
      <Text style={styles.title}>{change.title}</Text>
      <Text style={styles.summary}>{change.summary}</Text>

      {sides.map(([label, side]) => (
        <View key={label} style={styles.side}>
          <Text style={styles.eyebrow}>{label}</Text>
          {side.map((log) => (
            <RecordRow key={log.id} log={log} />
          ))}
        </View>
      ))}

      {change.note.length > 0 ? <Text style={styles.note}>{change.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 22,
    color: colors.brownFaint,
    textAlign: 'center',
  },
  title: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 27, color: colors.brown },
  summary: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 25, color: colors.brownDim },
  side: { paddingTop: spacing.sm, gap: 2 },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 21, color: colors.brownFaint },
});
