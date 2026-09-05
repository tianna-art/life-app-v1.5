import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { DailyComposer } from '@components/log/DailyComposer';
import { MirrorCard } from '@components/home/MirrorCard';
import { MonthNav } from '@components/home/MonthNav';
import { DirectionPlate } from '@components/home/DirectionPlate';
import { MonthCompleteLine } from '@components/home/MonthCompleteLine';
import { BirthSpark } from '@components/home/BirthSpark';
import { Toast } from '@components/ui/Toast';
import { useCreateLog } from '@/hooks/useLogs';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useMonthTheme, useYearDirection } from '@/hooks/useLens';
import { generateQuestion } from '@/ai/client';
import { useUiStore } from '@/state/uiStore';
import { monthKeyOf, shiftMonthKey } from '@/utils/period';
import type { LogType, Mirror, MomentTag, NewLogInput } from '@/types';

/**
 * HOME (§8).
 *
 * Opening the app puts the person one tap from recording. There is no ＋
 * button, no list of past records competing for attention, and no analysis on
 * this screen.
 *
 * The month plate steps backwards through the year. What it changes is what is
 * being read — that month's theme, and a way into its reading — never where a
 * record goes: a record always belongs to today, and the composer is only
 * shown on the current month for that reason. Letting someone write into a
 * month they are looking at would silently backdate their evidence, and the
 * whole model rests on records being in the order they happened.
 */
export default function LogScreen() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const thisMonth = useMemo(() => monthKeyOf(now), [now]);

  const [monthKey, setMonthKey] = useState(thisMonth);
  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sparkCount, setSparkCount] = useState(0);

  const createLog = useCreateLog();
  const setMapMonthKey = useUiStore((s) => s.setMapMonthKey);

  const viewingNow = monthKey === thisMonth;
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));

  const { data: direction } = useYearDirection(now.getFullYear());
  const { data: monthTheme } = useMonthTheme(year, month);
  const { data: monthReview } = useMonthReview(monthKey);

  // A month that has ended and has something to say announces itself once, as
  // a line the person may tap. It never interrupts and it never repeats.
  const previousMonth = useMemo(() => shiftMonthKey(thisMonth, -1), [thisMonth]);
  const { data: previousReview } = useMonthReview(previousMonth);
  const seenMonthEnds = useUiStore((s) => s.seenMonthEnds);
  const showMonthComplete =
    viewingNow && Boolean(previousReview) && !seenMonthEnds.includes(previousMonth);

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
          if (result.queued) setToast('保存しました。接続が戻ったら同期します。');
          else if (result.mirror) setMirror(result.mirror);
        },
      });
    },
    [createLog]
  );

  const openProgression = useCallback(
    (id: string) => {
      setMapMonthKey(thisMonth);
      router.push(`/progression/${id}`);
    },
    [thisMonth, router, setMapMonthKey]
  );

  const step = useCallback(
    (delta: number) => {
      const next = shiftMonthKey(monthKey, delta);
      // Nothing is recorded in the future, so forward stops at this month.
      if (delta > 0 && next > thisMonth) return;
      setMonthKey(next);
      setMirror(null);
    },
    [monthKey, thisMonth]
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
          <DirectionPlate
            direction={direction}
            onPress={() => router.push('/year/direction')}
          />

          <View style={styles.header}>
            <MonthNav
              monthKey={monthKey}
              canGoForward={!viewingNow}
              onStep={step}
              // The reading only exists once the month is over, so the plate
              // is only tappable then.
              onOpen={viewingNow ? undefined : () => router.push(`/month/${monthKey}`)}
              openLabel={LABELS.openMonth}
            />
            {themeLine ? <Text style={styles.monthTheme}>{themeLine}</Text> : null}
          </View>

          {viewingNow ? (
            <>
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
            </>
          ) : (
            // A past month is somewhere to look, not somewhere to write into.
            <View style={styles.past}>
              <Text style={styles.pastNotice}>{LABELS.pastMonthNotice}</Text>
              <Text
                testID="back-to-this-month"
                onPress={() => setMonthKey(thisMonth)}
                accessibilityRole="button"
                accessibilityLabel={LABELS.thisMonth}
                style={styles.backToNow}
              >
                {LABELS.thisMonth}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BirthSpark trigger={sparkCount} />

      <Toast message={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  header: { paddingTop: spacing.xs, gap: spacing.xs },
  monthTheme: {
    fontFamily: fonts.serif,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.ivoryFaint,
  },
  breath: { height: spacing.lg },
  past: { paddingTop: spacing.xxl, gap: spacing.md, alignItems: 'flex-start' },
  pastNotice: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  backToNow: {
    fontFamily: fonts.sans,
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.brass,
    paddingVertical: spacing.sm,
  },
});
