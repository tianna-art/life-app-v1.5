import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS, MONTH } from '@/constants/copy';
import { GAIN_CATEGORY_JA } from '@/constants/progression';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useSaveMonthTheme } from '@/hooks/useLens';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow } from '@/utils/period';

/**
 * The month-end reading (§25).
 *
 * Five sections, in the order §25 gives them, and the first two are the point:
 * what the month set out with, then what actually happened. §7 forbids reading
 * a divergence as a shortfall — so the two sit side by side with nothing
 * between them saying which was better.
 */
export default function MonthScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const periodKey = key ?? '';

  const { data: review, isLoading } = useMonthReview(periodKey);
  const saveTheme = useSaveMonthTheme();
  const markSeen = useUiStore((s) => s.markMonthEndSeen);

  // Opening the reading is what marks it seen: the line on HOME never repeats.
  useEffect(() => {
    if (periodKey.length > 0) markSeen(periodKey);
  }, [periodKey, markSeen]);

  const chooseTitle = (title: string) => {
    saveTheme.mutate({
      year: Number(periodKey.slice(0, 4)),
      month: Number(periodKey.slice(5, 7)),
      finalTheme: title,
      source: 'custom',
    });
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()}>
        <Text style={styles.plate}>{formatMonthEyebrow(periodKey)}</Text>
      </TopBar>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <Text style={styles.dim}>読み込んでいます。</Text>
        ) : review ? (
          <>
            <Text style={styles.complete}>{LABELS.monthComplete}</Text>

            {/* §25's first pair. Printed together, with no verdict between. */}
            {review.initialTheme ? (
              <View style={styles.block}>
                <Text style={styles.section}>{MONTH.startedWith}</Text>
                <Text style={styles.initial}>{review.initialTheme}</Text>
              </View>
            ) : null}

            {review.whatActuallyHappened ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  <Text style={styles.section}>{MONTH.actuallyHappened}</Text>
                  <Text style={styles.actual}>{review.whatActuallyHappened}</Text>
                </View>
              </>
            ) : null}

            {review.changed.length > 0 ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  <Text style={styles.section}>{MONTH.changed}</Text>
                  {review.changed.map((item) => (
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
                  <Text style={styles.section}>{MONTH.gained}</Text>
                  {review.gained.map((gain) => (
                    <View key={gain.label} style={styles.change}>
                      <Text style={styles.gainCategory}>{GAIN_CATEGORY_JA[gain.category]}</Text>
                      <Text style={styles.changeTitle}>{gain.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* The month's name. Three offered; the person picks. Passing over
                all three is a valid outcome and leaves the month unnamed. */}
            {review.titleCandidates.length > 0 ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  <Text style={styles.section}>{MONTH.chooseTitle}</Text>
                  {review.titleCandidates.map((candidate) => (
                    <Pressable
                      key={candidate}
                      testID={`month-title-${candidate}`}
                      onPress={() => chooseTitle(candidate)}
                      hitSlop={HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={candidate}
                      style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
                    >
                      <Text style={styles.candidateText}>{candidate}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : review.title ? (
              <>
                <HairlineRule />
                <Text style={styles.title}>{review.title}</Text>
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.dim}>この月は、まだ読まれていません。</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  complete: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 3,
    color: colors.ivoryFaint,
  },
  block: { gap: spacing.sm },
  section: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 3, color: colors.ivoryFaint },
  initial: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 26, color: colors.ivoryDim },
  actual: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 32, color: colors.ivory },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 34, color: colors.ivory },
  change: { gap: 2 },
  changeTitle: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28, color: colors.ivory },
  changeLine: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 24, color: colors.ivoryDim },
  gainCategory: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.6, color: colors.brassDim },
  candidate: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  candidateText: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 30, color: colors.ivory },
  pressed: { opacity: 0.6 },
  dim: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.ivoryFaint },
});
