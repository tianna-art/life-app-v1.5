import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow } from '@/utils/period';

/**
 * The month-end screen (§19).
 *
 * Three pieces of information and a lot of quiet. No totals, no streak, no
 * comparison against a goal — the change line is a comparison against the
 * person's own earlier records or it is not printed at all.
 */
export default function MonthEndScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string }>();
  const periodKey = typeof params.key === 'string' ? params.key : '';

  const { data: review, isLoading } = useMonthReview(periodKey);
  const markSeen = useUiStore((s) => s.markMonthEndSeen);

  useEffect(() => {
    if (periodKey) markSeen(periodKey);
  }, [periodKey, markSeen]);

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
        <Text style={styles.plate}>{formatMonthEyebrow(periodKey)}</Text>

        {isLoading ? (
          <Text style={styles.dim}>読み込んでいます。</Text>
        ) : review ? (
          <Animated.View entering={FadeIn.duration(900)} style={styles.content}>
            <Text style={styles.complete}>{LABELS.monthComplete}</Text>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>{review.title}</Text>
              {review.subtitle ? <Text style={styles.subtitle}>{review.subtitle}</Text> : null}
            </View>

            {review.gains.length > 0 ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  <Text style={styles.section}>{LABELS.threeGains}</Text>
                  {review.gains.slice(0, 3).map((gain) => (
                    <Text key={gain} style={styles.gain}>
                      {gain}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}

            {review.oneChange ? (
              <>
                <HairlineRule />
                <View style={styles.block}>
                  <Text style={styles.section}>{LABELS.oneChange}</Text>
                  <Text style={styles.change}>{review.oneChange}</Text>
                </View>
              </>
            ) : null}
          </Animated.View>
        ) : (
          <Text style={styles.dim}>この月は、まだ読まれていません。</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.lg },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  content: { gap: spacing.xl },
  complete: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 3.4,
    color: colors.ivoryFaint,
  },
  titleBlock: { gap: spacing.sm },
  title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 40, letterSpacing: 1.6, color: colors.ivory },
  subtitle: { fontFamily: fonts.serif, fontSize: 15, color: colors.ivoryDim },
  block: { gap: spacing.sm },
  section: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2.8, color: colors.brassDim },
  gain: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28, color: colors.ivory },
  change: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 25, color: colors.ivoryDim },
  dim: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
});
