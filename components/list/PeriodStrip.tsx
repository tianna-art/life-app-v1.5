import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { footprintState, periodLabel, type FootprintState } from '@/utils/footprint';
import type { PeriodTitle } from '@/types';

/**
 * The months (or years) laid end to end, each showing the name it was given.
 *
 * The one you are standing in is marked, not celebrated: it carries a line
 * saying its name can be made once it is over, because a month still being
 * lived has not finished being what it was.
 */
export function PeriodStrip({
  periodKeys,
  titles,
  selected,
  today,
  firstUsedKey,
  onSelect,
}: {
  periodKeys: string[];
  titles: PeriodTitle[];
  selected: string;
  today: Date;
  firstUsedKey?: string | undefined;
  onSelect: (periodKey: string) => void;
}) {
  const scroller = useRef<ScrollView>(null);

  // Opens on the far end — the months just gone are the ones being read.
  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(id);
  }, [periodKeys.length]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Without this the strip takes every spare pixel of the column and
      // pushes the month's records off the bottom of the screen.
      style={styles.scroller}
      testID="period-strip"
    >
      {periodKeys.map((key) => {
        const title = titles.find((t) => t.periodKey === key);
        const state = footprintState({
          periodKey: key,
          today,
          hasTitle: Boolean(title),
          firstUsedKey,
        });
        const on = key === selected;
        return (
          <Pressable
            key={key}
            testID={`period-${key}`}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${periodLabel(key)} ${title?.title ?? ''}`.trim()}
            style={styles.item}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{periodLabel(key)}</Text>
            <Text style={[styles.title, on && styles.titleOn]} numberOfLines={3}>
              {title?.title ?? placeholderFor(state)}
            </Text>
            <View style={[styles.rule, on && styles.ruleOn]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function placeholderFor(state: FootprintState): string {
  switch (state) {
    case 'hand':
      return COPY.handTitle;
    case 'ready':
      return COPY.reviewReady;
    case 'waiting':
      return COPY.titlePending;
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { gap: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  item: { width: 150, gap: spacing.xs },
  label: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint, textAlign: 'center' },
  labelOn: { color: colors.orange },
  title: {
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 20,
    color: colors.brownDim,
    textAlign: 'center',
    minHeight: 60,
  },
  titleOn: { color: colors.brown },
  rule: { height: 1, backgroundColor: colors.hairline },
  ruleOn: { backgroundColor: colors.orange, height: 1.5 },
});
