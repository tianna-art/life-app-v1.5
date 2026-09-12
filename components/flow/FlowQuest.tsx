import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { FLOW_STEPS } from '@/constants/generated/preview';
import type { FlowSession, FlowStage } from '@/types';

/**
 * 感情クエスト — RAIN → RIVER → OCEAN → CLOUD.
 *
 * Four stages that ask for the same thing in four different postures: let it
 * fall, let some of it go, accept what stayed, carry one thing forward.
 *
 * Two rules matter more than the rest.
 *
 * Nothing is stored until the very end. There is one 削除する｜記録する at the
 * close of the whole run, not one per stage, because a stage that saved as you
 * left it would make writing the hard part a commitment. Somebody must be able
 * to type the worst of it, read it back, and throw the whole thing away.
 *
 * And no stage requires an answer. A blank stage is simply absent from what is
 * kept — the quest is a way of getting something out, not a form.
 */
export function FlowQuest({
  last,
  onSave,
  onDiscard,
}: {
  last: FlowSession | null;
  onSave: (entries: Partial<Record<FlowStage, string>>) => void;
  onDiscard: () => void;
}) {
  // -1 is the doorway: what this is, and what was written last time.
  const [step, setStep] = useState(-1);
  const [texts, setTexts] = useState<Partial<Record<FlowStage, string>>>({});

  const stage = FLOW_STEPS[step];

  if (step < 0) {
    return (
      <View style={styles.wrap} testID="flow-intro">
        <Text style={styles.eyebrow}>{COPY.questWhat}</Text>
        <Text style={styles.body}>{COPY.questWhatBody}</Text>

        {last ? (
          <View style={styles.recap} testID="flow-last">
            <Text style={styles.recapLabel}>{COPY.questLast}</Text>
            {FLOW_STEPS.map((s) =>
              last.entries[s.id as FlowStage] ? (
                <View key={s.id} style={styles.recapBlock}>
                  <Text style={[styles.stageName, { color: s.color }]}>{s.name}</Text>
                  <Text style={styles.recapText}>{last.entries[s.id as FlowStage]}</Text>
                </View>
              ) : null
            )}
          </View>
        ) : null}

        <Pressable
          testID="flow-begin"
          onPress={() => setStep(0)}
          accessibilityRole="button"
          accessibilityLabel={FLOW_STEPS[0]?.label ?? '' }
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>{FLOW_STEPS[0]?.label}</Text>
        </Pressable>
      </View>
    );
  }

  if (!stage) return null;
  const last_ = step === FLOW_STEPS.length - 1;

  return (
    <View style={[styles.wrap, { backgroundColor: stage.tint }]} testID={`flow-${stage.id}`}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.stageName, { color: stage.color }]}>{stage.name}</Text>
        <Text style={styles.stageLabel}>{stage.label}</Text>
        <Text style={styles.body}>{stage.copy}</Text>

        <Text style={styles.question}>{stage.question}</Text>
        <View style={styles.examples}>
          {stage.examples.map((example) => (
            <Text key={example} style={styles.example}>
              {example}
            </Text>
          ))}
        </View>

        <TextInput
          testID={`flow-input-${stage.id}`}
          value={texts[stage.id as FlowStage] ?? ''}
          onChangeText={(text) => setTexts((prev) => ({ ...prev, [stage.id]: text }))}
          multiline
          style={styles.input}
          accessibilityLabel={stage.question}
          textAlignVertical="top"
        />

        <Text style={styles.foot}>{stage.foot}</Text>

        {last_ ? (
          // One decision, at the end, about the whole thing.
          <View style={styles.close} testID="flow-close">
            <Pressable
              testID="flow-discard"
              onPress={() => {
                setTexts({});
                setStep(-1);
                onDiscard();
              }}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={COPY.flowDrop}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>{COPY.flowDrop}</Text>
            </Pressable>

            <Pressable
              testID="flow-save"
              onPress={() => {
                // A stage left blank is absent, not empty: the quest is a way
                // of getting something out, not a form to complete.
                const kept = Object.fromEntries(
                  Object.entries(texts).filter(([, value]) => (value ?? '').trim().length > 0)
                ) as Partial<Record<FlowStage, string>>;
                onSave(kept);
                setTexts({});
                setStep(-1);
              }}
              accessibilityRole="button"
              accessibilityLabel={COPY.flowKeepAll}
              style={({ pressed }) => [styles.primary, styles.grow, pressed && styles.pressed]}
            >
              <Text style={styles.primaryLabel}>{COPY.flowKeepAll}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID={`flow-next-${stage.id}`}
            onPress={() => setStep(step + 1)}
            accessibilityRole="button"
            accessibilityLabel={stage.next}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: stage.nextColor },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryOnTint}>{stage.next}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, borderRadius: radii.xl, padding: spacing.md, gap: spacing.sm },
  scroll: { gap: spacing.md, paddingBottom: spacing.lg },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.brownFaint },
  body: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 24, color: colors.brownDim },
  stageName: { fontFamily: fonts.serif, fontSize: 20, letterSpacing: 3 },
  stageLabel: { fontFamily: fonts.serif, fontSize: 15, color: colors.brown },
  question: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, color: colors.brown },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  example: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
  input: {
    minHeight: 140,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 25,
  },
  foot: {
    fontFamily: fonts.serif,
    fontSize: 12,
    lineHeight: 21,
    color: colors.brownFaint,
    textAlign: 'center',
  },
  primary: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  grow: { flex: 1 },
  primaryLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.onBrown },
  primaryOnTint: { fontFamily: fonts.sans, fontSize: 15, color: colors.brown },
  secondary: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.brownDim },
  close: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  recap: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recapLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  recapBlock: { gap: 2 },
  recapText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.brownDim },
});
