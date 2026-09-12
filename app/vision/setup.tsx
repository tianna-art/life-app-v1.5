import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { VISION_SUGGESTIONS, WORD_SUGGESTIONS } from '@/constants/generated/preview';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useVision, useVisionMutations } from '@/hooks/useVision';

/**
 * Setting up ビジョンボード.
 *
 * Nothing here is a decision. The items may contradict each other, the list
 * may be short, and it can be left half-done — so there is no required field
 * and no step counter. The examples are there for when nothing comes to mind,
 * and are added by tapping rather than copied by hand.
 */
export default function VisionSetupScreen() {
  const router = useRouter();
  const { data: vision } = useVision();
  const { addItem, addWord, removeItem, removeWord } = useVisionMutations();
  const [itemDraft, setItemDraft] = useState('');
  const [wordDraft, setWordDraft] = useState('');

  const items = vision?.items ?? [];
  const words = vision?.words ?? [];
  const taken = new Set(items.map((i) => i.text));

  return (
    <Screen>
      <Pressable
        testID="vision-back"
        onPress={() => router.back()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={COPY.back}
        style={styles.back}
      >
        <Text style={styles.backLabel}>{COPY.back}</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          {COPY.visionLabel}
        </Text>
        <Text style={styles.sub}>{COPY.visionSheetSub}</Text>

        <Text style={styles.sectionLabel}>{COPY.visionYours}</Text>
        <Text style={styles.hint}>{COPY.visionWhy}</Text>

        <View style={styles.chosen}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              testID={`vision-item-${item.id}`}
              onPress={() => removeItem.mutate(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.text} を外す`}
              style={({ pressed }) => [styles.chip, styles.chipOn, pressed && styles.pressed]}
            >
              <Text style={styles.chipLabelOn}>{item.text}</Text>
            </Pressable>
          ))}
          {items.length > 0 ? <Text style={styles.tapOff}>{COPY.visionTapRemove}</Text> : null}
        </View>

        <View style={styles.row}>
          <TextInput
            testID="vision-item-input"
            value={itemDraft}
            onChangeText={setItemDraft}
            placeholder={COPY.visionOwnPlaceholder}
            placeholderTextColor={colors.brownFaint}
            style={styles.input}
            accessibilityLabel={COPY.visionOwn}
          />
          <Pressable
            testID="vision-item-add"
            onPress={() => {
              if (itemDraft.trim().length === 0) return;
              addItem.mutate(itemDraft.trim());
              setItemDraft('');
            }}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={COPY.visionAddOwn}
            style={styles.round}
          >
            <Text style={styles.plus}>＋</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>{COPY.visionExamples}</Text>
        {/* The examples come grouped, and stay grouped: a flat wall of forty
            phrases is harder to read than six short lists. */}
        {VISION_SUGGESTIONS.map(([group, examples]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupLabel}>{group}</Text>
            <View style={styles.suggestions}>
              {examples
                .filter((text) => !taken.has(text))
                .map((text) => (
                  <Pressable
                    key={text}
                    testID={`vision-suggest-${text}`}
                    onPress={() => addItem.mutate(text)}
                    accessibilityRole="button"
                    accessibilityLabel={text}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  >
                    <Text style={styles.chipLabel}>{text}</Text>
                  </Pressable>
                ))}
            </View>
          </View>
        ))}

        <HairlineRule />

        <Text style={styles.sectionLabel}>{COPY.visionWords}</Text>
        <Text style={styles.hint}>{COPY.visionWordsSub}</Text>

        <View style={styles.chosen}>
          {words.map((word) => (
            <Pressable
              key={word.id}
              testID={`vision-word-${word.id}`}
              onPress={() => removeWord.mutate(word.id)}
              accessibilityRole="button"
              accessibilityLabel={`${word.text} を外す`}
              style={({ pressed }) => [styles.chip, styles.chipOn, pressed && styles.pressed]}
            >
              <Text style={styles.chipLabelOn}>{word.text}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <TextInput
            testID="vision-word-input"
            value={wordDraft}
            onChangeText={setWordDraft}
            placeholder={COPY.visionWordPlaceholder}
            placeholderTextColor={colors.brownFaint}
            style={styles.input}
            accessibilityLabel={COPY.visionAddWord}
          />
          <Pressable
            testID="vision-word-add"
            onPress={() => {
              if (wordDraft.trim().length === 0) return;
              addWord.mutate(wordDraft.trim());
              setWordDraft('');
            }}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={COPY.visionAddWord}
            style={styles.round}
          >
            <Text style={styles.plus}>＋</Text>
          </Pressable>
        </View>

        {WORD_SUGGESTIONS.map(([group, examples]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupLabel}>{group}</Text>
            <View style={styles.suggestions}>
              {examples.map((text) => (
                <Pressable
                  key={text}
                  testID={`word-suggest-${text}`}
                  onPress={() => addWord.mutate(text)}
                  accessibilityRole="button"
                  accessibilityLabel={text}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Text style={styles.chipLabel}>{text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          testID="vision-done"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={COPY.visionSave}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveLabel}>{COPY.visionSave}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: spacing.sm },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownDim },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  heading: { fontFamily: fonts.serif, fontSize: 20, color: colors.brown },
  sub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownDim },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.brownFaint,
    paddingTop: spacing.sm,
  },
  hint: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 19, color: colors.brownFaint },
  chosen: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: { gap: spacing.xs },
  groupLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.orange },
  chip: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipOn: { backgroundColor: colors.butter, borderColor: 'transparent' },
  chipLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownDim },
  chipLabelOn: { fontFamily: fonts.sans, fontSize: 13, color: colors.brown },
  tapOff: { fontFamily: fonts.sans, fontSize: 10, color: colors.brownFaint },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  round: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontSize: 16, color: colors.brown },
  pressed: { opacity: 0.7 },
  save: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  saveLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.onBrown },
});
