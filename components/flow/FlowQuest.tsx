import { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { FLOW_STEPS } from '@/constants/generated/preview';
import { FLOW_BACKDROPS, FLOW_VEIL } from '@/constants/flowBackdrops';
import type { FlowSession, FlowStage } from '@/types';

/**
 * 感情クエスト — RAIN → RIVER → OCEAN → CLOUD → 見返し.
 *
 * Four stages that ask for the same thing in four different postures — let it
 * fall, let some of it go, accept what stayed, carry one thing forward — and
 * then a fifth screen that only shows them back.
 *
 * Three rules matter more than the rest.
 *
 * Nothing is stored until the very end. There is one 削除する｜記録する at the
 * close of the whole run, not one per stage, because a stage that saved as you
 * left it would make writing the hard part a commitment. Somebody must be able
 * to type the worst of it, read it back, and throw the whole thing away.
 *
 * Which is why the decision happens on the 見返し and nowhere else. Deciding
 * from inside the last stage means deciding about words you can no longer see;
 * the whole point of having poured something out is to look at it before
 * saying what becomes of it. The recap adds nothing to what was written — no
 * summary, no reading, no encouragement. It lays the four out and stops.
 *
 * And no stage requires an answer. A blank stage is simply absent from what is
 * kept, and absent from the recap too — the quest is a way of getting
 * something out, not a form.
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
  // FLOW_STEPS.length is the 見返し at the far end.
  const [step, setStep] = useState(-1);
  const [texts, setTexts] = useState<Partial<Record<FlowStage, string>>>({});
  const [askingToDrop, setAskingToDrop] = useState(false);
  // Which stages have been closed off with 完了する. Writing and moving on are
  // two separate acts here — see the comment above the button.
  const [done, setDone] = useState<Partial<Record<FlowStage, boolean>>>({});

  const stage = FLOW_STEPS[step];

  /** What was actually written. A stage left blank is absent, not empty. */
  const written = () =>
    Object.fromEntries(
      Object.entries(texts).filter(([, value]) => (value ?? '').trim().length > 0)
    ) as Partial<Record<FlowStage, string>>;

  const reset = () => {
    setTexts({});
    setDone({});
    setStep(-1);
    setAskingToDrop(false);
  };

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

  // 見返し — the far end. Everything that was written, laid out and nothing
  // else, and the one decision about all of it.
  if (step >= FLOW_STEPS.length) {
    const kept = written();
    return (
      <View style={styles.wrap} testID="flow-review">
        {FLOW_STEPS.map((s) =>
          kept[s.id as FlowStage] ? (
            <View key={s.id} style={styles.recapBlock} testID={`flow-review-${s.id}`}>
              <Text style={[styles.stageName, { color: s.color }]}>{s.name}</Text>
              <Text style={styles.recapText}>{kept[s.id as FlowStage]}</Text>
            </View>
          ) : null
        )}

        {/* A run where nothing was written still ends here rather than
            refusing to move: there is simply nothing to decide about. */}
        {Object.keys(kept).length === 0 ? (
          <Text style={styles.foot}>{COPY.noRecordYet}</Text>
        ) : null}

        <View style={styles.close} testID="flow-close">
          <Pressable
            testID="flow-discard"
            onPress={() => setAskingToDrop(true)}
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
              onSave(kept);
              reset();
            }}
            accessibilityRole="button"
            accessibilityLabel={COPY.flowKeepAll}
            style={({ pressed }) => [styles.primary, styles.grow, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{COPY.flowKeepAll}</Text>
          </Pressable>
        </View>

        <Pressable
          testID="flow-back"
          onPress={() => setStep(FLOW_STEPS.length - 1)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={COPY.flowBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backLabel}>{`← ${COPY.flowBack}`}</Text>
        </Pressable>

        {/* Asked once, plainly, and only about the part that cannot be undone.
            Everything else in this screen is reversible by walking back. */}
        {askingToDrop ? (
          <View style={styles.ask} testID="flow-drop-ask">
            <Text style={styles.askText}>{COPY.flowDropAsk}</Text>
            <View style={styles.askRow}>
              <Pressable
                testID="flow-drop-no"
                onPress={() => setAskingToDrop(false)}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={COPY.navNo}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryLabel}>{COPY.navNo}</Text>
              </Pressable>
              <Pressable
                testID="flow-drop-yes"
                onPress={() => {
                  reset();
                  onDiscard();
                }}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={COPY.navYes}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryLabel}>{COPY.navYes}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  if (!stage) return null;
  const closed = done[stage.id as FlowStage] === true;

  return (
    <ImageBackground
      source={FLOW_BACKDROPS[stage.id]}
      // Nothing of the photograph is cut off: it is fitted whole, and the
      // deep ground it sits on carries whatever the fit leaves over.
      resizeMode="contain"
      style={[styles.wrap, styles.stageWrap]}
      imageStyle={styles.backdrop}
      testID={`flow-${stage.id}`}
    >
      {/* The dimming sits between the picture and the words rather than being
          baked into the file, so the same photograph can be turned up or down
          in one place if it ever reads wrong on a real screen. */}
      <View style={styles.veil} pointerEvents="none" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.stageName, { color: stage.color }]}>{stage.name}</Text>
        <Text style={styles.stageLabelOnPhoto}>{stage.label}</Text>
        <Text style={styles.bodyOnPhoto}>{stage.copy}</Text>

        <Text style={styles.questionOnPhoto}>{stage.question}</Text>
        <View style={styles.examples}>
          {stage.examples.map((example) => (
            <Text key={example} style={styles.exampleOnPhoto}>
              {example}
            </Text>
          ))}
        </View>

        <TextInput
          testID={`flow-input-${stage.id}`}
          value={texts[stage.id as FlowStage] ?? ''}
          onChangeText={(text) => setTexts((prev) => ({ ...prev, [stage.id]: text }))}
          editable={!closed}
          multiline
          style={[styles.input, closed && styles.inputClosed]}
          accessibilityLabel={stage.question}
          textAlignVertical="top"
        />

        <Text style={styles.footOnPhoto}>{stage.foot}</Text>

        {/*
          完了する, and only then the way on.
          
          Finishing writing and moving downstream are two different decisions,
          and a screen that offers only 「川へ流す」 makes them one: you leave a
          stage by agreeing to the metaphor, never by simply being done. So the
          exit is withheld until the person says they have finished, and the
          pencil beside it says the saying is reversible.
        */}
        <View style={styles.actions}>
          <Pressable
            testID={`flow-edit-${stage.id}`}
            onPress={() => setDone((prev) => ({ ...prev, [stage.id]: false }))}
            disabled={!closed}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="書き直す"
            style={({ pressed }) => [
              styles.pencil,
              !closed && styles.pencilOff,
              pressed && styles.pressed,
            ]}
          >
            <Svg width={16} height={16} viewBox="-9 -9 18 18">
              <Path
                d="M -6 6 L -5.4 2.6 L 2.6 -5.4 L 5.4 -2.6 L -2.6 5.4 Z M 2.6 -5.4 L 4.2 -7 C 5 -7.8 6.2 -7.8 7 -7 C 7.8 -6.2 7.8 -5 7 -4.2 L 5.4 -2.6"
                fill="none"
                stroke={colors.paper}
                strokeWidth={1.1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>

          <Pressable
            testID={`flow-done-${stage.id}`}
            onPress={() => setDone((prev) => ({ ...prev, [stage.id]: true }))}
            disabled={closed}
            accessibilityRole="button"
            accessibilityLabel={COPY.flowComplete}
            style={({ pressed }) => [
              styles.doneButton,
              styles.grow,
              closed && styles.doneButtonOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.doneLabel}>{COPY.flowComplete}</Text>
          </Pressable>
        </View>

        {/* Every stage moves forward, the last one included: 雲 leads to
            全ての流れを振り返る, not to a decision. What becomes of the run is
            settled on the 見返し, where all four can be read back. */}
        {closed ? (
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
        ) : null}

        {/* Walking back is small and off to the side, and nothing written is
            lost by it. The first stage has nowhere to go back to. */}
        {step > 0 ? (
          <Pressable
            testID={`flow-back-${stage.id}`}
            onPress={() => setStep(step - 1)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={COPY.flowBack}
            style={({ pressed }) => [styles.backOnPhoto, pressed && styles.pressed]}
          >
            <Text style={styles.backLabelOnPhoto}>{COPY.flowBack}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ImageBackground>
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
  back: { alignSelf: 'center', paddingVertical: spacing.sm },
  backLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint },
  ask: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  askText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 24,
    color: colors.brown,
    textAlign: 'center',
  },
  askRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },

  /* The stage screens, which sit on a photograph. ------------------------- */
  stageWrap: { backgroundColor: colors.brownDeep, overflow: 'hidden' },
  backdrop: { borderRadius: radii.xl },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: FLOW_VEIL,
  },
  stageLabelOnPhoto: { fontFamily: fonts.serif, fontSize: 15, color: colors.onBrown },
  bodyOnPhoto: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 24,
    color: 'rgba(250, 246, 236, 0.92)',
  },
  questionOnPhoto: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, color: colors.onBrown },
  exampleOnPhoto: { fontFamily: fonts.sans, fontSize: 11, color: 'rgba(250, 246, 236, 0.82)' },
  footOnPhoto: {
    fontFamily: fonts.serif,
    fontSize: 12,
    lineHeight: 21,
    color: 'rgba(250, 246, 236, 0.72)',
    textAlign: 'center',
  },
  inputClosed: { backgroundColor: 'rgba(255, 253, 246, 0.72)' },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pencil: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250, 246, 236, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilOff: { opacity: 0.3 },
  doneButton: {
    minHeight: MIN_TOUCH,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250, 246, 236, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  doneButtonOff: { opacity: 0.36 },
  doneLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.onBrown },
  backOnPhoto: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  backLabelOnPhoto: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(250, 246, 236, 0.7)' },
});
