import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';

export type ScopeTab = 'map' | 'summary' | 'records';

const TABS: [ScopeTab, string][] = [
  ['map', 'マップ'],
  ['summary', '要約'],
  ['records', '出来事'],
];

/**
 * マップ | 要約 | 出来事, always on screen.
 *
 * All three are shown even when there is nothing behind them. A tab row that
 * appears once there is content teaches nothing about what the period will
 * hold, and makes an empty month look like a broken screen rather than an
 * early one.
 */
export function ScopeTabs({
  value,
  onChange,
}: {
  value: ScopeTab;
  onChange: (tab: ScopeTab) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {TABS.map(([id, label]) => {
        const on = value === id;
        return (
          <Pressable
            key={id}
            testID={`scope-tab-${id}`}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.tab, on && styles.on, pressed && styles.pressed]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  tab: {
    minHeight: MIN_TOUCH - 12,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  on: { borderColor: colors.hairline, backgroundColor: colors.paper },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  labelOn: { color: colors.brown },
});
