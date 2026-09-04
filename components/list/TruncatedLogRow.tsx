import { Pressable, StyleSheet, Text } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { formatShortDate } from '@/utils/period';
import { truncate } from '@/utils/text';
import type { JournalLog } from '@/types';

/** `09/04  新しい企画の方向性が見えて…` — one line, ellipsis, tap for detail. */
export function TruncatedLogRow({
  log,
  onPress,
  maxChars = 22,
}: {
  log: JournalLog;
  onPress: (id: string) => void;
  maxChars?: number;
}) {
  const preview = truncate(log.body, maxChars);
  return (
    <Pressable
      testID={`log-row-${log.id}`}
      onPress={() => onPress(log.id)}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${formatShortDate(log.occurredOn)} ${preview}`}
      accessibilityHint="記録の詳細を開きます"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.date}>{formatShortDate(log.occurredOn)}</Text>
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
