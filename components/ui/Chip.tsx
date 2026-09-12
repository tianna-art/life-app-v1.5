import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';

/**
 * The one selectable thing in this app: a pill with a hairline, filled brown
 * when chosen. Chips wrap rather than scroll — a row you have to drag through
 * hides half the choices, and these are meant to be read at a glance.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  tint,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
  /** Fills the chip when it is not selected — used by the アンテナ band. */
  tint?: string | undefined;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        tint && !selected ? { backgroundColor: tint, borderColor: 'transparent' } : null,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH - 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  selected: { backgroundColor: colors.brown, borderColor: colors.brown },
  pressed: { opacity: 0.62 },
  label: { fontFamily: fonts.sans, fontSize: 14, color: colors.brown },
  labelSelected: { color: colors.onBrown },
});
