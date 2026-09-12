import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { REVIEW_TABS, YEAR_REVIEW_TABS } from '@/constants/generated/preview';
import type { PeriodType } from '@/types';

export type ScopeTab = 'map' | 'summary' | 'records' | 'change';

export type ScopeTabSpec = readonly [ScopeTab, string];

/** マップ | 要約 | 出来事 — what a finished period offers at any time. */
export const PERIOD_TABS: readonly ScopeTabSpec[] = [
  ['map', 'マップ'],
  ['summary', '要約'],
  ['records', '出来事'],
];

/**
 * The fourth tab, and only while a name is being decided.
 *
 * 「4つ目（先月からの変化 / 去年との違い）は、名前を決めている時だけ。比べるの
 * は名前を付ける時の作業で、普段の地図には要りません。」 — comparing is part of
 * naming a period, not part of living in one, so it is not on offer the rest
 * of the time. Its label differs by period and is taken from the preview
 * rather than retyped.
 */
export function namingTabs(periodType: PeriodType): readonly ScopeTabSpec[] {
  const source = periodType === 'month' ? REVIEW_TABS : YEAR_REVIEW_TABS;
  const change = source.find(([id]) => id === 'change')?.[1] ?? '';
  return [
    ['summary', '要約'],
    ['records', '出来事'],
    ['change', change],
  ];
}

/**
 * The row above a period's card.
 *
 * Every tab it is given is shown even when there is nothing behind it. A tab
 * row that appears once there is content teaches nothing about what the period
 * will hold, and makes an empty month look like a broken screen rather than an
 * early one.
 */
export function ScopeTabs({
  value,
  onChange,
  tabs = PERIOD_TABS,
}: {
  value: ScopeTab;
  onChange: (tab: ScopeTab) => void;
  tabs?: readonly ScopeTabSpec[];
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map(([id, label]) => {
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
