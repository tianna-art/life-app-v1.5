import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts } from '@/theme';
import { formatMonthEyebrow } from '@/utils/period';

interface MonthNavProps {
  monthKey: string;
  /** Whether stepping forward is possible. False on the current month. */
  canGoForward: boolean;
  onStep: (delta: number) => void;
  /** Opens this month's reading. Absent while the month is still being lived. */
  onOpen?: (() => void) | undefined;
  openLabel?: string;
}

/**
 * The month plate, with a way out of it in either direction.
 *
 * Stepping forward stops at the current month: there is nothing recorded in
 * the future, and an arrow that leads to an empty screen is a worse answer
 * than an arrow that is not there.
 */
export function MonthNav({
  monthKey,
  canGoForward,
  onStep,
  onOpen,
  openLabel,
}: MonthNavProps) {
  return (
    <View style={styles.row} testID="month-nav">
      <Pressable
        testID="month-prev"
        onPress={() => onStep(-1)}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="前の月"
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Text style={styles.arrowGlyph}>‹</Text>
      </Pressable>

      {onOpen ? (
        <Pressable
          testID="month-open"
          onPress={onOpen}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${formatMonthEyebrow(monthKey)} ${openLabel ?? ''}`}
          style={({ pressed }) => [styles.plateBox, pressed && styles.pressed]}
        >
          <Text style={styles.plate}>{formatMonthEyebrow(monthKey)}</Text>
        </Pressable>
      ) : (
        <View style={styles.plateBox}>
          <Text style={styles.plate}>{formatMonthEyebrow(monthKey)}</Text>
        </View>
      )}

      <Pressable
        testID="month-next"
        onPress={() => onStep(1)}
        disabled={!canGoForward}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="次の月"
        accessibilityState={{ disabled: !canGoForward }}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Text style={[styles.arrowGlyph, !canGoForward && styles.arrowIdle]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  arrow: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  arrowGlyph: { fontFamily: fonts.serif, fontSize: 20, color: colors.brassDim, lineHeight: 24 },
  arrowIdle: { color: colors.frame },
  plateBox: { flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' },
  plate: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 3.2,
    color: colors.brassDim,
  },
});
