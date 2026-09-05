import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { formatMonthEyebrow } from '@/utils/period';

/**
 * The month-end announcement, on HOME (§19).
 *
 * One line, once, and it waits to be tapped. A month ending is not an event
 * the app should interrupt someone for — it is something that quietly becomes
 * available, the way a plate appears beside a finished piece.
 */
export function MonthCompleteLine({
  monthKey,
  onPress,
}: {
  monthKey: string;
  onPress: (monthKey: string) => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(800)}>
      <Pressable
        testID="month-complete-line"
        onPress={() => onPress(monthKey)}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${formatMonthEyebrow(monthKey)} ${LABELS.monthComplete}`}
        accessibilityHint="この月のまとめを開きます"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={styles.month}>{formatMonthEyebrow(monthKey)}</Text>
        <Text style={styles.line}>{LABELS.monthComplete}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.frameSoft,
  },
  pressed: { opacity: 0.6 },
  month: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2.6, color: colors.frame },
  line: { fontFamily: fonts.sans, fontSize: 10.5, letterSpacing: 2.8, color: colors.brassDim },
});
