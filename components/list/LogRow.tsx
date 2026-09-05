import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { formatShortDate } from '@/utils/period';
import { logTypeLabel, momentTagLabel } from '@/constants/log';
import { CategoryIcon } from '@components/log/CategoryIcon';
import type { DailyLog } from '@/types';

/**
 * One row of the archive.
 *
 * LIST is where someone looks something up (§28), so the row shows what the
 * person themselves put there, in full: the door they left it through, the
 * date, what kind of moment it was, and everything they wrote. Nothing is
 * cut off — a row that ends in an ellipsis makes the archive a place you
 * have to tap through rather than read.
 *
 * The tags do the work a mood column would do elsewhere. v4 has no separate
 * feeling field — 楽しかった and モヤモヤ are tags like the rest, and §10 is
 * explicit that neither is a verdict, so they are drawn the same as 初めて or
 * 変えてみた rather than coloured by sentiment.
 */
export function LogRow({
  entry,
  onPress,
}: {
  entry: DailyLog;
  onPress: (id: string) => void;
}) {
  const written = entry.optionalAnswer || entry.body || '';
  const tags = entry.momentTags.map(momentTagLabel);

  return (
    <Pressable
      testID={`log-row-${entry.id}`}
      onPress={() => onPress(entry.id)}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${formatShortDate(entry.occurredOn)} ${logTypeLabel(
        entry.logType
      )} ${tags.join('、')} ${written}`}
      accessibilityHint="記録の全文を開きます"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {/* The mark comes first: it is the fastest thing on the row to read,
          and scanning for one kind of record is what this screen is for. */}
      <View style={styles.mark}>
        <CategoryIcon logType={entry.logType} />
      </View>

      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={styles.date}>{formatShortDate(entry.occurredOn)}</Text>
          <Text style={styles.category}>{logTypeLabel(entry.logType)}</Text>
          {tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>

        {/* Most records have no free text (§14). The row is complete without
            it — the door and the tags already say what was left. */}
        {written ? <Text style={styles.written}>{written}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  mark: { width: 16, paddingTop: 3, alignItems: 'center' },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  date: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1.2, color: colors.brassDim },
  category: { fontFamily: fonts.sans, fontSize: 12, color: colors.ivory },
  tag: { fontFamily: fonts.sans, fontSize: 11, color: colors.ivoryFaint },
  written: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 21, color: colors.ivoryDim },
});
