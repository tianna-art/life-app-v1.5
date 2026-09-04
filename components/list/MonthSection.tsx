import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE } from '@/constants/copy';
import { formatMonthEyebrow, formatMonthJa } from '@/utils/period';
import { MonthlyTitleCard } from '@components/titles/MonthlyTitleCard';
import { TruncatedLogRow } from './TruncatedLogRow';
import type { JournalLog, MonthlyIntention } from '@/types';

interface MonthSectionProps {
  monthKey: string;
  logs: JournalLog[];
  /** Total logs in the month, before the type filter — drives the AI unlock. */
  unfilteredCount: number;
  intention: MonthlyIntention | null;
  onLogPress: (id: string) => void;
}

/** One month of the year list: name, title, optional intention, then the logs. */
export function MonthSection({
  monthKey,
  logs,
  unfilteredCount,
  intention,
  onLogPress,
}: MonthSectionProps) {
  return (
    <View style={styles.section} testID={`month-section-${monthKey}`}>
      <View style={styles.header}>
        <Text style={styles.monthEn}>{formatMonthEyebrow(monthKey).split(' ')[0]}</Text>
        <Text style={styles.monthJa}>{formatMonthJa(monthKey)}</Text>
      </View>

      <MonthlyTitleCard monthKey={monthKey} logCount={unfilteredCount} compact />

      {intention?.body ? <Text style={styles.intention}>{intention.body}</Text> : null}

      {logs.length === 0 ? (
        <Text style={styles.empty}>{EMPTY_STATE.list}</Text>
      ) : (
        <View style={styles.logs}>
          {logs.map((log) => (
            <TruncatedLogRow key={log.id} log={log} onPress={onLogPress} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  monthEn: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3, color: colors.brassDim },
  monthJa: { fontFamily: fonts.serif, fontSize: 15, color: colors.ivoryFaint },
  intention: { fontFamily: fonts.sans, fontSize: 12, color: colors.ivoryFaint },
  empty: { fontFamily: fonts.serif, fontSize: 14, color: colors.ivoryFaint, paddingVertical: spacing.sm },
  logs: { marginTop: spacing.xs },
});
