import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';

interface TopBarProps {
  /** What the bar says: a back link, a year, a month plate. Centred. */
  children?: ReactNode;
  /** Shown as `‹ もどる` in the middle when there is nothing else there. */
  onBack?: () => void;
  /** Pinned to the right edge — a menu, usually. */
  right?: ReactNode;
}

/**
 * The bar every screen opens with.
 *
 * Its contents sit in the middle of the screen. What is on the right is pinned
 * there and laid over the row rather than placed in it, so a menu button on
 * one screen and nothing on another still leave the centre in the same place —
 * the plate does not shift by a few pixels as you move between screens.
 */
export function TopBar({ children, onBack, right }: TopBarProps) {
  return (
    <View style={styles.bar} testID="top-bar">
      <View style={styles.centre}>
        {onBack ? (
          <Pressable
            testID="top-bar-back"
            onPress={onBack}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={LABELS.back}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backLabel}>‹ {LABELS.back}</Text>
          </Pressable>
        ) : null}
        {children}
      </View>

      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  centre: { alignItems: 'center', gap: spacing.xs },
  back: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  pressed: { opacity: 0.6 },
  right: { position: 'absolute', right: 0, top: spacing.md },
});
