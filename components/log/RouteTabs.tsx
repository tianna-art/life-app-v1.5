import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';

export type LogRoute = 'category' | 'future' | 'flow';

const ROUTES: [LogRoute, string][] = [
  ['category', 'ひとこと記録'],
  ['future', '未来メモ'],
  ['flow', '感情クエスト'],
];

/**
 * The three ways of writing. Selected is a thin frame and brown type — the
 * same rule as the bottom bar, so the two rows never fight each other.
 */
export function RouteTabs({
  value,
  onChange,
}: {
  value: LogRoute;
  onChange: (route: LogRoute) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {ROUTES.map(([id, label]) => {
        const on = value === id;
        return (
          <Pressable
            key={id}
            testID={`route-${id}`}
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
  row: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH - 8,
    alignItems: 'center',
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
