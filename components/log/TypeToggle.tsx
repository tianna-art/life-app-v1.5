import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { ENTRY_TYPES } from '@/constants/entry';
import type { EntryType } from '@/types';

interface TypeToggleProps {
  value: EntryType | null;
  onChange: (value: EntryType) => void;
}

/**
 * 出来事 / つぶやき (§3).
 *
 * Two words, no explanation. Neither is the "right" one and neither is worth
 * more than the other, so they are drawn identically — a difference in weight
 * would turn a one-tap sort into a small decision about oneself.
 */
export function TypeToggle({ value, onChange }: TypeToggleProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID="type-toggle">
      {ENTRY_TYPES.map((type) => {
        const selected = value === type.id;
        return (
          <Pressable
            key={type.id}
            testID={`type-${type.id}`}
            onPress={() => onChange(type.id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={type.label}
            accessibilityHint={type.covers.join('、')}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{type.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  chipSelected: { borderColor: colors.brass },
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: fonts.sans,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.ivoryFaint,
  },
  labelSelected: { color: colors.brass },
});
