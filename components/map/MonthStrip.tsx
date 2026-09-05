import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { formatMonthTiny, parseMonthKey } from '@/utils/period';

interface MonthStripProps {
  months: readonly string[];
  value: string;
  onChange: (monthKey: string) => void;
}

/**
 * The months, side by side, swiped horizontally (§18).
 *
 * Each month is its own sky and they are never mixed, so this is a selector
 * and not a range. The year is printed only where it changes, which is the
 * only place it tells you anything.
 */
export function MonthStrip({ months, value, onChange }: MonthStripProps) {
  const scrollRef = useRef<ScrollView>(null);
  const index = months.indexOf(value);

  useEffect(() => {
    if (index < 0) return;
    // Keep the chosen month roughly a third in from the left edge.
    scrollRef.current?.scrollTo({ x: Math.max(0, index * 74 - 90), animated: true });
  }, [index]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="month-strip"
    >
      {months.map((key, position) => {
        const selected = key === value;
        const { year } = parseMonthKey(key);
        const previous = months[position - 1];
        const showYear = !previous || parseMonthKey(previous).year !== year;

        return (
          <Pressable
            key={key}
            testID={`month-${key}`}
            onPress={() => onChange(key)}
            hitSlop={HIT_SLOP}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${year}年${parseMonthKey(key).month}月`}
            style={styles.item}
          >
            <Text style={[styles.month, selected && styles.monthSelected]}>
              {formatMonthTiny(key)}
            </Text>
            <Text style={styles.year}>{showYear ? year : ' '}</Text>
            <View style={[styles.rule, selected && styles.ruleSelected]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.lg, paddingRight: spacing.gallery },
  item: { minHeight: MIN_TOUCH, minWidth: 42, alignItems: 'center', justifyContent: 'center', gap: 2 },
  month: { fontFamily: fonts.serif, fontSize: 16, color: colors.ivoryFaint },
  monthSelected: { color: colors.ivory },
  year: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.4, color: colors.frame },
  rule: { height: 1, width: 22, backgroundColor: 'transparent' },
  ruleSelected: { backgroundColor: colors.brass },
});
