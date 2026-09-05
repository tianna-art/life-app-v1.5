import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { LOG_TYPES } from '@/constants/log';
import type { LogType } from '@/types';

interface Level1PickerProps {
  value: LogType | null;
  onChange: (value: LogType) => void;
}

/**
 * 自分の行動 / 人との関わり / つぶやき (§9).
 *
 * The door the record is left through, not a classification of it. The three
 * overlap on purpose, so they are drawn identically — making one look like the
 * "main" one would turn a reflex into a small decision about oneself.
 */
export function Level1Picker({ value, onChange }: Level1PickerProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID="level1-picker">
      {LOG_TYPES.map((type) => {
        const selected = value === type.id;
        return (
          <Pressable
            key={type.id}
            testID={`level1-${type.id}`}
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  label: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 1, color: colors.ivoryFaint },
  labelSelected: { color: colors.brass },
});
