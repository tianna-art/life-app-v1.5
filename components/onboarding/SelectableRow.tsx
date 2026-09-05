import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';

interface SelectableRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}

/**
 * One choice, in a list of them.
 *
 * The mark is a hairline that fills, not a checkbox: §28 keeps the whole app
 * at 90% quiet, and a column of boxes reads as a form to be completed rather
 * than a set of things someone happens to want.
 */
export function SelectableRow({
  label,
  selected,
  onPress,
  testID,
  disabled = false,
}: SelectableRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled && !selected}
      hitSlop={HIT_SLOP}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: disabled && !selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.mark, selected && styles.markSelected]} />
      <Text
        style={[
          styles.label,
          selected && styles.labelSelected,
          disabled && !selected && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { opacity: 0.6 },
  mark: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  markSelected: { backgroundColor: colors.brass, borderColor: colors.brass },
  label: { flex: 1, fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.ivoryDim },
  labelSelected: { color: colors.ivory },
  labelDisabled: { color: colors.frame },
});
