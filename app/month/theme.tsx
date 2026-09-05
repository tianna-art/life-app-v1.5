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
import { MONTH, ONBOARDING } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useMonthThemeCandidates, useSaveMonthTheme } from '@/hooks/useLens';
import { formatMonthEyebrow, monthKeyOf } from '@/utils/period';
import type { MonthThemeCandidate } from '@/types';

const SOURCE_LABEL: Record<MonthThemeCandidate['source'], string> = {
  continue: 'CONTINUE',
  deepen: 'DEEPEN',
  follow_spark: 'FOLLOW THE SPARK',
};

/**
 * §6 — the month's theme.
 *
 * Nobody is asked to set a goal from scratch on the first of the month: the
 * three candidates are written from what the last month actually held. All
 * three are refusable, and 今月は決めない is a real answer rather than a way
 * out — a month with no theme still records evidence perfectly well.
 */
export default function MonthThemeScreen() {
  const router = useRouter();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const candidates = useMonthThemeCandidates();
  const save = useSaveMonthTheme();

  const [own, setOwn] = useState('');
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (candidates.isPending || candidates.data) return;
    candidates.mutate({ year, month });
    // Runs once for this month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (theme: string | null, source: MonthThemeCandidate['source'] | 'custom') => {
    save.mutate(
      {
        year,
        month,
        ...(theme ? { initialTheme: theme } : {}),
        source: theme ? source : 'none',
        candidates: candidates.data ?? [],
      },
      { onSuccess: () => router.replace('/log') }
    );
  };

  const offered = candidates.data ?? [];

  return (
    <Screen>
      <TopBar>
        <Text style={styles.plate}>{formatMonthEyebrow(monthKeyOf(now))}</Text>
      </TopBar>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>{MONTH.themeHeading}</Text>
          <HairlineRule />

          {candidates.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brass} />
            </View>
          ) : offered.length === 0 ? (
            // A first month has nothing to continue from. Offering three
            // anyway would be asking for a goal, which §6 exists to avoid.
            <Text style={styles.hint}>
              先月の記録がまだないので、今月は自由に始めます。
            </Text>
          ) : (
            <View style={styles.list}>
              {offered.map((candidate) => (
                <Pressable
                  key={candidate.theme}
                  testID={`month-theme-${candidate.source}`}
                  onPress={() => choose(candidate.theme, candidate.source)}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={candidate.theme}
                  accessibilityHint={candidate.because}
                  style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
                >
                  <Text style={styles.source}>{SOURCE_LABEL[candidate.source]}</Text>
                  <Text style={styles.candidateText}>{candidate.theme}</Text>
                  {/* Where it came from, so the suggestion reads as an
                      observation rather than an instruction. */}
                  {candidate.because ? (
                    <Text style={styles.because}>{candidate.because}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}

          {writing ? (
            <TextInput
              testID="month-theme-own-input"
              value={own}
              onChangeText={setOwn}
              autoFocus
              style={styles.input}
              placeholder={ONBOARDING.writeMyOwn}
              placeholderTextColor={colors.ivoryFaint}
              accessibilityLabel={ONBOARDING.writeMyOwn}
              onSubmitEditing={() => choose(own.trim() || null, 'custom')}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              testID="month-theme-write-own"
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

        <Pressable
          testID="month-theme-skip"
          onPress={() => choose(null, 'custom')}
          disabled={save.isPending}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={MONTH.skip}
          style={({ pressed }) => [styles.next, pressed && styles.pressed]}
        >
          <Text style={styles.nextLabel}>{MONTH.skip}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  heading: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 36, color: colors.ivory },
  hint: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 24, color: colors.ivoryFaint },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { gap: spacing.lg },
  candidate: { minHeight: MIN_TOUCH, justifyContent: 'center', gap: 3 },
  source: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2.6, color: colors.brassDim },
  candidateText: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 30, color: colors.ivory },
  because: { fontFamily: fonts.sans, fontSize: 12, color: colors.ivoryFaint },
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
  nextLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 2, color: colors.ivoryFaint },
});
