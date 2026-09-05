import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { formatMonthShort } from '@/utils/period';
import { TruncatedLogRow } from './TruncatedLogRow';
import type { DailyLog, MonthReview } from '@/types';

interface MonthSectionProps {
  monthKey: string;
  entries: readonly DailyLog[];
  review: MonthReview | null;
  onEntryPress: (id: string) => void;
  onReviewPress: (monthKey: string) => void;
}

/**
 * One month of the archive (§20).
 *
 * Deliberately plain: this screen is where the person looks something up, so
 * it is a list of dates and first lines. The month's title is the only piece
 * of interpretation on it, and it links to the month's reading rather than
 * explaining itself here.
 */
export function MonthSection({
  monthKey,
  entries,
  review,
  onEntryPress,
  onReviewPress,
}: MonthSectionProps) {
  return (
    <View style={styles.section} testID={`month-section-${monthKey}`}>
      {review ? (
        <Pressable
          onPress={() => onReviewPress(monthKey)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${formatMonthShort(monthKey)} ${review.title}`}
          accessibilityHint="この月のまとめを開きます"
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        >
          <Text style={styles.month}>{formatMonthShort(monthKey)}</Text>
          <Text style={styles.dash}>—</Text>
          <Text style={styles.title}>{review.title}</Text>
        </Pressable>
      ) : (
        <View style={styles.header}>
          <Text style={styles.month}>{formatMonthShort(monthKey)}</Text>
        </View>
      )}

      <View style={styles.rows}>
        {entries.map((entry) => (
          <TruncatedLogRow key={entry.id} entry={entry} onPress={onEntryPress} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  pressed: { opacity: 0.6 },
  month: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3, color: colors.brassDim },
  dash: { fontFamily: fonts.sans, fontSize: 11, color: colors.frame },
  title: { fontFamily: fonts.serif, fontSize: 15, letterSpacing: 1.2, color: colors.ivoryDim },
  rows: { marginTop: spacing.xs },
});
