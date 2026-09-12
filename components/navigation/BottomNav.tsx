import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';

const ORDER = ['map', 'log', 'list', 'settings'] as const;
export type TabName = (typeof ORDER)[number];

export const TAB_LABEL: Record<TabName, string> = {
  map: '方向性マップ',
  log: '入力',
  list: '足跡データ',
  settings: 'マイページ',
};

/**
 * The four marks. Selected is a fill, never a colour change: the stroke weight
 * stays the same so the row does not appear to move when you switch tabs.
 */
function TabMark({ name, active }: { name: TabName; active: boolean }) {
  const stroke = active ? colors.brownDeep : colors.brownFaint;
  const body = active ? stroke : 'none';

  return (
    <Svg width={22} height={22} viewBox="-12 -12 24 24">
      {/* 方向性マップ — a folded map: three panels and the creases. */}
      {name === 'map' ? (
        <G>
          <Path
            d="M -9 -5.6 L -3 -8 L 3 -5.6 L 9 -8 V 6 L 3 8.4 L -3 6 L -9 8.4 Z"
            fill={active ? 'rgba(83, 64, 34, 0.16)' : 'none'}
            stroke={stroke}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Path
            d="M -3 -8 V 6 M 3 -5.6 V 8.4"
            fill="none"
            stroke={stroke}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
        </G>
      ) : null}

      {/* 入力 — a pencil. This is where you write, so it is the tool. */}
      {name === 'log' ? (
        <G>
          <Path
            d="M -8 8 L -7.2 3.4 L 3.4 -7.2 L 7.2 -3.4 L -3.4 7.2 Z"
            fill={body}
            stroke={stroke}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <Path
            d="M 3.4 -7.2 L 5.6 -9.4 C 6.6 -10.4 8.2 -10.4 9.2 -9.4 C 10.2 -8.4 10.2 -6.8 9.2 -5.8 L 7.2 -3.4"
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </G>
      ) : null}

      {/* 足跡データ — two bare footprints, toes fanning outward. */}
      {name === 'list' ? (
        <G>
          <Footprint x={-5.2} y={-3.2} flip={false} stroke={stroke} body={body} />
          <Footprint x={6} y={3} flip stroke={stroke} body={body} />
        </G>
      ) : null}

      {/* マイページ — a person. */}
      {name === 'settings' ? (
        <G>
          <Circle cx={0} cy={-3.8} r={4.4} fill={body} stroke={stroke} strokeWidth={1.1} />
          <Path
            d="M -8.4 9 C -8.4 3.6 -4.6 0.8 0 0.8 C 4.6 0.8 8.4 3.6 8.4 9 Z"
            fill={body}
            stroke={stroke}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        </G>
      ) : null}
    </Svg>
  );
}

const TOES = [
  [-3.6, -7.6, 2, 2.5, -14],
  [-0.4, -9.5, 1.6, 2, -6],
  [2.2, -9.7, 1.45, 1.8, 4],
  [4.6, -8.9, 1.3, 1.6, 14],
  [6.6, -7.3, 1.1, 1.4, 24],
] as const;

function Footprint({
  x,
  y,
  flip,
  stroke,
  body,
}: {
  x: number;
  y: number;
  flip: boolean;
  stroke: string;
  body: string;
}) {
  // The two feet together open by 45°, so each turns 22.5° outward.
  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -0.62 : 0.62} 0.62) rotate(-22.5)`}>
      <Path
        d={
          'M -1.2 -4.6 C 3 -5.4 5.6 -3 5.4 0.4 C 5.2 3.4 2.6 5.2 2 7' +
          ' C 1.4 8.8 3 9.8 2.8 11.2 C 2.6 13 1 14 -0.8 14' +
          ' C -2.8 14 -4.4 12.6 -4.4 10.6 C -4.4 8.2 -2.4 6.8 -2.4 4.6' +
          ' C -2.4 1.6 -5 -1.4 -4.2 -3 C -3.6 -4.2 -2.4 -4.5 -1.2 -4.6 Z'
        }
        fill={body}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {TOES.map(([cx, cy, rx, ry, rot], i) => (
        <Ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={body}
          stroke={stroke}
          strokeWidth={1.6}
          transform={`rotate(${rot} ${cx} ${cy})`}
        />
      ))}
    </G>
  );
}

/**
 * 方向性マップ | 入力 | 足跡データ | マイページ.
 *
 * The selected tab is a faint rounded panel behind the mark, not an orange
 * block: the bar should read as a row of four equal things, one of which you
 * are standing on.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name as TabName | undefined;

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      accessibilityRole="tablist"
    >
      {ORDER.map((name) => {
        const route = state.routes.find((r) => r.name === name);
        if (!route) return null;
        const active = current === name;
        return (
          <Pressable
            key={name}
            testID={`tab-${name}`}
            onPress={() => navigation.navigate(route.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={TAB_LABEL[name]}
            style={({ pressed }) => [
              styles.item,
              active && styles.itemActive,
              pressed && styles.pressed,
            ]}
          >
            <TabMark name={name} active={active} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {TAB_LABEL[name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm + 4,
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
  },
  itemActive: { backgroundColor: 'rgba(83, 64, 34, 0.06)' },
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.brownFaint,
  },
  labelActive: { color: colors.brownDeep },
});
