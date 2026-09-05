import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { ONBOARDING } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useGenerateLenses } from '@/hooks/useLens';
import { useOnboardingDraft } from '@/state/uiStore';

/**
 * §4 — 「今年は、こんな変化を見ていきます」
 *
 * The one screen where the app says what it is going to do. It is shown once,
 * it is not editable, and it is not a list of goals — which is why there is
 * nothing to confirm here beyond carrying on.
 */
export default function LensScreen() {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const generate = useGenerateLenses();

  useEffect(() => {
    if (draft.lenses.length > 0 || generate.isPending) return;
    generate.mutate(
      { selectedAreas: draft.selectedAreas, desiredSelfCards: draft.desiredSelfCards },
      { onSuccess: (lenses) => draft.setLenses(lenses) }
    );
    // Runs once for this draft; the mutation itself carries the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{ONBOARDING.lensHeading}</Text>
        <HairlineRule />

        {draft.lenses.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brass} />
          </View>
        ) : (
          <View style={styles.list}>
            {draft.lenses.map((lens) => (
              <Text key={lens} style={styles.lens}>
                {lens}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        testID="lens-next"
        onPress={() => router.push('/onboarding/theme')}
        disabled={draft.lenses.length === 0}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={ONBOARDING.next}
        style={({ pressed }) => [styles.next, pressed && styles.pressed]}
      >
        <Text style={[styles.nextLabel, draft.lenses.length === 0 && styles.nextIdle]}>
          {ONBOARDING.next}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  heading: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 36, color: colors.ivory },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { gap: spacing.md },
  lens: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 32, color: colors.ivory },
  next: {
    minHeight: MIN_TOUCH,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.6 },
  nextLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 2, color: colors.brass },
  nextIdle: { color: colors.frame },
});
