import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import type { LogType } from '@/types';

interface LogTypeToggleProps {
  value: LogType | null;
  onChange: (type: LogType) => void;
}

/** Step A of the composer. Required — nothing is preselected. */
export function LogTypeToggle({ value, onChange }: LogTypeToggleProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID="log-type-toggle">
      {(['event', 'thought'] as const).map((type) => {
        const selected = value === type;
        return (
          <Pressable
            key={type}
            testID={`log-type-${type}`}
            onPress={() => onChange(type)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={type === 'event' ? LABELS.event : LABELS.thought}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {type === 'event' ? LABELS.event : LABELS.thought}
            </Text>
            {selected ? <View style={styles.underline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  option: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  optionSelected: {},
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: fonts.serif,
    fontSize: 19,
    color: colors.ivoryFaint,
  },
  labelSelected: { color: colors.ivory },
  underline: {
    marginTop: spacing.xs,
    height: 1,
    width: '100%',
    backgroundColor: colors.brass,
  },
});
