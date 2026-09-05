import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { ONBOARDING } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useSaveYearDirection, useYearThemeCandidates } from '@/hooks/useLens';
import { useOnboardingDraft } from '@/state/uiStore';

/**
 * §5 — the year's theme.
 *
 * Three offered, and all three are refusable: writing one's own is a first
 * class option and so is carrying on without one. §5 calls this the YEAR
 * INITIAL THEME and says it gets decided again at the end of the year, which
 * is the whole reason it can be this loose.
 */
export default function ThemeScreen() {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const year = new Date().getFullYear();

  const candidates = useYearThemeCandidates();
  const save = useSaveYearDirection();

  const [own, setOwn] = useState('');
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (candidates.isPending || candidates.data) return;
    candidates.mutate({ selectedAreas: draft.selectedAreas, lenses: draft.lenses });
    // Runs once for this draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (initialTheme?: string) => {
    save.mutate(
      {
        year,
        selectedAreas: draft.selectedAreas,
        desiredSelfCards: draft.desiredSelfCards,
        progressionLenses: draft.lenses,
        ...(initialTheme ? { initialTheme } : {}),
      },
      {
        onSuccess: () => {
          draft.clear();
          router.replace('/log');
        },
      }
    );
  };

  const offered = candidates.data ?? [];

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>{ONBOARDING.themeHeading}</Text>
          <Text style={styles.hint}>{ONBOARDING.themeHint}</Text>
          <HairlineRule />

          {candidates.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brass} />
            </View>
          ) : (
            <View style={styles.list}>
              {offered.map((theme) => (
                <Pressable
                  key={theme}
                  testID={`theme-${theme}`}
                  onPress={() => finish(theme)}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={theme}
                  style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
                >
                  <Text style={styles.candidateText}>{theme}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {writing ? (
            <TextInput
              testID="theme-own-input"
              value={own}
              onChangeText={setOwn}
              autoFocus
              style={styles.input}
              placeholder={ONBOARDING.writeMyOwn}
              placeholderTextColor={colors.ivoryFaint}
              accessibilityLabel={ONBOARDING.writeMyOwn}
              onSubmitEditing={() => finish(own.trim() || undefined)}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              testID="theme-write-own"
              onPress={() => setWriting(true)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={ONBOARDING.writeMyOwn}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>{ONBOARDING.writeMyOwn}</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Carrying on without a theme is a real answer: the lens is already
            saved, and §5 does not require the year to be named. */}
        <Pressable
          testID="theme-done"
          onPress={() => finish(writing && own.trim() ? own.trim() : undefined)}
          disabled={save.isPending}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={ONBOARDING.done}
          style={({ pressed }) => [styles.next, pressed && styles.pressed]}
        >
          <Text style={styles.nextLabel}>{ONBOARDING.done}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  heading: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 36, color: colors.ivory },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { gap: spacing.md },
  candidate: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  candidateText: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 32, color: colors.ivory },
  input: {
    minHeight: MIN_TOUCH,
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brassDim,
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 18,
  },
  secondary: { minHeight: MIN_TOUCH, justifyContent: 'center', marginTop: spacing.lg },
  secondaryLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  next: {
    minHeight: MIN_TOUCH,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.6 },
  nextLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 2, color: colors.brass },
});
