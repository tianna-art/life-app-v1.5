import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS, YEAR } from '@/constants/copy';
import { GAIN_CATEGORY_JA } from '@/constants/progression';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useYearReview } from '@/hooks/useMonthReview';

/**
 * The year-end reading (§26).
 *
 * The same comparison the month makes, one scale up. The two headings sit
 * together with nothing between them saying which was better — a year that
 * went somewhere else is not a year that fell short.
 */
export default function YearScreen() {
  const router = useRouter();
  const { year } = useLocalSearchParams<{ year: string }>();
  const yearNumber = Number(year);
  const { data: review, isLoading } = useYearReview(yearNumber, {
    enabled: Number.isFinite(yearNumber),
  });

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={LABELS.back}
        style={styles.back}
      >
        <Text style={styles.backLabel}>‹ {LABELS.back}</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.plate}>{year}</Text>

        {isLoading ? (
          <Text style={styles.dim}>読み込んでいます。</Text>
        ) : review ? (
          <>
            {review.initialTheme ? (
              <View style={styles.block}>
                <Text style={styles.section}>{YEAR.thought}</Text>
                <Text style={styles.initial}>{review.initialTheme}</Text>
              </View>
            ) : null}

            <HairlineRule />
            <View style={styles.block}>
              <Text style={styles.section}>{YEAR.became}</Text>
              <Text style={styles.actual}>{review.actualStory}</Text>
            </View>

            {review.progressions.length > 0 ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  {review.progressions.map((item) => (
                    <View key={item.title} style={styles.change}>
                      <Text style={styles.changeTitle}>{item.title}</Text>
                      <Text style={styles.changeLine}>{item.line}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {review.gained.length > 0 ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  <Text style={styles.section}>{LABELS.whatYouGained}</Text>
                  {review.gained.map((gain) => (
                    <View key={gain.label} style={styles.change}>
                      <Text style={styles.gainCategory}>{GAIN_CATEGORY_JA[gain.category]}</Text>
                      <Text style={styles.changeTitle}>{gain.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.dim}>この年は、まだ読まれていません。</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  block: { gap: spacing.sm },
  section: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 3, color: colors.ivoryFaint },
  initial: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 26, color: colors.ivoryDim },
  actual: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 36, color: colors.ivory },
  change: { gap: 2 },
  changeTitle: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28, color: colors.ivory },
  changeLine: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 24, color: colors.ivoryDim },
  gainCategory: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.6, color: colors.brassDim },
  dim: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.ivoryFaint },
});
