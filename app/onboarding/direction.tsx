import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { ONBOARDING } from '@/constants/copy';
import { DIRECTION_AREAS, MAX_AREAS } from '@/constants/areas';
import { Screen } from '@components/ui/Screen';
import { SelectableRow } from '@components/onboarding/SelectableRow';
import { useOnboardingDraft } from '@/state/uiStore';

/**
 * §2 — 今年、どんな方向を育てたい？
 *
 * Several may be true at once, and that is the design: this person wants a
 * different way of working and also wants a few other things, and forcing one
 * goal would flatten what the reading can see later.
 *
 * The cap exists so the lens stays a lens. Past four, everything is watched,
 * which is the same as nothing being watched.
 */
export default function DirectionScreen() {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const [selected, setSelected] = useState<string[]>(draft.selectedAreas);

  const atCap = selected.length >= MAX_AREAS;

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((a) => a !== id)
        : current.length >= MAX_AREAS
          ? current
          : [...current, id]
    );
  };

  const next = () => {
    draft.setSelectedAreas(selected);
    router.push('/onboarding/desired');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{ONBOARDING.directionHeading}</Text>
        <Text style={styles.hint}>{ONBOARDING.directionHint}</Text>

        <View style={styles.list}>
          {DIRECTION_AREAS.map((area) => (
            <SelectableRow
              key={area.id}
              testID={`area-${area.id}`}
              label={area.label}
              selected={selected.includes(area.id)}
              onPress={() => toggle(area.id)}
              disabled={atCap}
            />
          ))}
        </View>
      </ScrollView>

      <Pressable
        testID="direction-next"
        onPress={next}
        disabled={selected.length === 0}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={ONBOARDING.next}
        accessibilityState={{ disabled: selected.length === 0 }}
        style={({ pressed }) => [styles.next, pressed && styles.pressed]}
      >
        <Text style={[styles.nextLabel, selected.length === 0 && styles.nextIdle]}>
          {ONBOARDING.next}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  heading: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 36, color: colors.ivory },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  list: { gap: spacing.sm, marginTop: spacing.md },
  next: {
    minHeight: MIN_TOUCH,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.6 },
  nextLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 2, color: colors.brass },
  nextIdle: { color: colors.frame },
});
