import { useEffect, useState } from 'react';
import {
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
import { LABELS, ONBOARDING } from '@/constants/copy';
import { directionAreaLabel } from '@/constants/areas';
import { desiredSelfLabel } from '@/constants/desiredSelf';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useSaveYearDirection, useYearDirection } from '@/hooks/useLens';

/**
 * The year's direction, as it stands (§1, §5).
 *
 * What this screen deliberately does not show: how far along anything is. §1
 * is explicit that the gap is a lens rather than a mark, so there is no count
 * of records against the theme, no progress towards the cards, and nothing
 * that reads as a distance from any of it. There is no such number stored
 * anywhere to show.
 *
 * The theme is editable because §5 treats it as provisional — it gets decided
 * again at year end. The areas and cards are shown but not editable here:
 * changing them changes what the reading looks for, which belongs in the
 * opening screens where their effect is explained.
 */
export default function DirectionScreen() {
  const router = useRouter();
  const year = new Date().getFullYear();

  const { data: direction } = useYearDirection(year);
  const save = useSaveYearDirection();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(direction?.initialTheme ?? '');
  }, [direction?.initialTheme]);

  const commit = () => {
    if (!direction) return;
    save.mutate(
      {
        year,
        selectedAreas: direction.selectedAreas,
        desiredSelfCards: direction.desiredSelfCards,
        progressionLenses: direction.progressionLenses,
        initialTheme: draft.trim(),
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()}>
        <Text style={styles.plate}>{year}</Text>
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
          {direction ? (
            <>
              <Text style={styles.eyebrow}>{LABELS.direction}</Text>
              {editing ? (
                <TextInput
                  testID="direction-theme-input"
                  value={draft}
                  onChangeText={setDraft}
                  autoFocus
                  style={styles.themeInput}
                  accessibilityLabel={ONBOARDING.themeHeading}
                  onSubmitEditing={commit}
                  returnKeyType="done"
                />
              ) : (
                <Pressable
                  testID="direction-theme"
                  onPress={() => setEditing(true)}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={direction.initialTheme ?? ONBOARDING.writeMyOwn}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={direction.initialTheme ? styles.theme : styles.themeEmpty}>
                    {direction.initialTheme ?? ONBOARDING.writeMyOwn}
                  </Text>
                </Pressable>
              )}
              <Text style={styles.hint}>{ONBOARDING.themeHint}</Text>

              {editing ? (
                <Pressable
                  testID="direction-theme-save"
                  onPress={commit}
                  disabled={save.isPending}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={LABELS.saveEdit}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <Text style={styles.actionLabel}>{LABELS.saveEdit}</Text>
                </Pressable>
              ) : null}

              <HairlineRule />

              {/* What the reading watches for. Shown because it is what makes
                  the theme concrete, not because anything is measured by it. */}
              <View style={styles.block}>
                <Text style={styles.section}>{ONBOARDING.lensHeading}</Text>
                {direction.progressionLenses.map((lens) => (
                  <Text key={lens} style={styles.lens}>
                    {lens}
                  </Text>
                ))}
              </View>

              {direction.selectedAreas.length > 0 ? (
                <>
                  <HairlineRule />
                  <View style={styles.block}>
                    <Text style={styles.section}>{ONBOARDING.directionHeading}</Text>
                    {direction.selectedAreas.map((area) => (
                      <Text key={area} style={styles.item}>
                        {directionAreaLabel(area)}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}

              {direction.desiredSelfCards.length > 0 ? (
                <>
                  <HairlineRule />
                  <View style={styles.block}>
                    <Text style={styles.section}>{ONBOARDING.desiredHeading}</Text>
                    {direction.desiredSelfCards.map((card) => (
                      <Text key={card} style={styles.item}>
                        {desiredSelfLabel(card)}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <View style={styles.block}>
              <Text style={styles.hint}>今年の方向は、まだ設定されていません。</Text>
              <Pressable
                testID="direction-start"
                onPress={() => router.push('/onboarding/direction')}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={ONBOARDING.directionHeading}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionLabel}>{ONBOARDING.directionHeading}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  eyebrow: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2.6, color: colors.ivoryFaint },
  theme: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 36, color: colors.ivory },
  themeEmpty: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 32, color: colors.ivoryFaint },
  themeInput: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 34,
    color: colors.ivory,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brassDim,
    paddingVertical: spacing.xs,
  },
  hint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryFaint },
  block: { gap: spacing.sm },
  section: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 3, color: colors.ivoryFaint },
  lens: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28, color: colors.ivory },
  item: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 24, color: colors.ivoryDim },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  actionLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 1.2, color: colors.brass },
  pressed: { opacity: 0.6 },
});
