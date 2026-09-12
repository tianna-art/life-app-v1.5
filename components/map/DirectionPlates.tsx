import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { antenna } from '@/constants/antennas';
import { PencilMark } from '@components/ui/PencilMark';
import type { AntennaId } from '@/types';

/**
 * The year's sentence, with the month's アンテナ nested inside it.
 *
 * The nesting is the argument: a month is not a separate goal, it is a smaller
 * piece of the same direction. Both are shown in the words the person chose —
 * nothing here rewords them, on this screen or any other.
 *
 * A direction that has not been set yet is a row you press. It used to be flat
 * text, with only the card's small header responding — so the one line a
 * person actually wants to press, 「方向を置く」, was the one line that did
 * nothing. The marks say which is which: 「›」 at the end of the header when
 * something is there to go and look at, a pencil in the row itself when there
 * is not.
 */
export function DirectionPlates({
  year,
  month,
  yearDirection,
  antennaIds,
  onEditYear,
  onEditMonth,
}: {
  year: number;
  /** 1–12. */
  month: number;
  yearDirection: string | null;
  antennaIds: readonly AntennaId[];
  onEditYear: () => void;
  onEditMonth: () => void;
}) {
  return (
    <View style={styles.plate} testID="direction-plates">
      <Pressable
        testID="year-direction"
        onPress={onEditYear}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={yearDirection ?? COPY.placeYear}
        style={styles.yearRow}
      >
        <Text style={styles.eyebrow}>{`${year}年の方向`}</Text>
        {yearDirection ? <Text style={styles.chevron}>›</Text> : null}
      </Pressable>

      {yearDirection ? (
        <Text style={styles.yearText}>{yearDirection}</Text>
      ) : (
        <Pressable
          testID="year-direction-place"
          onPress={onEditYear}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={COPY.placeYear}
          style={({ pressed }) => [styles.placeRow, pressed && styles.pressed]}
        >
          <Text style={styles.unset}>{COPY.placeYear}</Text>
          <PencilMark />
        </Pressable>
      )}

      <Text style={styles.arrow}>↓</Text>

      <View style={styles.monthPlate}>
        <Pressable
          testID="month-direction"
          onPress={onEditMonth}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={
            antennaIds.length > 0
              ? antennaIds.map((id) => antenna(id)?.title ?? id).join('、')
              : COPY.placeMonth
          }
          style={styles.monthRow}
        >
          <Text style={styles.eyebrow}>{`${month}月の方向`}</Text>
          {antennaIds.length > 0 ? <Text style={styles.chevron}>›</Text> : null}
        </Pressable>

        {antennaIds.length === 0 ? (
          <Pressable
            testID="month-direction-place"
            onPress={onEditMonth}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={COPY.placeMonth}
            style={({ pressed }) => [styles.placeRow, pressed && styles.pressed]}
          >
            <Text style={styles.unset}>{COPY.placeMonth}</Text>
            <PencilMark />
          </Pressable>
        ) : (
          antennaIds.map((id) => (
            <Text key={id} style={styles.monthText}>
              {antenna(id)?.title ?? id}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: colors.butter,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch', justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch', justifyContent: 'center' },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.brownDim },
  chevron: { fontFamily: fonts.sans, fontSize: 14, color: colors.brownFaint },
  yearText: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 27,
    color: colors.brown,
    textAlign: 'center',
  },
  // An unset direction is a way in, not a warning: orange, and it reads as an
  // invitation rather than something missing.
  unset: { fontFamily: fonts.sans, fontSize: 14, color: colors.orange, textAlign: 'center' },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    minHeight: MIN_TOUCH,
  },
  pressed: { opacity: 0.62 },
  arrow: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  monthPlate: {
    alignSelf: 'stretch',
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  monthText: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 24, color: colors.brown },
});
