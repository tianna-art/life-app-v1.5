import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';
import { Eyebrow } from '@components/ui/Eyebrow';
import { EntryComposer } from '@components/log/EntryComposer';
import { ClarificationChip } from '@components/log/ClarificationChip';
import { MirrorCard } from '@components/home/MirrorCard';
import { MonthCompleteLine } from '@components/home/MonthCompleteLine';
import { BirthSpark } from '@components/home/BirthSpark';
import { Toast } from '@components/ui/Toast';
import { useCreateEntry } from '@/hooks/useEntries';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useAnswerClarification, usePendingClarification } from '@/hooks/useProgressions';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow, monthKeyOf, shiftMonthKey } from '@/utils/period';
import type { Clarification, Mirror, NewEntryInput } from '@/types';

/**
 * HOME (§4).
 *
 * Opening the app puts the person one tap from writing. There is no ＋ button,
 * no list of past records competing for attention, no settings and no analysis
 * on this screen — a month plate, a question, two drawers, a field, three
 * marks, and ✓.
 */
export default function LogScreen() {
  const router = useRouter();
  const currentMonth = useMemo(() => monthKeyOf(new Date()), []);
  const previousMonth = useMemo(() => shiftMonthKey(currentMonth, -1), [currentMonth]);

  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [freshClarification, setFreshClarification] = useState<Clarification | null>(null);
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
  const showMonthComplete = Boolean(previousReview) && !seenMonthEnds.includes(previousMonth);

  // A question left over from an earlier save is still worth asking; one that
  // arrived with this save takes precedence because its record is on screen.
  const { data: pendingClarification } = usePendingClarification();
  const answerClarification = useAnswerClarification();
  const clarification = freshClarification ?? pendingClarification ?? null;

  const handleSave = useCallback(
    (input: NewEntryInput) => {
      setMirror(null);
      setFreshClarification(null);
      setSparkCount((n) => n + 1);
      createEntry.mutate(input, {
        onSuccess: (result) => {
          // A queued record has not been read yet, so it gets a note about
          // where it is rather than a line that does not exist.
          if (result.queued) {
            setToast('保存しました。接続が戻ったら同期します。');
            return;
          }
          if (result.mirror) setMirror(result.mirror);
          if (result.clarification) setFreshClarification(result.clarification);
        },
      });
    },
    [createEntry]
  );

  const handleAnswer = useCallback(
    (answer: string | null) => {
      if (!clarification) return;
      setFreshClarification(null);
      answerClarification.mutate({ id: clarification.id, answer });
    },
    [answerClarification, clarification]
  );

  const openProgression = useCallback(
    (id: string) => {
      setMapMonthKey(currentMonth);
      router.push(`/progression/${id}`);
    },
    [currentMonth, router, setMapMonthKey]
  );

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

          <EntryComposer onSave={handleSave} saving={createEntry.isPending} />

          <MirrorCard
            mirror={mirror}
            onDismiss={() => setMirror(null)}
            onOpenProgression={openProgression}
          />

          <ClarificationChip clarification={clarification} onAnswer={handleAnswer} />

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
