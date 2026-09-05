import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';
import { Eyebrow } from '@components/ui/Eyebrow';
import { DailyComposer } from '@components/log/DailyComposer';
import { MirrorCard } from '@components/home/MirrorCard';
import { MonthCompleteLine } from '@components/home/MonthCompleteLine';
import { BirthSpark } from '@components/home/BirthSpark';
import { Toast } from '@components/ui/Toast';
import { useCreateLog } from '@/hooks/useLogs';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useMonthTheme, useYearDirection } from '@/hooks/useLens';
import { generateQuestion } from '@/ai/client';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow, monthKeyOf, shiftMonthKey } from '@/utils/period';
import type { LogType, Mirror, MomentTag, NewLogInput } from '@/types';

/**
 * HOME (§8).
 *
 * Opening the app puts the person one tap from recording. There is no ＋
 * button, no list of past records competing for attention, and no analysis on
 * this screen — a month plate, the month's theme if there is one, and the
 * three levels.
 */
export default function LogScreen() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => monthKeyOf(now), [now]);
  const previousMonth = useMemo(() => shiftMonthKey(currentMonth, -1), [currentMonth]);

  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sparkCount, setSparkCount] = useState(0);

  const createLog = useCreateLog();
  const setMapMonthKey = useUiStore((s) => s.setMapMonthKey);

  const { data: direction } = useYearDirection(now.getFullYear());
  const { data: monthTheme } = useMonthTheme(now.getFullYear(), now.getMonth() + 1);
  const { data: monthReview } = useMonthReview(currentMonth);

  // A month that has ended and has something to say announces itself once, as
  // a line the person may tap. It never interrupts and it never repeats.
  const { data: previousReview } = useMonthReview(previousMonth);
  const seenMonthEnds = useUiStore((s) => s.seenMonthEnds);
  const showMonthComplete = Boolean(previousReview) && !seenMonthEnds.includes(previousMonth);

  const handleNeedQuestion = useCallback(
    (input: { logType: LogType; momentTags: MomentTag[] }) =>
      generateQuestion({
        logType: input.logType,
        momentTags: input.momentTags,
        desiredSelfCards: direction?.desiredSelfCards,
        lenses: direction?.progressionLenses,
        monthTheme: monthTheme?.initialTheme,
      }),
    [direction?.desiredSelfCards, direction?.progressionLenses, monthTheme?.initialTheme]
  );

  const handleSave = useCallback(
    (input: NewLogInput) => {
      setMirror(null);
      setSparkCount((n) => n + 1);
      createLog.mutate(input, {
        onSuccess: (result) => {
          // A queued record has not been read yet, so it gets a note about
          // where it is rather than a line that does not exist.
          if (result.queued) setToast('保存しました。接続が戻ったら同期します。');
          else if (result.mirror) setMirror(result.mirror);
        },
      });
    },
    [createLog]
  );

  const openProgression = useCallback(
    (id: string) => {
      setMapMonthKey(currentMonth);
      router.push(`/progression/${id}`);
    },
    [currentMonth, router, setMapMonthKey]
  );

  const themeLine = monthTheme?.initialTheme ?? monthReview?.title ?? '';

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
          <View style={styles.header}>
            <Eyebrow>{formatMonthEyebrow(currentMonth)}</Eyebrow>
            {/* The month's theme, small. It is a lens, not an instruction, so
                it sits above the input rather than inside it (§8). */}
            {themeLine ? <Text style={styles.monthTheme}>{themeLine}</Text> : null}
          </View>

          <View style={styles.breath} />

          <DailyComposer
            onSave={handleSave}
            onNeedQuestion={handleNeedQuestion}
            saving={createLog.isPending}
          />

          <MirrorCard
            mirror={mirror}
            onDismiss={() => setMirror(null)}
            onOpenProgression={openProgression}
          />

          {showMonthComplete ? (
            <MonthCompleteLine
              monthKey={previousMonth}
              onPress={(key) => router.push(`/month/${key}`)}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <BirthSpark trigger={sparkCount} />

      <Toast message={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.md, gap: spacing.xs },
  monthTheme: {
    fontFamily: fonts.serif,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.ivoryFaint,
  },
  breath: { height: spacing.xl },
});
