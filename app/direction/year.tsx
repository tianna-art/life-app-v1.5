import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { YEAR_SETUP_QUESTIONS } from '@/constants/generated/preview';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { VoiceEntry } from '@components/ui/VoiceEntry';
import { useSaveYearDirection, useYearDirection } from '@/hooks/useDirection';

type Route = 'choose' | 'ask' | 'free';

/**
 * 年の方向 — one sentence, by either of two roads.
 *
 * 問いかけ for when it is not in words yet; 自由記述 for when it is. Both end
 * in the same place: a sentence in the person's own words, which nothing in
 * the app ever rewrites.
 *
 * It is not a goal and there is nothing to reach. It is what you come back to
 * when you are unsure, which is why it can be replaced at any time — and why
 * the sentence it replaces is kept rather than overwritten.
 */
export default function YearDirectionScreen() {
  const router = useRouter();
  const year = useMemo(() => new Date().getFullYear(), []);
  const { data: current } = useYearDirection(year);
  const save = useSaveYearDirection();

  const [route, setRoute] = useState<Route>('choose');
  const [answers, setAnswers] = useState<string[]>(() => YEAR_SETUP_QUESTIONS.map(() => ''));
  const [draft, setDraft] = useState(current?.direction ?? '');

  const commit = (direction: string, withAnswers: string[] = []) => {
    const text = direction.trim();
    if (text.length === 0) return;
    save.mutate({ year, direction: text, answers: withAnswers.filter((a) => a.trim().length > 0) });
    router.back();
  };

  return (
    <Screen>
      <Pressable
        testID="year-back"
        onPress={() => (route === 'choose' ? router.back() : setRoute('choose'))}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={COPY.back}
        style={styles.back}
      >
        <Text style={styles.backLabel}>{COPY.back}</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          {`${year}年の方向`}
        </Text>
        <Text style={styles.sub}>{COPY.yearDirIntro}</Text>

        {route === 'choose' ? (
          <View style={styles.routes} testID="year-routes">
            <Pressable
              testID="year-route-ask"
              onPress={() => setRoute('ask')}
              accessibilityRole="button"
              accessibilityLabel={COPY.yearHowAsk}
              style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}
            >
              <Text style={styles.routeTitle}>{COPY.yearHowAsk}</Text>
              <Text style={styles.routeNote}>{COPY.yearHowAskNote}</Text>
            </Pressable>

            <Pressable
              testID="year-route-free"
              onPress={() => setRoute('free')}
              accessibilityRole="button"
              accessibilityLabel={COPY.yearHowFree}
              style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}
            >
              <Text style={styles.routeTitle}>{COPY.yearHowFree}</Text>
              <Text style={styles.routeNote}>{COPY.yearHowFreeNote}</Text>
            </Pressable>

            {current ? (
              <>
                <HairlineRule />
                <Text style={styles.pastLabel}>{COPY.pastDirections}</Text>
                <Text style={styles.past}>{current.direction}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {route === 'ask' ? (
          <View style={styles.block} testID="year-ask">
            {YEAR_SETUP_QUESTIONS.map(([question, hint], index) => (
              <View key={question} style={styles.question}>
                <Text style={styles.questionText}>{question}</Text>
                {hint ? <Text style={styles.hint}>{hint}</Text> : null}
                <TextInput
                  testID={`year-answer-${index}`}
                  value={answers[index] ?? ''}
                  onChangeText={(text) =>
                    setAnswers((prev) => prev.map((a, i) => (i === index ? text : a)))
                  }
                  multiline
                  style={styles.answer}
                  accessibilityLabel={question}
                  textAlignVertical="top"
                />
                <VoiceEntry testID={`year-answer-voice-${index}`} />
              </View>
            ))}

            {/* The answers do not become the direction on their own: the
                person writes the sentence, having read back what they said. */}
            <Text style={styles.questionText}>{COPY.yearFreeQ}</Text>
            <TextInput
              testID="year-direction-input"
              value={draft}
              onChangeText={setDraft}
              placeholder={COPY.yearFreePlaceholder}
              placeholderTextColor={colors.brownFaint}
              multiline
              style={styles.answer}
              accessibilityLabel={COPY.yearFreeQ}
              textAlignVertical="top"
            />
            <VoiceEntry testID="year-direction-voice" />
            <SaveButton onPress={() => commit(draft, answers)} disabled={draft.trim().length === 0} />
          </View>
        ) : null}

        {route === 'free' ? (
          <View style={styles.block} testID="year-free">
            <Text style={styles.questionText}>{COPY.yearFreeQ}</Text>
            <Text style={styles.hint}>{COPY.yearFreeNote}</Text>
            <TextInput
              testID="year-direction-input"
              value={draft}
              onChangeText={setDraft}
              placeholder={COPY.yearFreePlaceholder}
              placeholderTextColor={colors.brownFaint}
              multiline
              style={styles.answer}
              accessibilityLabel={COPY.yearFreeQ}
              autoFocus
              textAlignVertical="top"
            />
            <VoiceEntry testID="year-free-voice" />
            <SaveButton onPress={() => commit(draft)} disabled={draft.trim().length === 0} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SaveButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      testID="year-save"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={COPY.yearDirSave}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.save, disabled && styles.saveIdle, pressed && styles.pressed]}
    >
      <Text style={[styles.saveLabel, disabled && styles.saveLabelIdle]}>{COPY.yearDirSave}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: spacing.sm },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownDim },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  heading: { fontFamily: fonts.serif, fontSize: 20, color: colors.brown },
  sub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownDim },
  routes: { gap: spacing.md },
  routeCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xs,
  },
  routeTitle: { fontFamily: fonts.serif, fontSize: 16, color: colors.brown },
  routeNote: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownFaint },
  pastLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  past: { fontFamily: fonts.serif, fontSize: 14, lineHeight: 23, color: colors.brownDim },
  block: { gap: spacing.md },
  question: { gap: spacing.xs },
  questionText: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 24, color: colors.brown },
  hint: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 19, color: colors.brownFaint },
  answer: {
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 24,
  },
  pressed: { opacity: 0.7 },
  save: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIdle: {
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  saveLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.onBrown },
  saveLabelIdle: { color: colors.brownFaint },
});
