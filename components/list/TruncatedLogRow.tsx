import { Pressable, StyleSheet, Text } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { formatShortDate } from '@/utils/period';
import { momentTagLabel } from '@/constants/log';
import { truncate } from '@/utils/text';
import type { DailyLog } from '@/types';

/** `09/04  新しい企画の方向性が見えて…` — one line, ellipsis, tap for the full text. */
export function TruncatedLogRow({
  entry,
  onPress,
  maxChars = 22,
}: {
  entry: DailyLog;
  onPress: (id: string) => void;
  maxChars?: number;
}) {
  // A v4 record may have no free text at all (§14). Its tags are then the only
  // thing there is to show, and they are the person's own words — so the row
  // reads 「初めて・楽しかった」 rather than an empty line or a placeholder.
  const preview = truncate(
    entry.optionalAnswer || entry.body || entry.momentTags.map(momentTagLabel).join('・'),
    maxChars
  );
  return (
    <Pressable
      testID={`log-row-${entry.id}`}
      onPress={() => onPress(entry.id)}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${formatShortDate(entry.occurredOn)} ${preview}`}
      accessibilityHint="記録の全文を開きます"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.date}>{formatShortDate(entry.occurredOn)}</Text>
      <Text style={styles.body} numberOfLines={1}>
        {preview}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH - 8,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  date: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim, width: 46 },
  body: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ivory },
});
