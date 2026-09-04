import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import type { ListFilter } from '@/state/uiStore';

const OPTIONS: Array<{ value: ListFilter; label: string }> = [
  { value: 'all', label: LABELS.all },
  { value: 'event', label: LABELS.event },
  { value: 'thought', label: LABELS.thought },
];

/** すべて ｜ 出来事 ｜ つぶやき — always directly under the yearly heading. */
export function LogFilterTabs({
  value,
  onChange,
}: {
  value: ListFilter;
  onChange: (value: ListFilter) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist" testID="log-filter-tabs">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            testID={`filter-${option.value}`}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
            <View style={[styles.underline, selected && styles.underlineSelected]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  tab: { minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 1, color: colors.ivoryFaint },
  labelSelected: { color: colors.ivory },
  underline: { height: 1, width: '100%', backgroundColor: 'transparent' },
  underlineSelected: { backgroundColor: colors.brass },
});
