import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { ONBOARDING } from '@/constants/copy';
import { DESIRED_SELF_GROUPS } from '@/constants/desiredSelf';
import { Screen } from '@components/ui/Screen';
import { SelectableRow } from '@components/onboarding/SelectableRow';
import { useOnboardingDraft } from '@/state/uiStore';

/**
 * §3 — どんな自分になれたら嬉しい？
 *
 * Not tasks, and no upper limit: someone may take one card or twenty. What
 * they are is a sensor setting — each card raises the detection priority of
 * particular patterns, which is why the hint says what they do rather than
 * asking the person to commit to them.
 */
export default function DesiredScreen() {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const [selected, setSelected] = useState<string[]>(draft.desiredSelfCards);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const next = () => {
    draft.setDesiredSelfCards(selected);
    router.push('/onboarding/lens');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{ONBOARDING.desiredHeading}</Text>
        <Text style={styles.hint}>{ONBOARDING.desiredHint}</Text>

        {DESIRED_SELF_GROUPS.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.cards.map((card) => (
              <SelectableRow
                key={card.id}
                testID={`card-${card.id}`}
                label={card.label}
                selected={selected.includes(card.id)}
                onPress={() => toggle(card.id)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <Pressable
        testID="desired-next"
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
  group: { gap: spacing.sm, marginTop: spacing.lg },
  groupLabel: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 3,
    color: colors.brassDim,
  },
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
