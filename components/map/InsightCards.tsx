import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import type { MonthHypothesis, MonthInsight } from '@/types';

/**
 * 見えてきたこと.
 *
 * Four cards at most, two to a row. Cards are only ever drawn from records
 * that exist, so an empty band stays empty: the rule the whole product rests
 * on is that a reading with nothing behind it is not produced, and a screen
 * that fills the gap with plausible sentences breaks it just as surely as a
 * model that invents them.
 *
 * A card with one record behind it says so and stays a 手がかり. It is not
 * generalised into a pattern, because one thing happening once is not one.
 */
const MAX_CARDS = 4;

/** Four steps of tint, no more: the kinds differ, they do not compete. */
const TINTS = ['#F7EFE4', '#F4E9E2', '#F6ECE6', '#F2EBE3'] as const;

export function InsightCards({
  insights,
  hypothesis,
  onOpen,
}: {
  insights: MonthInsight[];
  hypothesis: MonthHypothesis | null;
  onOpen: (insight: MonthInsight) => void;
}) {
  const shown = insights.slice(0, MAX_CARDS);

  if (shown.length === 0 && !hypothesis) {
    return (
      <View style={styles.empty} testID="insights-empty">
        <Text style={styles.emptyText}>{COPY.insightEmpty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid} testID="insight-cards">
      {shown.map((insight, index) => {
        const count = insight.evidenceLogIds.length;
        // An odd card at the end takes the whole row rather than leaving a
        // hole beside it.
        const wide = shown.length % 2 === 1 && index === shown.length - 1 && !hypothesis;
        return (
          <Pressable
            key={insight.id}
            testID={`insight-${insight.id}`}
            onPress={() => onOpen(insight)}
            accessibilityRole="button"
            accessibilityLabel={`${insight.label} ${insight.text}`}
            style={({ pressed }) => [
              styles.card,
              wide && styles.wide,
              { backgroundColor: TINTS[index % TINTS.length] },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.label}>{insight.label}</Text>
            <Text style={styles.text}>{insight.text}</Text>
            <View style={styles.foot}>
              <View style={styles.dot} />
              <Text style={styles.footText}>
                {count === 1 ? COPY.fromOneLog : `${COPY.relatedLogs} ${count} 件`}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {hypothesis ? (
        <View
          testID="insight-hypothesis"
          style={[styles.card, shown.length % 2 === 0 && styles.wide, { backgroundColor: TINTS[3] }]}
        >
          <Text style={styles.label}>{COPY.guessNow}</Text>
          <Text style={styles.text}>{hypothesis.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  wide: { flexBasis: '100%' },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 17, color: colors.orange },
  text: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 23, color: colors.brown },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: colors.orange },
  footText: { fontFamily: fonts.sans, fontSize: 10, color: colors.brownFaint },
  empty: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 22,
    color: colors.brownFaint,
    textAlign: 'center',
  },
});
