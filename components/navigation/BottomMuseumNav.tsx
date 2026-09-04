import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { MIN_TOUCH, colors, fonts, spacing } from '@/theme';

const ORDER = ['map', 'log', 'list'] as const;
type TabName = (typeof ORDER)[number];

const LABEL: Record<TabName, string> = { map: 'MAP', log: 'LOG', list: 'LIST' };

function TabMark({ name, active }: { name: TabName; active: boolean }) {
  const stroke = active ? colors.brass : colors.ivoryFaint;
  const size = name === 'log' ? 26 : 22;
  return (
    <Svg width={size} height={size} viewBox="-12 -12 24 24">
      {name === 'map' ? (
        <G>
          <Circle r={9.5} fill="none" stroke={stroke} strokeWidth={0.8} />
          <Circle cx={-3.4} cy={-3.6} r={1.5} fill={stroke} />
          <Circle cx={4.2} cy={-1.2} r={1.1} fill={stroke} />
          <Circle cx={-0.6} cy={4.6} r={1.3} fill={stroke} />
          <Line x1={-3.4} y1={-3.6} x2={4.2} y2={-1.2} stroke={stroke} strokeWidth={0.55} />
          <Line x1={4.2} y1={-1.2} x2={-0.6} y2={4.6} stroke={stroke} strokeWidth={0.55} />
        </G>
      ) : null}
      {name === 'log' ? (
        <G>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <Line
                key={i}
                x1={Math.cos(a) * 6}
                y1={Math.sin(a) * 6}
                x2={Math.cos(a) * (i % 2 === 0 ? 10.5 : 8.4)}
                y2={Math.sin(a) * (i % 2 === 0 ? 10.5 : 8.4)}
                stroke={stroke}
                strokeWidth={0.8}
              />
            );
          })}
          <Circle r={4.6} fill="none" stroke={stroke} strokeWidth={1} />
          <Circle r={1.7} fill={stroke} />
        </G>
      ) : null}
      {name === 'list' ? (
        <G>
          <Path d="M -9 -7 H 9 M -9 -1 H 9 M -9 5 H 3" stroke={stroke} strokeWidth={0.9} fill="none" />
          <Circle cx={7.6} cy={5} r={1.4} fill={stroke} />
        </G>
      ) : null}
    </Svg>
  );
}

/**
 * MAP | LOG | LIST, in that order, with LOG carrying slightly more weight
 * at the centre (spec §12.4).
 */
export function BottomMuseumNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.hairline} />
      <View style={styles.row}>
        {ORDER.map((name) => {
          const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === name);
          const focused = state.index === routeIndex;
          return (
            <Pressable
              key={name}
              testID={`tab-${name}`}
              onPress={() => {
                const route = state.routes[routeIndex];
                if (!route) return;
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABEL[name]}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <TabMark name={name} active={focused} />
              <Text
                style={[
                  styles.label,
                  name === 'log' && styles.labelCenter,
                  focused && styles.labelActive,
                ]}
              >
                {LABEL[name]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.ink },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.frameSoft },
  row: { flexDirection: 'row', paddingTop: spacing.sm },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
  },
  labelCenter: { fontSize: 11, letterSpacing: 3.2 },
  labelActive: { color: colors.brass },
});
