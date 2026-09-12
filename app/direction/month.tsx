import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { ALL_ANTENNAS } from '@/constants/antennas';
import { Screen } from '@components/ui/Screen';
import { useMonthDirection, useSaveMonthDirection } from '@/hooks/useDirection';
import { MAX_ANTENNAS, type AntennaId } from '@/types';
import { monthKeyOf } from '@/utils/period';

/**
 * 月の方向 — up to two アンテナ.
 *
 * Two, not three. Three makes each one half-watched, and the month's reading
 * has to be able to say something about every direction it claims to follow.
 *
 * A third tap does nothing, and the limit says so in a line that is always on
 * screen. This was briefly built the other way — the oldest choice stepping
 * aside for the new one — on the theory that an unresponsive control reads as
 * broken. That was worse: it takes something the person deliberately chose and
 * removes it without telling them, and the card that vanishes is the one they
 * picked a moment ago. A tap that does not land is a smaller surprise than a
 * choice that disappears, and the line explains it.
 *
 * These can be changed mid-month. A direction is what you are looking at, and
 * looking somewhere else in week three is allowed.
 */
export default function MonthDirectionScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const periodKey = useMemo(() => monthKeyOf(today), [today]);

  const { data: current } = useMonthDirection(periodKey);
  const save = useSaveMonthDirection();
  const [chosen, setChosen] = useState<AntennaId[]>([]);

  useEffect(() => {
    if (current) setChosen([...current.antennaIds]);
  }, [current]);

  const toggle = (id: AntennaId) => {
    setChosen((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Full. Nothing is dropped to make room; the person takes one off.
      if (prev.length >= MAX_ANTENNAS) return prev;
      return [...prev, id];
    });
  };

  return (
    <Screen>
      <Pressable
        testID="direction-back"
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
          {`${today.getMonth() + 1}月の方向`}
        </Text>
        <Text style={styles.sub}>{COPY.antennaSub}</Text>

        {ALL_ANTENNAS.map((a) => {
          const on = chosen.includes(a.id);
          return (
            <Pressable
              key={a.id}
              testID={`antenna-${a.id}`}
              onPress={() => toggle(a.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={a.wish}
              style={({ pressed }) => [
                styles.card,
                on && { backgroundColor: a.color, borderColor: 'transparent' },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.wish}>{a.wish}</Text>
              <Text style={styles.when}>{a.recommendedWhen}</Text>
              <Text style={styles.provides}>{a.provides}</Text>
            </Pressable>
          );
        })}

        {/* Always present, and legible rather than faint: this is the rule,
            not a footnote, and it is the only thing explaining a tap that
            does not land. */}
        <Text style={[styles.limit, chosen.length >= MAX_ANTENNAS && styles.limitReached]}>
          {COPY.antennaLimit}
        </Text>

        <Pressable
          testID="direction-save"
          onPress={() => {
            save.mutate({ periodKey, antennaIds: chosen });
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel={COPY.yearDirSave}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveLabel}>{COPY.yearDirSave}</Text>
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
  sub: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownDim },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.7 },
  wish: { fontFamily: fonts.serif, fontSize: 16, color: colors.brown },
  when: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownDim },
  provides: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 19, color: colors.brownFaint },
  limit: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownDim, textAlign: 'center' },
  limitReached: { color: colors.orange },
  save: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.onBrown },
});
