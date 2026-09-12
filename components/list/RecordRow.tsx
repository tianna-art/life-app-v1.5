import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { categoryById } from '@/constants/antennas';
import type { JournalLog } from '@/types';

/**
 * One record as it reads in 足跡データ: the day, what kind of thing it was,
 * and the line itself, whole. Records are not truncated here — this is the
 * place they are read, not indexed.
 */
export function RecordRow({ log }: { log: JournalLog }) {
  const kind = log.categoryId ? categoryById(log.categoryId)?.label : undefined;
  return (
    <View style={styles.row} testID={`record-${log.id}`}>
      <View style={styles.head}>
        <Text style={styles.date}>{dayLabel(log)}</Text>
        {kind ? <Text style={styles.kind}>{kind}</Text> : null}
      </View>
      <Text style={styles.body}>{log.body}</Text>
    </View>
  );
}

/**
 * A record with no day shows only its month. Inventing a day for it would put
 * it on one that did not happen.
 */
function dayLabel(log: JournalLog): string {
  if (!log.occurredOn) return `${Number(log.periodKey.slice(5, 7))}月`;
  const [, month, day] = log.occurredOn.split('-');
  return `${Number(month)}/${Number(day)}`;
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  date: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint },
  kind: { fontFamily: fonts.sans, fontSize: 12, color: colors.orange },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 23, color: colors.brown },
});
