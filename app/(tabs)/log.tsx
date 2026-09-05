import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';
import { Eyebrow } from '@components/ui/Eyebrow';
import { GainComposer } from '@components/log/GainComposer';
import { TodaysGainCard } from '@components/home/TodaysGainCard';
import { MonthCompleteLine } from '@components/home/MonthCompleteLine';
import { BirthSpark } from '@components/home/BirthSpark';
import { Toast } from '@components/ui/Toast';
import { useCreateEntry } from '@/hooks/useEntries';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow, monthKeyOf, shiftMonthKey } from '@/utils/period';
import type { NewEntryInput, TodaysGain } from '@/types';

/**
 * HOME (§6).
 *
 * Opening the app puts the person one tap from writing. There is no ＋ button,
 * no list of past records competing for attention, no settings and no analysis
 * on this screen — a month plate, a question, three chips, a field, and ✓.
 */
export default function LogScreen() {
  const router = useRouter();
  const currentMonth = useMemo(() => monthKeyOf(new Date()), []);
  const previousMonth = useMemo(() => shiftMonthKey(currentMonth, -1), [currentMonth]);

  const [todaysGain, setTodaysGain] = useState<TodaysGain | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sparkCount, setSparkCount] = useState(0);

  const createEntry = useCreateEntry();
  const setMapMonthKey = useUiStore((s) => s.setMapMonthKey);

  // A title only exists once a month has been read, so most of the time this
  // line is simply absent — which is the intended state, not a missing value.
  const { data: monthReview } = useMonthReview(currentMonth);

  // A month that has ended and has something to say announces itself once, as
  // a line the person may tap. It never interrupts and it never repeats.
  const { data: previousReview } = useMonthReview(previousMonth);
  const seenMonthEnds = useUiStore((s) => s.seenMonthEnds);
  const showMonthComplete =
    Boolean(previousReview) && !seenMonthEnds.includes(previousMonth);

  const handleSave = useCallback(
    (input: NewEntryInput) => {
      setTodaysGain(null);
      setSparkCount((n) => n + 1);
      createEntry.mutate(input, {
        onSuccess: (result) => {
          // A queued record has not been read yet, so it gets a note about
          // where it is rather than a gain that does not exist.
          if (result.queued) setToast('保存しました。接続が戻ったら同期します。');
          else if (result.todaysGain) setTodaysGain(result.todaysGain);
        },
      });
    },
    [createEntry]
  );

  const openOnMap = useCallback(() => {
    setMapMonthKey(currentMonth);
    router.push('/map');
  }, [currentMonth, router, setMapMonthKey]);

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
            {monthReview?.title ? (
              <Text style={styles.monthTitle}>{monthReview.title}</Text>
            ) : null}
          </View>

          {/* The empty space is the design: nothing is offered before the field. */}
          <View style={styles.breath} />

          <GainComposer onSave={handleSave} saving={createEntry.isPending} />

          <TodaysGainCard
            gain={todaysGain}
            onDismiss={() => setTodaysGain(null)}
            onOpen={openOnMap}
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
  monthTitle: {
    fontFamily: fonts.serif,
    fontSize: 13,
    letterSpacing: 1.6,
    color: colors.ivoryFaint,
  },
  breath: { height: spacing.xxl + spacing.lg },
});
